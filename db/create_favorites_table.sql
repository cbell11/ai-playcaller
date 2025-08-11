-- Create the favorites table
CREATE TABLE IF NOT EXISTS favorites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL,
    play_id TEXT,
    combined_call TEXT NOT NULL,
    customized_edit TEXT,
    category TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    -- Add a unique constraint to prevent duplicate favorites for the same team and play
    UNIQUE(team_id, play_id, combined_call)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_favorites_team_id ON favorites(team_id);
CREATE INDEX IF NOT EXISTS idx_favorites_category ON favorites(category);
CREATE INDEX IF NOT EXISTS idx_favorites_created_at ON favorites(team_id, created_at);

-- DISABLE Row Level Security for now to test functionality
-- We can re-enable it later with proper policies
ALTER TABLE favorites DISABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can insert their own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can update their own favorites" ON favorites;
DROP POLICY IF EXISTS "Users can delete their own favorites" ON favorites;
DROP POLICY IF EXISTS "Allow viewing favorites by team_id" ON favorites;
DROP POLICY IF EXISTS "Allow inserting favorites" ON favorites;
DROP POLICY IF EXISTS "Allow updating favorites by team_id" ON favorites;
DROP POLICY IF EXISTS "Allow deleting favorites by team_id" ON favorites;

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists and recreate
DROP TRIGGER IF EXISTS update_favorites_updated_at ON favorites;
CREATE TRIGGER update_favorites_updated_at
    BEFORE UPDATE ON favorites
    FOR EACH ROW
    EXECUTE FUNCTION update_favorites_updated_at();

-- Comment on table and columns
COMMENT ON TABLE favorites IS 'Stores favorite plays for each team (RLS disabled for testing)';
COMMENT ON COLUMN favorites.team_id IS 'Reference to the team that owns this favorite';
COMMENT ON COLUMN favorites.play_id IS 'Reference to the original play ID';
COMMENT ON COLUMN favorites.combined_call IS 'The formatted play call text';
COMMENT ON COLUMN favorites.customized_edit IS 'Custom edits made to the play call';
COMMENT ON COLUMN favorites.category IS 'Play category (run_game, pass_game, etc.)';

-- Test the table with a simple insert (optional - you can remove this)
-- INSERT INTO favorites (team_id, play_id, combined_call, category) 
-- VALUES ('test-team-id', 'test-play-id', 'Test Play Call', 'test_category') 
-- ON CONFLICT (team_id, play_id, combined_call) DO NOTHING; 