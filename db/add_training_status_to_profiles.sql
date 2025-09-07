-- Add has_seen_training column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS has_seen_training BOOLEAN DEFAULT FALSE;

-- Add comment for the new column
COMMENT ON COLUMN profiles.has_seen_training IS 'Tracks whether user has completed the initial training video';

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_has_seen_training ON profiles(has_seen_training); 