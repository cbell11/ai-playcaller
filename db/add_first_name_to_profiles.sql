-- Add first_name column to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS first_name TEXT;

-- Add comment for the new column
COMMENT ON COLUMN profiles.first_name IS 'User first name for display purposes';

-- Update RLS policies to include first_name in allowed columns (if needed)
-- The existing policies should automatically cover the new column 