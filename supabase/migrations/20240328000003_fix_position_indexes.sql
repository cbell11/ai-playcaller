-- First, drop all overlapping indexes
DROP INDEX IF EXISTS idx_game_plan_position;
DROP INDEX IF EXISTS idx_game_plan_section_position;

-- Create a new function to handle position updates
CREATE OR REPLACE FUNCTION update_play_positions(
    p_team_id uuid,
    p_opponent_id uuid,
    p_section text,
    p_old_pos integer,
    p_new_pos integer
) RETURNS void AS $$
BEGIN
    -- Step 1: Update all positions in a single transaction
    IF p_new_pos < p_old_pos THEN
        -- Moving up: increment positions of plays in between
        UPDATE game_plan
        SET position = position + 1
        WHERE team_id = p_team_id
        AND opponent_id = p_opponent_id
        AND section = p_section
        AND position >= p_new_pos
        AND position < p_old_pos;
    ELSE
        -- Moving down: decrement positions of plays in between
        UPDATE game_plan
        SET position = position - 1
        WHERE team_id = p_team_id
        AND opponent_id = p_opponent_id
        AND section = p_section
        AND position > p_old_pos
        AND position <= p_new_pos;
    END IF;

    -- Step 2: Set the final position of the moved play
    UPDATE game_plan
    SET position = p_new_pos
    WHERE team_id = p_team_id
    AND opponent_id = p_opponent_id
    AND section = p_section
    AND position = p_old_pos;
END;
$$ LANGUAGE plpgsql;

-- Create a new index for position that allows duplicates during updates
CREATE INDEX idx_game_plan_section_position ON game_plan (team_id, opponent_id, section, position);

-- Add a trigger to maintain position order
CREATE OR REPLACE FUNCTION maintain_position_order() RETURNS TRIGGER AS $$
BEGIN
    -- Normalize positions to be sequential (0, 1, 2, etc.)
    WITH ranked AS (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY team_id, opponent_id, section 
                ORDER BY position
            ) - 1 as new_position
        FROM game_plan
        WHERE team_id = NEW.team_id
        AND opponent_id = NEW.opponent_id
        AND section = NEW.section
    )
    UPDATE game_plan gp
    SET position = ranked.new_position
    FROM ranked
    WHERE gp.id = ranked.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_maintain_position_order
AFTER INSERT OR UPDATE OF position ON game_plan
FOR EACH ROW
EXECUTE FUNCTION maintain_position_order(); 