-- Drop existing function and constraints
DROP FUNCTION IF EXISTS update_play_positions(uuid, uuid, text, integer, integer);
DROP FUNCTION IF EXISTS is_valid_section(text);
ALTER TABLE game_plan DROP CONSTRAINT IF EXISTS valid_section_check;
DROP TYPE IF EXISTS valid_section CASCADE;

-- Create a simple position update function without section validation
CREATE OR REPLACE FUNCTION update_play_positions(
    p_team_id uuid,
    p_opponent_id uuid,
    p_section text,
    p_old_pos integer,
    p_new_pos integer
) RETURNS void AS $$
DECLARE
    v_max_pos integer;
BEGIN
    -- Get the maximum position in the section
    SELECT COALESCE(MAX(position), -1)
    INTO v_max_pos
    FROM game_plan
    WHERE team_id = p_team_id
    AND opponent_id = p_opponent_id
    AND section = p_section;

    -- Move the play to a temporary position beyond the maximum
    UPDATE game_plan
    SET position = v_max_pos + 100
    WHERE team_id = p_team_id
    AND opponent_id = p_opponent_id
    AND section = p_section
    AND position = p_old_pos;

    -- Shift other plays
    IF p_new_pos < p_old_pos THEN
        -- Moving up: shift affected plays down
        UPDATE game_plan
        SET position = position + 1
        WHERE team_id = p_team_id
        AND opponent_id = p_opponent_id
        AND section = p_section
        AND position >= p_new_pos
        AND position < p_old_pos;
    ELSE
        -- Moving down: shift affected plays up
        UPDATE game_plan
        SET position = position - 1
        WHERE team_id = p_team_id
        AND opponent_id = p_opponent_id
        AND section = p_section
        AND position > p_old_pos
        AND position <= p_new_pos;
    END IF;

    -- Move play to final position
    UPDATE game_plan
    SET position = p_new_pos
    WHERE team_id = p_team_id
    AND opponent_id = p_opponent_id
    AND section = p_section
    AND position = v_max_pos + 100;
END;
$$ LANGUAGE plpgsql; 