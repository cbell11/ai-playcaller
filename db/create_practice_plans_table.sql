-- Create the handle_updated_at() function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the practice_plans table to store practice scripts
CREATE TABLE public.practice_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  opponent_id UUID NOT NULL REFERENCES public.opponents(id) ON DELETE CASCADE,
  sections JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- Ensure only one practice plan per team/opponent combination
  CONSTRAINT unique_practice_plan_per_team_opponent UNIQUE (team_id, opponent_id)
);

-- Add a comment to describe the table's purpose
COMMENT ON TABLE public.practice_plans IS 'Stores practice plans, which are collections of plays organized into sections for a specific team against a specific opponent.';

-- Re-use the existing function to update the updated_at timestamp
CREATE TRIGGER on_practice_plans_updated
  BEFORE UPDATE ON public.practice_plans
  FOR EACH ROW
  EXECUTE PROCEDURE public.handle_updated_at();

-- Enable Row Level Security
ALTER TABLE public.practice_plans ENABLE ROW LEVEL SECURITY;

-- Define RLS policies for practice_plans
CREATE POLICY "Allow team members to view their own practice plans"
  ON public.practice_plans FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.team_id = practice_plans.team_id));

CREATE POLICY "Allow team members to create practice plans for their team"
  ON public.practice_plans FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.team_id = practice_plans.team_id));

CREATE POLICY "Allow team members to update their own practice plans"
  ON public.practice_plans FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.team_id = practice_plans.team_id));

CREATE POLICY "Allow team members to delete their own practice plans"
  ON public.practice_plans FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.team_id = practice_plans.team_id)); 