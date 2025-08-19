-- Ensure position column exists and is properly configured
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'game_plan' 
                   AND column_name = 'position') THEN
        ALTER TABLE game_plan ADD COLUMN position integer DEFAULT 0;
    END IF;
END $$;

-- Drop any existing indexes or constraints that might conflict
DROP INDEX IF EXISTS game_plan_position_unique_idx;
DROP INDEX IF EXISTS idx_game_plan_position;

-- Create a new index that ensures unique positions within each section/team/opponent combination
CREATE UNIQUE INDEX idx_game_plan_position ON game_plan (team_id, opponent_id, section, position)
WHERE position IS NOT NULL;

-- Function to handle position updates during drag and drop
CREATE OR REPLACE FUNCTION update_play_positions(
    p_team_id uuid,
    p_opponent_id uuid,
    p_section text,
    p_old_pos integer,
    p_new_pos integer
) RETURNS void AS $$
BEGIN
    -- Step 1: Temporarily move the dragged play out of the way (to a very high number)
    UPDATE game_plan
    SET position = 999999
    WHERE team_id = p_team_id
        AND opponent_id = p_opponent_id
        AND section = p_section
        AND position = p_old_pos;

    -- Step 2: Shift other plays' positions
    IF p_new_pos < p_old_pos THEN
        -- Moving a play up - shift affected plays down
        UPDATE game_plan
        SET position = position + 1
        WHERE team_id = p_team_id
            AND opponent_id = p_opponent_id
            AND section = p_section
            AND position >= p_new_pos
            AND position < p_old_pos;
    ELSE
        -- Moving a play down - shift affected plays up
        UPDATE game_plan
        SET position = position - 1
        WHERE team_id = p_team_id
            AND opponent_id = p_opponent_id
            AND section = p_section
            AND position > p_old_pos
            AND position <= p_new_pos;
    END IF;

    -- Step 3: Move the play to its final position
    UPDATE game_plan
    SET position = p_new_pos
    WHERE team_id = p_team_id
        AND opponent_id = p_opponent_id
        AND section = p_section
        AND position = 999999;
END;
$$ LANGUAGE plpgsql; 