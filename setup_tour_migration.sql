-- Add setup_tour_complete column to profiles table
-- This tracks whether a user has completed the setup tour

ALTER TABLE profiles 
ADD COLUMN setup_tour_complete BOOLEAN DEFAULT FALSE;

-- Optional: Add an index for better query performance
CREATE INDEX idx_profiles_setup_tour_complete ON profiles(setup_tour_complete);

-- Optional: Update existing users to have the default value explicitly set
UPDATE profiles 
SET setup_tour_complete = FALSE 
WHERE setup_tour_complete IS NULL;
