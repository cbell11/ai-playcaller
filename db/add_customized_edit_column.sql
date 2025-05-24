-- Add customized_edit column to playpool table
ALTER TABLE playpool
ADD COLUMN customized_edit TEXT;

-- Add comment to explain the column's purpose
COMMENT ON COLUMN playpool.customized_edit IS 'Stores a custom edited version of the play that overrides the standard play compilation';

-- Update existing rows to have NULL in the new column
UPDATE playpool
SET customized_edit = NULL; 