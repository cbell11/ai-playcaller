-- SQL to create master_coverages table

-- Create master_coverages table
CREATE TABLE IF NOT EXISTS master_coverages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_coverages_name ON master_coverages(name);

-- Add some example coverages (optional)
INSERT INTO master_coverages (name) 
VALUES 
  ('Cover 0 Man'),
  ('Cover 1 Man Free'),
  ('Cover 2 Tampa'),
  ('Cover 2 Invert'),
  ('Cover 3 Sky'),
  ('Cover 3 Cloud'),
  ('Cover 4 Quarters'),
  ('Cover 6'),
  ('Cover 7')
ON CONFLICT (name) DO NOTHING;

-- Note: Execute this SQL in your Supabase SQL editor
-- This will create the master_coverages table and add some example coverages
-- The removeDefaultCoverages function in app/actions/coverages.ts will remove 
-- the default coverages 'Cover 0', 'Cover 1', 'Cover 2', 'Cover 3', and 'Cover 4'
-- from both the table and the UI 