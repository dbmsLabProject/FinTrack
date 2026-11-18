-- Pending requests are accepted/rejected only through the validated RPC.
-- Direct updates remain available for block/unblock on established links.
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

-- Settlement creation must use record_fintrack_settlement, which validates
-- authentication, counterparty relationship, and group membership.
REVOKE INSERT ON TABLE public.settlements FROM anon, authenticated;
