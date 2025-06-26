-- First, drop any existing policies
DROP POLICY IF EXISTS "Allow authenticated users to view master plays" ON master_play_pool;
DROP POLICY IF EXISTS "Allow admins to insert master plays" ON master_play_pool;
DROP POLICY IF EXISTS "Allow admins to update master plays" ON master_play_pool;
DROP POLICY IF EXISTS "Allow admins to delete master plays" ON master_play_pool;

-- Enable RLS on the master_play_pool table
ALTER TABLE master_play_pool ENABLE ROW LEVEL SECURITY;

-- Policy for viewing plays (all authenticated users)
CREATE POLICY "Allow authenticated users to view master plays"
ON master_play_pool
FOR SELECT
TO authenticated
USING (true);

-- Policy for inserting plays (admin only)
CREATE POLICY "Allow admins to insert master plays"
ON master_play_pool
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy for updating plays (admin only)
CREATE POLICY "Allow admins to update master plays"
ON master_play_pool
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
);

-- Policy for deleting plays (admin only)
CREATE POLICY "Allow admins to delete master plays"
ON master_play_pool
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles
    WHERE profiles.id = auth.uid()
    AND profiles.role = 'admin'
  )
); 