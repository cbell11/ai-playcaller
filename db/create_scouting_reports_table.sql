-- SQL to create scouting_reports table

-- Create scouting_reports table
CREATE TABLE IF NOT EXISTS scouting_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES opponents(id) ON DELETE CASCADE,
  fronts JSONB DEFAULT '[]'::jsonb,
  coverages JSONB DEFAULT '[]'::jsonb,
  blitzes JSONB DEFAULT '[]'::jsonb,
  fronts_pct JSONB DEFAULT '{}'::jsonb,
  coverages_pct JSONB DEFAULT '{}'::jsonb,
  blitz_pct JSONB DEFAULT '{}'::jsonb,
  overall_blitz_pct INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Create a unique constraint on team_id and opponent_id to ensure a team
  -- only has one scouting report per opponent
  UNIQUE(team_id, opponent_id)
);

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_scouting_reports_team_id ON scouting_reports(team_id);
CREATE INDEX IF NOT EXISTS idx_scouting_reports_opponent_id ON scouting_reports(opponent_id);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_scouting_report_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to automatically update the updated_at timestamp
CREATE TRIGGER trigger_update_scouting_report_updated_at
BEFORE UPDATE ON scouting_reports
FOR EACH ROW
EXECUTE FUNCTION update_scouting_report_updated_at();

-- Note: Execute this SQL in your Supabase SQL editor
-- This will create the scouting_reports table and necessary triggers 