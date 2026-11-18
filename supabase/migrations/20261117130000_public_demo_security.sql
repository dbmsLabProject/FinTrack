-- Combined, repeatable security migration for the public demo project.
-- Includes the protections from the earlier group-membership and
-- friendship/settlement migrations, with accepted-friend checks for invites.
-- The browser uses authenticated sessions for all private reads and writes.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM anon;

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE ALL ON FUNCTIONS FROM anon;

DROP POLICY IF EXISTS "friendships_insert" ON public.friendships;
CREATE POLICY "friendships_insert"
  ON public.friendships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    action_user_id = (SELECT auth.uid())
    AND user_id_2 <> (SELECT auth.uid())
    AND user_id_1 = least((SELECT auth.uid()), user_id_2)
    AND user_id_2 = greatest((SELECT auth.uid()), user_id_2)
    AND status = 'pending'
  );

DROP POLICY IF EXISTS "friendships_update" ON public.friendships;
CREATE POLICY "friendships_update"
  ON public.friendships
  FOR UPDATE
  TO authenticated
  USING (
    (user_id_1 = (SELECT auth.uid()) OR user_id_2 = (SELECT auth.uid()))
    AND status IN ('accepted', 'blocked')
  )
  WITH CHECK (
    action_user_id = (SELECT auth.uid())
    AND (user_id_1 = (SELECT auth.uid()) OR user_id_2 = (SELECT auth.uid()))
    AND status IN ('accepted', 'blocked')
  );

DROP POLICY IF EXISTS "group_members_insert" ON public.split_group_members;
CREATE POLICY "group_members_insert"
  ON public.split_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    split_group_members.user_id <> (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.split_groups AS group_record
      WHERE group_record.split_group_id = split_group_members.split_group_id
        AND public.is_group_creator(group_record.split_group_id)
    )
    AND EXISTS (
      SELECT 1
      FROM public.friendships AS friend_record
      WHERE friend_record.status = 'accepted'
        AND friend_record.user_id_1 = least((SELECT auth.uid()), split_group_members.user_id)
        AND friend_record.user_id_2 = greatest((SELECT auth.uid()), split_group_members.user_id)
    )
  );

REVOKE EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_creator(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.list_fintrack_connections() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_fintrack_group(text, text, uuid[]) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_fintrack_user_by_email(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.record_fintrack_settlement(uuid, text, uuid, numeric, text, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.request_fintrack_friend(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.respond_fintrack_friend_request(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.save_fintrack_transaction(uuid, text, uuid, uuid, numeric, text, text, date, jsonb) FROM anon;
REVOKE INSERT ON TABLE public.settlements FROM anon, authenticated;

GRANT EXECUTE ON FUNCTION public.can_view_profile(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_creator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_group_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_fintrack_connections() TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_fintrack_group(text, text, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.find_fintrack_user_by_email(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_fintrack_settlement(uuid, text, uuid, numeric, text, text, date) TO authenticated;
GRANT EXECUTE ON FUNCTION public.request_fintrack_friend(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_fintrack_friend_request(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_fintrack_transaction(uuid, text, uuid, uuid, numeric, text, text, date, jsonb) TO authenticated;
