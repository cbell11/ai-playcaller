-- Add is_favorite column to the game_plan table
ALTER TABLE game_plan 
ADD COLUMN is_favorite BOOLEAN DEFAULT false;

-- Create an index for better query performance on the favorite column
CREATE INDEX IF NOT EXISTS idx_game_plan_is_favorite 
ON game_plan(team_id, opponent_id, is_favorite);

-- Comment on the new column
COMMENT ON COLUMN game_plan.is_favorite IS 'Whether this play is marked as a favorite by the user'; 