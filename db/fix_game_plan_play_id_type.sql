-- Fix game_plan table to use TEXT for play_id instead of UUID
-- This allows it to properly store the text play_id from playpool table

-- First, let's see the current structure
-- SELECT column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name = 'game_plan' AND column_name = 'play_id';

-- Drop any foreign key constraints on play_id if they exist
ALTER TABLE game_plan DROP CONSTRAINT IF EXISTS game_plan_play_id_fkey;
ALTER TABLE game_plan DROP CONSTRAINT IF EXISTS fk_game_plan_play_id;

-- Change the play_id column from UUID to TEXT
ALTER TABLE game_plan ALTER COLUMN play_id TYPE TEXT;

-- Optional: Add a comment to clarify the purpose
COMMENT ON COLUMN game_plan.play_id IS 'Text identifier from playpool.play_id (not a UUID)';

-- Verify the change
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'game_plan' AND column_name = 'play_id'; 