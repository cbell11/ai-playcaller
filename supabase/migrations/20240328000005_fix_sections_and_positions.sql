-- Drop existing function
DROP FUNCTION IF EXISTS update_play_positions(uuid, uuid, text, integer, integer);

-- Create type for valid sections
DO $$ BEGIN
    DROP TYPE IF EXISTS valid_section CASCADE;
    CREATE TYPE valid_section AS ENUM (
        'twopointplays',
        'basepackage3',
        'openingscript',
        '4-2overbeaters',
        'lowredzone',
        'screens',
        'backedup',
        'thirdandshort',
        'firstsecondcombos',
        'goalline',
        'shortyardage',
        'basepackage1',
        'deepshots',
        'thirdandmedium',
        '4beaters',
        'highredzone',
        'playaction',
        '4-2underbeaters',
        'twominutedrill',
        '2beaters',
        'firstdowns',
        '1beaters',
        'bearbeaters',
        'basepackage2',
        'thirdandlong'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create function to validate section name
CREATE OR REPLACE FUNCTION is_valid_section(p_section text) RETURNS boolean AS $$
BEGIN
    -- Check if the section is a valid static section or matches dynamic pattern
    RETURN p_section::valid_section IS NOT NULL OR
           p_section ~ '^[0-9]+(beaters|overbeaters|underbeaters)$' OR
           p_section ~ '^[a-z]+(beaters)$';
END;
$$ LANGUAGE plpgsql;

-- Create the position update function with section validation
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
    -- Validate section name
    IF NOT is_valid_section(p_section) THEN
        RAISE EXCEPTION 'Invalid section name: %', p_section;
    END IF;

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

-- Add constraint to validate section names
ALTER TABLE game_plan DROP CONSTRAINT IF EXISTS valid_section_check;
ALTER TABLE game_plan ADD CONSTRAINT valid_section_check 
    CHECK (is_valid_section(section)); 