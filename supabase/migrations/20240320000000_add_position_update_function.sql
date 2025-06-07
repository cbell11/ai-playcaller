-- Create a function to update game plan positions atomically
CREATE OR REPLACE FUNCTION update_game_plan_positions(
  p_team_id TEXT,
  p_opponent_id TEXT,
  p_section TEXT,
  p_old_positions INT[],
  p_new_positions INT[]
) RETURNS void AS $$
DECLARE
  i INT;
  play_id TEXT;
BEGIN
  -- Validate input arrays have same length
  IF array_length(p_old_positions, 1) != array_length(p_new_positions, 1) THEN
    RAISE EXCEPTION 'Position arrays must have same length';
  END IF;

  -- Start a transaction block
  BEGIN
    -- Loop through the position arrays
    FOR i IN 1..array_length(p_old_positions, 1) LOOP
      -- Get the play_id for the current position
      SELECT id INTO play_id
      FROM game_plan
      WHERE team_id = p_team_id
        AND opponent_id = p_opponent_id
        AND section = p_section
        AND position = p_old_positions[i];

      -- Update the position if play exists
      IF play_id IS NOT NULL THEN
        UPDATE game_plan
        SET position = p_new_positions[i]
        WHERE id = play_id;
      END IF;
    END LOOP;
  END;
END;
$$ LANGUAGE plpgsql; 