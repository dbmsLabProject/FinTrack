-- A signed-in user must not be able to add themselves to an arbitrary group.
-- Group creation uses a SECURITY DEFINER RPC; later additions are made by the
-- group creator through the existing frontend flow.
DROP POLICY IF EXISTS "group_members_insert" ON public.split_group_members;

CREATE POLICY "group_members_insert"
  ON public.split_group_members
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.split_groups AS group_record
      WHERE group_record.split_group_id = split_group_members.split_group_id
        AND public.is_group_creator(group_record.split_group_id)
    )
  );
