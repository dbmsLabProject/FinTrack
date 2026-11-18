


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE OR REPLACE FUNCTION "public"."can_view_profile"("p_profile_id" "uuid", "p_viewer_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select p_profile_id = p_viewer_id
    or exists (select 1 from public.friendships f
      where f.status = 'accepted'
        and ((f.user_id_1 = p_profile_id and f.user_id_2 = p_viewer_id)
          or (f.user_id_2 = p_profile_id and f.user_id_1 = p_viewer_id)))
    or exists (select 1 from public.split_group_members a
      join public.split_group_members b using (split_group_id)
      where a.user_id = p_profile_id and b.user_id = p_viewer_id);
$$;


ALTER FUNCTION "public"."can_view_profile"("p_profile_id" "uuid", "p_viewer_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_settlement_allocations"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_settlement_id uuid;
  v_amt numeric(14,2);
  v_sum numeric(14,2);
begin
  v_settlement_id := coalesce(new.settlement_id, old.settlement_id);
  select s.amount into v_amt from public.settlements s where s.settlement_id = v_settlement_id;
  if not found then return null; end if;
  select coalesce(sum(a.amount),0) into v_sum from public.settlement_allocations a
    where a.settlement_id = v_settlement_id;
  if v_sum > v_amt then raise exception 'Settlement allocations cannot exceed settlement amount'; end if;
  if exists (
    select 1 from public.settlement_allocations a
    join public.expense_splits e on e.expense_split_id = a.expense_split_id
    join public.transactions t on t.transaction_id = e.transaction_id
    join public.settlements s on s.settlement_id = a.settlement_id
    where a.settlement_id = v_settlement_id
      and (e.user_id <> s.payer_user_id or t.user_id <> s.payee_user_id
        or t.currency_code <> s.currency_code
        or (s.split_group_id is not null and t.split_group_id is distinct from s.split_group_id))
  ) then raise exception 'Settlement allocation must match its payer, payee, currency, and group'; end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."check_settlement_allocations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_transaction_allocations"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare
  v_tx_id uuid;
  v_type text;
  v_owner uuid;
  v_group uuid;
  v_amount numeric(14,2);
  v_count integer;
  v_sum numeric(14,2);
  v_bad boolean;
begin
  v_tx_id := coalesce(new.transaction_id, old.transaction_id);
  select t.transaction_type, t.user_id, t.split_group_id, t.amount
    into v_type, v_owner, v_group, v_amount
    from public.transactions t where t.transaction_id = v_tx_id;
  if not found then return null; end if;
  select count(*), coalesce(sum(s.amount_owed), 0),
         coalesce(bool_or(s.user_id = v_owner), false)
    into v_count, v_sum, v_bad
    from public.expense_splits s where s.transaction_id = v_tx_id;
  if v_type = 'INCOME' and v_count <> 0 then
    raise exception 'Income transactions cannot have expense splits';
  elsif v_type = 'GROUP_SPLIT' then
    if v_count = 0 or v_sum <> v_amount then
      raise exception 'Group split allocations must be present and sum to the transaction amount';
    end if;
    if not public.is_group_member(v_group, v_owner) then
      raise exception 'The transaction owner must be a member of the split group';
    end if;
    if exists (select 1 from public.expense_splits s
               where s.transaction_id = v_tx_id
                 and not public.is_group_member(v_group, s.user_id)) then
      raise exception 'Every allocated user must be a member of the split group';
    end if;
  elsif v_type = 'DIRECT_LOAN' then
    if v_count <> 1 or v_bad then
      raise exception 'A direct loan requires exactly one borrower allocation distinct from its owner';
    end if;
  end if;
  return null;
end;
$$;


ALTER FUNCTION "public"."check_transaction_allocations"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_fintrack_group"("p_group_name" "text", "p_description" "text", "p_member_user_ids" "uuid"[] DEFAULT '{}'::"uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_group_id uuid; v_user_id uuid := auth.uid();
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if length(trim(coalesce(p_group_name,'')))=0 then raise exception 'Group name is required'; end if;
 if exists (select 1 from unnest(coalesce(p_member_user_ids,'{}'::uuid[])) invited(user_id) where invited.user_id <> v_user_id and not exists (select 1 from public.friendships f where f.status='accepted' and f.user_id_1=least(v_user_id,invited.user_id) and f.user_id_2=greatest(v_user_id,invited.user_id))) then raise exception 'Only accepted friends can be invited to a group'; end if;
 insert into public.split_groups(group_name,description,created_by_user_id) values(trim(p_group_name),nullif(trim(coalesce(p_description,'')),''),v_user_id) returning split_group_id into v_group_id;
 insert into public.split_group_members(split_group_id,user_id) select v_group_id,m.user_id from (select distinct unnest(coalesce(p_member_user_ids,'{}'::uuid[])) as user_id union select v_user_id) m;
 return v_group_id;
end; $$;


ALTER FUNCTION "public"."create_fintrack_group"("p_group_name" "text", "p_description" "text", "p_member_user_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."find_fintrack_user_by_email"("p_email" "text") RETURNS TABLE("other_user_id" "uuid", "full_name" "text")
    LANGUAGE "plpgsql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  return query
  select u.user_id, u.full_name
  from public.users as u
  where lower(u.email_id) = lower(trim(coalesce(p_email, '')))
    and u.user_id <> v_user_id
  limit 1;
end;
$$;


ALTER FUNCTION "public"."find_fintrack_user_by_email"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_new_auth_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
begin
  insert into public.users (user_id, full_name, email_id)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''), new.email)
  on conflict (user_id) do nothing;
  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_auth_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_creator"("p_group_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (select 1 from public.split_groups g
    where g.split_group_id = p_group_id and g.created_by_user_id = p_user_id);
$$;


ALTER FUNCTION "public"."is_group_creator"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid" DEFAULT "auth"."uid"()) RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
  select exists (
    select 1 from public.split_group_members m
    where m.split_group_id = p_group_id and m.user_id = p_user_id
  );
$$;


ALTER FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."list_fintrack_connections"() RETURNS TABLE("other_user_id" "uuid", "full_name" "text", "email_id" "text", "status" "text", "action_user_id" "uuid", "created_at" timestamp with time zone)
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
 select case when f.user_id_1=auth.uid() then f.user_id_2 else f.user_id_1 end,u.full_name,u.email_id,f.status,f.action_user_id,f.created_at from public.friendships f join public.users u on u.user_id=case when f.user_id_1=auth.uid() then f.user_id_2 else f.user_id_1 end where auth.uid() in (f.user_id_1,f.user_id_2)
$$;


ALTER FUNCTION "public"."list_fintrack_connections"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."record_fintrack_settlement"("p_counterparty_user_id" "uuid", "p_direction" "text", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_payment_method" "text", "p_settled_at" "date") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_settlement_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if p_counterparty_user_id is null or p_counterparty_user_id=v_user_id then raise exception 'Choose another account'; end if;
 if p_direction not in ('sent','received') then raise exception 'Invalid settlement direction'; end if;
 if p_split_group_id is not null then
  if not public.is_group_member(p_split_group_id,v_user_id) or not public.is_group_member(p_split_group_id,p_counterparty_user_id) then raise exception 'Both accounts must be group members'; end if;
 elsif not exists (select 1 from public.friendships f where f.status='accepted' and f.user_id_1=least(v_user_id,p_counterparty_user_id) and f.user_id_2=greatest(v_user_id,p_counterparty_user_id)) then raise exception 'A personal settlement requires an accepted friend';
 end if;
 insert into public.settlements(payer_user_id,payee_user_id,split_group_id,amount,currency_code,payment_method,settled_at) values(case when p_direction='sent' then v_user_id else p_counterparty_user_id end,case when p_direction='sent' then p_counterparty_user_id else v_user_id end,p_split_group_id,p_amount,p_currency_code,nullif(trim(coalesce(p_payment_method,'')),''),coalesce(p_settled_at,current_date)::timestamptz) returning settlement_id into v_settlement_id;
 return v_settlement_id;
end; $$;


ALTER FUNCTION "public"."record_fintrack_settlement"("p_counterparty_user_id" "uuid", "p_direction" "text", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_payment_method" "text", "p_settled_at" "date") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."request_fintrack_friend"("p_email" "text") RETURNS TABLE("other_user_id" "uuid", "full_name" "text", "email_id" "text")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_target public.users%rowtype; v_user_1 uuid; v_user_2 uuid;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select u.* into v_target from public.users u where lower(u.email_id)=lower(trim(coalesce(p_email,'')));
 if not found or v_target.user_id=v_user_id then raise exception 'No other FinTrack account was found for that email'; end if;
 v_user_1:=least(v_user_id,v_target.user_id); v_user_2:=greatest(v_user_id,v_target.user_id);
 insert into public.friendships(user_id_1,user_id_2,status,action_user_id) values(v_user_1,v_user_2,'pending',v_user_id) on conflict do nothing;
 if not found then raise exception 'A friendship or request already exists'; end if;
 return query select v_target.user_id,v_target.full_name,v_target.email_id;
end; $$;


ALTER FUNCTION "public"."request_fintrack_friend"("p_email" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."respond_fintrack_friend_request"("p_other_user_id" "uuid", "p_accept" boolean) RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_row public.friendships%rowtype;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 select * into v_row from public.friendships f where f.user_id_1=least(v_user_id,p_other_user_id) and f.user_id_2=greatest(v_user_id,p_other_user_id) and f.status='pending' and f.action_user_id<>v_user_id for update;
 if not found then raise exception 'Incoming request not found'; end if;
 if p_accept then update public.friendships set status='accepted',established_at=now(),action_user_id=v_user_id where user_id_1=v_row.user_id_1 and user_id_2=v_row.user_id_2;
 else delete from public.friendships where user_id_1=v_row.user_id_1 and user_id_2=v_row.user_id_2; end if;
end; $$;


ALTER FUNCTION "public"."respond_fintrack_friend_request"("p_other_user_id" "uuid", "p_accept" boolean) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."save_fintrack_transaction"("p_transaction_id" "uuid", "p_transaction_type" "text", "p_category_id" "uuid", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_description" "text", "p_transaction_date" "date", "p_splits" "jsonb" DEFAULT '[]'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
declare v_user_id uuid := auth.uid(); v_transaction_id uuid;
begin
 if v_user_id is null then raise exception 'Authentication required'; end if;
 if p_transaction_type not in ('INCOME','PERSONAL_EXPENSE','GROUP_SPLIT') then raise exception 'Unsupported transaction type'; end if;
 if jsonb_typeof(coalesce(p_splits,'[]'::jsonb)) <> 'array' then raise exception 'Splits must be an array'; end if;
 if p_transaction_type in ('INCOME','PERSONAL_EXPENSE') and jsonb_array_length(coalesce(p_splits,'[]'::jsonb)) > 0 then raise exception 'Income and personal expenses cannot have split allocations'; end if;
 if p_transaction_type = 'GROUP_SPLIT' and p_split_group_id is null then raise exception 'A group is required for a group split'; end if;
 if p_transaction_type <> 'GROUP_SPLIT' and p_split_group_id is not null then raise exception 'Only group split transactions can reference a group'; end if;
 if p_transaction_id is null then
  insert into public.transactions(user_id,transaction_type,category_id,split_group_id,amount,currency_code,description,transaction_date) values(v_user_id,p_transaction_type,p_category_id,p_split_group_id,p_amount,p_currency_code,p_description,p_transaction_date::timestamptz) returning transaction_id into v_transaction_id;
 else
  update public.transactions set transaction_type=p_transaction_type,category_id=p_category_id,split_group_id=p_split_group_id,amount=p_amount,currency_code=p_currency_code,description=p_description,transaction_date=p_transaction_date::timestamptz,is_deleted=false,deleted_at=null where transaction_id=p_transaction_id and user_id=v_user_id returning transaction_id into v_transaction_id;
  if v_transaction_id is null then raise exception 'Transaction not found or not owned by this user'; end if;
 end if;
 delete from public.expense_splits where transaction_id=v_transaction_id;
 if jsonb_array_length(coalesce(p_splits,'[]'::jsonb)) > 0 then
  insert into public.expense_splits(transaction_id,user_id,amount_owed,status) select v_transaction_id,x.user_id,x.amount_owed,coalesce(x.status,'outstanding') from jsonb_to_recordset(p_splits) as x(user_id uuid,amount_owed numeric,status text);
 end if;
 return v_transaction_id;
end; $$;


ALTER FUNCTION "public"."save_fintrack_transaction"("p_transaction_id" "uuid", "p_transaction_type" "text", "p_category_id" "uuid", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_description" "text", "p_transaction_date" "date", "p_splits" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO ''
    AS $$
begin
  new.updated_at := now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."auth_providers" (
    "auth_provider_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "provider_name" "text" NOT NULL,
    "provider_user_id" "text",
    "linked_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_login" timestamp with time zone,
    CONSTRAINT "auth_providers_provider_name_check" CHECK (("length"(TRIM(BOTH FROM "provider_name")) > 0))
);


ALTER TABLE "public"."auth_providers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."categories" (
    "category_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category_name" "text" NOT NULL,
    "category_type" "text" NOT NULL,
    "category_color_hex" "text",
    "created_by_user_id" "uuid",
    CONSTRAINT "categories_category_color_hex_check" CHECK ((("category_color_hex" IS NULL) OR ("category_color_hex" ~ '^#[0-9A-Fa-f]{6}$'::"text"))),
    CONSTRAINT "categories_category_name_check" CHECK (("length"(TRIM(BOTH FROM "category_name")) > 0)),
    CONSTRAINT "categories_category_type_check" CHECK (("category_type" = ANY (ARRAY['income'::"text", 'expense'::"text", 'both'::"text"])))
);


ALTER TABLE "public"."categories" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."expense_splits" (
    "expense_split_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "transaction_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "amount_owed" numeric(14,2) NOT NULL,
    "status" "text" DEFAULT 'outstanding'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "expense_splits_amount_owed_check" CHECK (("amount_owed" > (0)::numeric)),
    CONSTRAINT "expense_splits_status_check" CHECK (("status" = ANY (ARRAY['outstanding'::"text", 'settled'::"text"])))
);


ALTER TABLE "public"."expense_splits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "user_id_1" "uuid" NOT NULL,
    "user_id_2" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "action_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "established_at" timestamp with time zone,
    CONSTRAINT "friendships_check" CHECK (("user_id_1" < "user_id_2")),
    CONSTRAINT "friendships_check1" CHECK ((("action_user_id" = "user_id_1") OR ("action_user_id" = "user_id_2"))),
    CONSTRAINT "friendships_check2" CHECK (((("status" = 'accepted'::"text") AND ("established_at" IS NOT NULL)) OR ("status" <> 'accepted'::"text"))),
    CONSTRAINT "friendships_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'blocked'::"text"])))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."icons" (
    "icon_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "icon_url" "text" NOT NULL,
    "alt_text" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."icons" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlement_allocations" (
    "settlement_id" "uuid" NOT NULL,
    "expense_split_id" "uuid" NOT NULL,
    "amount" numeric(14,2) NOT NULL,
    CONSTRAINT "settlement_allocations_amount_check" CHECK (("amount" > (0)::numeric))
);


ALTER TABLE "public"."settlement_allocations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."settlements" (
    "settlement_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "payer_user_id" "uuid" NOT NULL,
    "payee_user_id" "uuid" NOT NULL,
    "split_group_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "currency_code" "text" DEFAULT 'USD'::"text" NOT NULL,
    "payment_method" "text",
    "transaction_reference" "text",
    "settled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "settlements_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "settlements_check" CHECK (("payer_user_id" <> "payee_user_id")),
    CONSTRAINT "settlements_currency_code_check" CHECK (("currency_code" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."settlements" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_group_members" (
    "split_group_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "joined_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."split_group_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."split_groups" (
    "split_group_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "group_name" "text" NOT NULL,
    "description" "text",
    "group_icon_id" "uuid",
    "created_by_user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_active" boolean DEFAULT true NOT NULL,
    CONSTRAINT "split_groups_group_name_check" CHECK (("length"(TRIM(BOTH FROM "group_name")) > 0))
);


ALTER TABLE "public"."split_groups" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."transactions" (
    "transaction_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "transaction_type" "text" NOT NULL,
    "category_id" "uuid",
    "split_group_id" "uuid",
    "amount" numeric(14,2) NOT NULL,
    "currency_code" "text" DEFAULT 'USD'::"text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "receipt_image_url" "text",
    "transaction_date" timestamp with time zone DEFAULT "now"() NOT NULL,
    "is_deleted" boolean DEFAULT false NOT NULL,
    "deleted_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "comment" "text" DEFAULT ''::"text" NOT NULL,
    CONSTRAINT "transactions_amount_check" CHECK (("amount" > (0)::numeric)),
    CONSTRAINT "transactions_check1" CHECK ((("is_deleted" AND ("deleted_at" IS NOT NULL)) OR ((NOT "is_deleted") AND ("deleted_at" IS NULL)))),
    CONSTRAINT "transactions_currency_code_check" CHECK (("currency_code" ~ '^[A-Z]{3}$'::"text")),
    CONSTRAINT "transactions_group_link_check" CHECK (((("transaction_type" = 'GROUP_SPLIT'::"text") AND ("split_group_id" IS NOT NULL)) OR (("transaction_type" = ANY (ARRAY['INCOME'::"text", 'PERSONAL_EXPENSE'::"text", 'DIRECT_LOAN'::"text"])) AND ("split_group_id" IS NULL)))),
    CONSTRAINT "transactions_transaction_type_check" CHECK (("transaction_type" = ANY (ARRAY['INCOME'::"text", 'PERSONAL_EXPENSE'::"text", 'GROUP_SPLIT'::"text", 'DIRECT_LOAN'::"text"])))
);


ALTER TABLE "public"."transactions" OWNER TO "postgres";


COMMENT ON COLUMN "public"."transactions"."comment" IS 'Optional user-provided note for the transaction.';



CREATE TABLE IF NOT EXISTS "public"."users" (
    "user_id" "uuid" NOT NULL,
    "full_name" "text" DEFAULT ''::"text" NOT NULL,
    "email_id" "text",
    "mobile_number" "text",
    "profile_icon_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "preferred_currency" "text" DEFAULT 'INR'::"text" NOT NULL,
    CONSTRAINT "users_preferred_currency_check" CHECK (("preferred_currency" ~ '^[A-Z]{3}$'::"text"))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


ALTER TABLE ONLY "public"."auth_providers"
    ADD CONSTRAINT "auth_providers_pkey" PRIMARY KEY ("auth_provider_id");



ALTER TABLE ONLY "public"."auth_providers"
    ADD CONSTRAINT "auth_providers_user_id_provider_name_key" UNIQUE ("user_id", "provider_name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_created_by_user_id_category_name_key" UNIQUE ("created_by_user_id", "category_name");



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_pkey" PRIMARY KEY ("category_id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_pkey" PRIMARY KEY ("expense_split_id");



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_transaction_id_user_id_key" UNIQUE ("transaction_id", "user_id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("user_id_1", "user_id_2");



ALTER TABLE ONLY "public"."icons"
    ADD CONSTRAINT "icons_pkey" PRIMARY KEY ("icon_id");



ALTER TABLE ONLY "public"."settlement_allocations"
    ADD CONSTRAINT "settlement_allocations_pkey" PRIMARY KEY ("settlement_id", "expense_split_id");



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_pkey" PRIMARY KEY ("settlement_id");



ALTER TABLE ONLY "public"."split_group_members"
    ADD CONSTRAINT "split_group_members_pkey" PRIMARY KEY ("split_group_id", "user_id");



ALTER TABLE ONLY "public"."split_groups"
    ADD CONSTRAINT "split_groups_pkey" PRIMARY KEY ("split_group_id");



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_pkey" PRIMARY KEY ("transaction_id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_mobile_number_key" UNIQUE ("mobile_number");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("user_id");



CREATE INDEX "auth_providers_user_idx" ON "public"."auth_providers" USING "btree" ("user_id");



CREATE INDEX "categories_creator_idx" ON "public"."categories" USING "btree" ("created_by_user_id");



CREATE INDEX "expense_splits_transaction_idx" ON "public"."expense_splits" USING "btree" ("transaction_id");



CREATE INDEX "expense_splits_user_status_idx" ON "public"."expense_splits" USING "btree" ("user_id", "status");



CREATE INDEX "friendships_user2_idx" ON "public"."friendships" USING "btree" ("user_id_2");



CREATE INDEX "settlement_allocations_split_idx" ON "public"."settlement_allocations" USING "btree" ("expense_split_id");



CREATE INDEX "settlements_group_time_idx" ON "public"."settlements" USING "btree" ("split_group_id", "settled_at" DESC);



CREATE INDEX "settlements_payee_time_idx" ON "public"."settlements" USING "btree" ("payee_user_id", "settled_at" DESC);



CREATE INDEX "settlements_payer_time_idx" ON "public"."settlements" USING "btree" ("payer_user_id", "settled_at" DESC);



CREATE INDEX "split_group_members_user_idx" ON "public"."split_group_members" USING "btree" ("user_id");



CREATE INDEX "transactions_category_idx" ON "public"."transactions" USING "btree" ("category_id");



CREATE INDEX "transactions_group_date_idx" ON "public"."transactions" USING "btree" ("split_group_id", "transaction_date" DESC) WHERE ("is_deleted" = false);



CREATE INDEX "transactions_owner_date_idx" ON "public"."transactions" USING "btree" ("user_id", "transaction_date" DESC) WHERE ("is_deleted" = false);



CREATE CONSTRAINT TRIGGER "expense_splits_allocation_check" AFTER INSERT OR DELETE OR UPDATE ON "public"."expense_splits" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_transaction_allocations"();



CREATE CONSTRAINT TRIGGER "settlement_allocation_check" AFTER INSERT OR UPDATE ON "public"."settlements" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_settlement_allocations"();



CREATE CONSTRAINT TRIGGER "settlement_allocations_check" AFTER INSERT OR DELETE OR UPDATE ON "public"."settlement_allocations" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_settlement_allocations"();



CREATE CONSTRAINT TRIGGER "transactions_allocation_check" AFTER INSERT OR UPDATE ON "public"."transactions" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_transaction_allocations"();



CREATE OR REPLACE TRIGGER "transactions_set_updated_at" BEFORE UPDATE ON "public"."transactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



CREATE OR REPLACE TRIGGER "users_set_updated_at" BEFORE UPDATE ON "public"."users" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at"();



ALTER TABLE ONLY "public"."auth_providers"
    ADD CONSTRAINT "auth_providers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."categories"
    ADD CONSTRAINT "categories_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "public"."transactions"("transaction_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."expense_splits"
    ADD CONSTRAINT "expense_splits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_action_user_id_fkey" FOREIGN KEY ("action_user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_id_1_fkey" FOREIGN KEY ("user_id_1") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_id_2_fkey" FOREIGN KEY ("user_id_2") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlement_allocations"
    ADD CONSTRAINT "settlement_allocations_expense_split_id_fkey" FOREIGN KEY ("expense_split_id") REFERENCES "public"."expense_splits"("expense_split_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settlement_allocations"
    ADD CONSTRAINT "settlement_allocations_settlement_id_fkey" FOREIGN KEY ("settlement_id") REFERENCES "public"."settlements"("settlement_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_payee_user_id_fkey" FOREIGN KEY ("payee_user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_payer_user_id_fkey" FOREIGN KEY ("payer_user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."settlements"
    ADD CONSTRAINT "settlements_split_group_id_fkey" FOREIGN KEY ("split_group_id") REFERENCES "public"."split_groups"("split_group_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_group_members"
    ADD CONSTRAINT "split_group_members_split_group_id_fkey" FOREIGN KEY ("split_group_id") REFERENCES "public"."split_groups"("split_group_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_group_members"
    ADD CONSTRAINT "split_group_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."split_groups"
    ADD CONSTRAINT "split_groups_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."split_groups"
    ADD CONSTRAINT "split_groups_group_icon_id_fkey" FOREIGN KEY ("group_icon_id") REFERENCES "public"."icons"("icon_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("category_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_split_group_id_fkey" FOREIGN KEY ("split_group_id") REFERENCES "public"."split_groups"("split_group_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."transactions"
    ADD CONSTRAINT "transactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("user_id") ON DELETE RESTRICT;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_profile_icon_id_fkey" FOREIGN KEY ("profile_icon_id") REFERENCES "public"."icons"("icon_id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE "public"."auth_providers" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "auth_providers_self" ON "public"."auth_providers" TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."categories" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "categories_delete" ON "public"."categories" FOR DELETE TO "authenticated" USING (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "categories_insert" ON "public"."categories" FOR INSERT TO "authenticated" WITH CHECK (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "categories_read" ON "public"."categories" FOR SELECT TO "authenticated" USING ((("created_by_user_id" IS NULL) OR ("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "categories_update" ON "public"."categories" FOR UPDATE TO "authenticated" USING (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."expense_splits" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "expense_splits_delete" ON "public"."expense_splits" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."transaction_id" = "expense_splits"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "expense_splits_insert" ON "public"."expense_splits" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."transaction_id" = "expense_splits"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "expense_splits_read" ON "public"."expense_splits" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."transaction_id" = "expense_splits"."transaction_id") AND (("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("t"."split_group_id" IS NOT NULL) AND "public"."is_group_member"("t"."split_group_id"))))))));



CREATE POLICY "expense_splits_update" ON "public"."expense_splits" FOR UPDATE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."transaction_id" = "expense_splits"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid")))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."transactions" "t"
  WHERE (("t"."transaction_id" = "expense_splits"."transaction_id") AND ("t"."user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "friendships_delete" ON "public"."friendships" FOR DELETE TO "authenticated" USING ((("user_id_1" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id_2" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "friendships_insert" ON "public"."friendships" FOR INSERT TO "authenticated" WITH CHECK (("action_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND ("user_id_2" <> ( SELECT "auth"."uid"() AS "uid")) AND ("user_id_1" = LEAST(( SELECT "auth"."uid"() AS "uid"), "user_id_2")) AND ("user_id_2" = GREATEST(( SELECT "auth"."uid"() AS "uid"), "user_id_2")) AND ("status" = 'pending'::"text"));



CREATE POLICY "friendships_read" ON "public"."friendships" FOR SELECT TO "authenticated" USING ((("user_id_1" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id_2" = ( SELECT "auth"."uid"() AS "uid"))));



CREATE POLICY "friendships_update" ON "public"."friendships" FOR UPDATE TO "authenticated" USING ((("user_id_1" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id_2" = ( SELECT "auth"."uid"() AS "uid"))) AND "status" = ANY (ARRAY['accepted'::"text", 'blocked'::"text"])) WITH CHECK ((("action_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("user_id_1" = ( SELECT "auth"."uid"() AS "uid")) OR ("user_id_2" = ( SELECT "auth"."uid"() AS "uid"))) AND "status" = ANY (ARRAY['accepted'::"text", 'blocked'::"text"])));



CREATE POLICY "group_members_delete" ON "public"."split_group_members" FOR DELETE TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (EXISTS ( SELECT 1
   FROM "public"."split_groups" "g"
  WHERE (("g"."split_group_id" = "split_group_members"."split_group_id") AND "public"."is_group_creator"("split_group_members"."split_group_id"))))));



CREATE POLICY "group_members_insert" ON "public"."split_group_members" FOR INSERT TO "authenticated" WITH CHECK (("split_group_members"."user_id" <> ( SELECT "auth"."uid"() AS "uid")) AND (EXISTS ( SELECT 1
   FROM "public"."split_groups" "g"
  WHERE (("g"."split_group_id" = "split_group_members"."split_group_id") AND "public"."is_group_creator"("split_group_members"."split_group_id")))) AND (EXISTS ( SELECT 1
   FROM "public"."friendships" "f"
  WHERE (("f"."status" = 'accepted'::"text") AND ("f"."user_id_1" = LEAST(( SELECT "auth"."uid"() AS "uid"), "split_group_members"."user_id")) AND ("f"."user_id_2" = GREATEST(( SELECT "auth"."uid"() AS "uid"), "split_group_members"."user_id"))))));



CREATE POLICY "group_members_read" ON "public"."split_group_members" FOR SELECT TO "authenticated" USING ("public"."is_group_member"("split_group_id"));



ALTER TABLE "public"."icons" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "icons_read" ON "public"."icons" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."settlement_allocations" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settlement_allocations_delete" ON "public"."settlement_allocations" FOR DELETE TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."settlements" "s"
  WHERE (("s"."settlement_id" = "settlement_allocations"."settlement_id") AND ("s"."payer_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "settlement_allocations_insert" ON "public"."settlement_allocations" FOR INSERT TO "authenticated" WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."settlements" "s"
  WHERE (("s"."settlement_id" = "settlement_allocations"."settlement_id") AND ("s"."payer_user_id" = ( SELECT "auth"."uid"() AS "uid"))))));



CREATE POLICY "settlement_allocations_read" ON "public"."settlement_allocations" FOR SELECT TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM "public"."settlements" "s"
  WHERE (("s"."settlement_id" = "settlement_allocations"."settlement_id") AND (("s"."payer_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("s"."payee_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("s"."split_group_id" IS NOT NULL) AND "public"."is_group_member"("s"."split_group_id")))))));



ALTER TABLE "public"."settlements" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "settlements_delete" ON "public"."settlements" FOR DELETE TO "authenticated" USING (("payer_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "settlements_insert" ON "public"."settlements" FOR INSERT TO "authenticated" WITH CHECK ((("payer_user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("split_group_id" IS NULL) OR "public"."is_group_member"("split_group_id"))));



CREATE POLICY "settlements_read" ON "public"."settlements" FOR SELECT TO "authenticated" USING ((("payer_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR ("payee_user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("split_group_id" IS NOT NULL) AND "public"."is_group_member"("split_group_id"))));



CREATE POLICY "settlements_update" ON "public"."settlements" FOR UPDATE TO "authenticated" USING (("payer_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("payer_user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."split_group_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."split_groups" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "split_groups_delete" ON "public"."split_groups" FOR DELETE TO "authenticated" USING (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "split_groups_insert" ON "public"."split_groups" FOR INSERT TO "authenticated" WITH CHECK (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "split_groups_read" ON "public"."split_groups" FOR SELECT TO "authenticated" USING ("public"."is_group_member"("split_group_id"));



CREATE POLICY "split_groups_update" ON "public"."split_groups" FOR UPDATE TO "authenticated" USING (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("created_by_user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."transactions" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "transactions_delete" ON "public"."transactions" FOR DELETE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "transactions_insert" ON "public"."transactions" FOR INSERT TO "authenticated" WITH CHECK ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) AND (("split_group_id" IS NULL) OR "public"."is_group_member"("split_group_id"))));



CREATE POLICY "transactions_read" ON "public"."transactions" FOR SELECT TO "authenticated" USING ((("user_id" = ( SELECT "auth"."uid"() AS "uid")) OR (("split_group_id" IS NOT NULL) AND "public"."is_group_member"("split_group_id"))));



CREATE POLICY "transactions_update" ON "public"."transactions" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "users_connections_read" ON "public"."users" FOR SELECT TO "authenticated" USING ("public"."can_view_profile"("user_id"));



CREATE POLICY "users_insert" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users_select" ON "public"."users" FOR SELECT TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



CREATE POLICY "users_update" ON "public"."users" FOR UPDATE TO "authenticated" USING (("user_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("user_id" = ( SELECT "auth"."uid"() AS "uid")));



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



REVOKE ALL ON FUNCTION "public"."can_view_profile"("p_profile_id" "uuid", "p_viewer_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."can_view_profile"("p_profile_id" "uuid", "p_viewer_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."can_view_profile"("p_profile_id" "uuid", "p_viewer_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."can_view_profile"("p_profile_id" "uuid", "p_viewer_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."check_settlement_allocations"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_settlement_allocations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_settlement_allocations"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_transaction_allocations"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_transaction_allocations"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_transaction_allocations"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."create_fintrack_group"("p_group_name" "text", "p_description" "text", "p_member_user_ids" "uuid"[]) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."create_fintrack_group"("p_group_name" "text", "p_description" "text", "p_member_user_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_fintrack_group"("p_group_name" "text", "p_description" "text", "p_member_user_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_fintrack_group"("p_group_name" "text", "p_description" "text", "p_member_user_ids" "uuid"[]) TO "service_role";



REVOKE ALL ON FUNCTION "public"."find_fintrack_user_by_email"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."find_fintrack_user_by_email"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."find_fintrack_user_by_email"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."find_fintrack_user_by_email"("p_email" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_new_auth_user"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_group_creator"("p_group_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_group_creator"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_creator"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_creator"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_group_member"("p_group_id" "uuid", "p_user_id" "uuid") TO "service_role";



REVOKE ALL ON FUNCTION "public"."list_fintrack_connections"() FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."list_fintrack_connections"() TO "anon";
GRANT ALL ON FUNCTION "public"."list_fintrack_connections"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."list_fintrack_connections"() TO "service_role";



REVOKE ALL ON FUNCTION "public"."record_fintrack_settlement"("p_counterparty_user_id" "uuid", "p_direction" "text", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_payment_method" "text", "p_settled_at" "date") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."record_fintrack_settlement"("p_counterparty_user_id" "uuid", "p_direction" "text", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_payment_method" "text", "p_settled_at" "date") TO "anon";
GRANT ALL ON FUNCTION "public"."record_fintrack_settlement"("p_counterparty_user_id" "uuid", "p_direction" "text", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_payment_method" "text", "p_settled_at" "date") TO "authenticated";
GRANT ALL ON FUNCTION "public"."record_fintrack_settlement"("p_counterparty_user_id" "uuid", "p_direction" "text", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_payment_method" "text", "p_settled_at" "date") TO "service_role";



REVOKE ALL ON FUNCTION "public"."request_fintrack_friend"("p_email" "text") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."request_fintrack_friend"("p_email" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."request_fintrack_friend"("p_email" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."request_fintrack_friend"("p_email" "text") TO "service_role";



REVOKE ALL ON FUNCTION "public"."respond_fintrack_friend_request"("p_other_user_id" "uuid", "p_accept" boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."respond_fintrack_friend_request"("p_other_user_id" "uuid", "p_accept" boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."respond_fintrack_friend_request"("p_other_user_id" "uuid", "p_accept" boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."respond_fintrack_friend_request"("p_other_user_id" "uuid", "p_accept" boolean) TO "service_role";



REVOKE ALL ON FUNCTION "public"."save_fintrack_transaction"("p_transaction_id" "uuid", "p_transaction_type" "text", "p_category_id" "uuid", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_description" "text", "p_transaction_date" "date", "p_splits" "jsonb") FROM PUBLIC;
GRANT ALL ON FUNCTION "public"."save_fintrack_transaction"("p_transaction_id" "uuid", "p_transaction_type" "text", "p_category_id" "uuid", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_description" "text", "p_transaction_date" "date", "p_splits" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."save_fintrack_transaction"("p_transaction_id" "uuid", "p_transaction_type" "text", "p_category_id" "uuid", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_description" "text", "p_transaction_date" "date", "p_splits" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."save_fintrack_transaction"("p_transaction_id" "uuid", "p_transaction_type" "text", "p_category_id" "uuid", "p_split_group_id" "uuid", "p_amount" numeric, "p_currency_code" "text", "p_description" "text", "p_transaction_date" "date", "p_splits" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."auth_providers" TO "anon";
GRANT ALL ON TABLE "public"."auth_providers" TO "authenticated";
GRANT ALL ON TABLE "public"."auth_providers" TO "service_role";



GRANT ALL ON TABLE "public"."categories" TO "anon";
GRANT ALL ON TABLE "public"."categories" TO "authenticated";
GRANT ALL ON TABLE "public"."categories" TO "service_role";



GRANT ALL ON TABLE "public"."expense_splits" TO "anon";
GRANT ALL ON TABLE "public"."expense_splits" TO "authenticated";
GRANT ALL ON TABLE "public"."expense_splits" TO "service_role";



GRANT ALL ON TABLE "public"."friendships" TO "anon";
GRANT ALL ON TABLE "public"."friendships" TO "authenticated";
GRANT ALL ON TABLE "public"."friendships" TO "service_role";



GRANT ALL ON TABLE "public"."icons" TO "anon";
GRANT ALL ON TABLE "public"."icons" TO "authenticated";
GRANT ALL ON TABLE "public"."icons" TO "service_role";



GRANT ALL ON TABLE "public"."settlement_allocations" TO "anon";
GRANT ALL ON TABLE "public"."settlement_allocations" TO "authenticated";
GRANT ALL ON TABLE "public"."settlement_allocations" TO "service_role";



GRANT ALL ON TABLE "public"."settlements" TO "anon";
GRANT ALL ON TABLE "public"."settlements" TO "authenticated";
GRANT ALL ON TABLE "public"."settlements" TO "service_role";
REVOKE INSERT ON TABLE "public"."settlements" FROM "anon";
REVOKE INSERT ON TABLE "public"."settlements" FROM "authenticated";



GRANT ALL ON TABLE "public"."split_group_members" TO "anon";
GRANT ALL ON TABLE "public"."split_group_members" TO "authenticated";
GRANT ALL ON TABLE "public"."split_group_members" TO "service_role";



GRANT ALL ON TABLE "public"."split_groups" TO "anon";
GRANT ALL ON TABLE "public"."split_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."split_groups" TO "service_role";



GRANT ALL ON TABLE "public"."transactions" TO "anon";
GRANT ALL ON TABLE "public"."transactions" TO "authenticated";
GRANT ALL ON TABLE "public"."transactions" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";


REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA "public" FROM "anon";
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA "public" FROM "anon";
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA "public" FROM "anon";
REVOKE INSERT ON TABLE "public"."settlements" FROM "anon", "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON TABLES FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON SEQUENCES FROM "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" REVOKE ALL ON FUNCTIONS FROM "anon";







