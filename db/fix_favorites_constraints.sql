-- Remove the foreign key constraint on team_id that's causing the error
-- This allows any team_id value without requiring it to exist in auth.users

-- First, let's see what constraints exist (run this to check)
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'favorites';

-- Drop the foreign key constraint if it exists
-- The constraint name might be different, so we'll try common variations
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_team_id_fkey;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS fk_favorites_team_id;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_team_id_fkey1;

-- Also remove any other potential foreign key constraints
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT constraint_name FROM information_schema.table_constraints 
              WHERE table_name = 'favorites' 
              AND constraint_type = 'FOREIGN KEY' 
              AND constraint_name LIKE '%team_id%')
    LOOP
        EXECUTE 'ALTER TABLE favorites DROP CONSTRAINT ' || r.constraint_name;
    END LOOP;
END $$;

-- Verify the constraints are removed
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'favorites' AND constraint_type = 'FOREIGN KEY';

-- Optional: If you want to see all remaining constraints
-- SELECT constraint_name, constraint_type 
-- FROM information_schema.table_constraints 
-- WHERE table_name = 'favorites'; 