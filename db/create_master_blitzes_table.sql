-- SQL to create master_blitzes table

-- Create master_blitzes table
CREATE TABLE IF NOT EXISTS master_blitzes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_master_blitzes_name ON master_blitzes(name);

-- Add some example blitzes (optional)
INSERT INTO master_blitzes (name) 
VALUES 
  ('Inside Fire'),
  ('Outside Dog'),
  ('Cross Dog'),
  ('Mike Blitz'),
  ('Will Blitz'),
  ('Sam Blitz'),
  ('Corner Fire'),
  ('Safety Blitz'),
  ('Nickel Fire'),
  ('Overload'),
  ('Double A Gap'),
  ('Zone Blitz')
ON CONFLICT (name) DO NOTHING;

-- Note: Execute this SQL in your Supabase SQL editor
-- This will create the master_blitzes table and add some example blitzes
-- The removeDefaultBlitzes function in app/actions/blitzes.ts will remove 
-- the default blitzes 'Inside', 'Outside', 'Corner', and 'Safety'
-- from both the table and the UI 