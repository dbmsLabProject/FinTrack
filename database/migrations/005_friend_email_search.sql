-- Search one exact email at a time. This does not expose a user directory and
-- never returns the matched account's email address to the caller.
create or replace function public.find_fintrack_user_by_email(p_email text)
returns table (other_user_id uuid, full_name text)
language plpgsql stable security definer set search_path = '' as $$
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
revoke all on function public.find_fintrack_user_by_email(text) from public;
grant execute on function public.find_fintrack_user_by_email(text) to authenticated;