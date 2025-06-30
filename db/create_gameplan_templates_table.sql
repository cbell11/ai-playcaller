-- Create the gameplan_templates table
CREATE TABLE gameplan_templates (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    opponent_id UUID REFERENCES opponents(id) ON DELETE SET NULL,
    template_name VARCHAR(255) NOT NULL,
    template_type VARCHAR(50) NOT NULL DEFAULT 'custom',
    is_default BOOLEAN DEFAULT false,
    card_title VARCHAR(100) NOT NULL,
    card_enabled BOOLEAN DEFAULT true,
    card_order INTEGER NOT NULL,
    card_size INTEGER DEFAULT 8,
    card_bg_color VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    
    -- Add a unique constraint to prevent duplicate cards within the same template
    UNIQUE(team_id, template_name, card_title),
    
    -- Add a check constraint to validate template_type
    CONSTRAINT valid_template_type CHECK (template_type IN ('default', 'custom')),
    
    -- Add a check constraint to validate card_size
    CONSTRAINT valid_card_size CHECK (card_size BETWEEN 1 AND 20)
);

-- Add RLS policies
ALTER TABLE gameplan_templates ENABLE ROW LEVEL SECURITY;

-- Policy for selecting templates
CREATE POLICY "Users can view their own templates"
ON gameplan_templates
FOR SELECT
USING (auth.uid() = team_id);

-- Policy for inserting templates
CREATE POLICY "Users can insert their own templates"
ON gameplan_templates
FOR INSERT
WITH CHECK (auth.uid() = team_id);

-- Policy for updating templates
CREATE POLICY "Users can update their own templates"
ON gameplan_templates
FOR UPDATE
USING (auth.uid() = team_id)
WITH CHECK (auth.uid() = team_id);

-- Policy for deleting templates
CREATE POLICY "Users can delete their own templates"
ON gameplan_templates
FOR DELETE
USING (auth.uid() = team_id);

-- Create an index on commonly queried columns
CREATE INDEX idx_gameplan_templates_team_opponent 
ON gameplan_templates(team_id, opponent_id);

-- Create an index for ordering
CREATE INDEX idx_gameplan_templates_order 
ON gameplan_templates(team_id, template_name, card_order);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_gameplan_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_gameplan_templates_updated_at
    BEFORE UPDATE ON gameplan_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_gameplan_templates_updated_at();

-- Comment on table and columns
COMMENT ON TABLE gameplan_templates IS 'Stores game plan template configurations for each team';
COMMENT ON COLUMN gameplan_templates.template_name IS 'Name of the template configuration';
COMMENT ON COLUMN gameplan_templates.template_type IS 'Type of template (default or custom)';
COMMENT ON COLUMN gameplan_templates.is_default IS 'Whether this is the default template for the team';
COMMENT ON COLUMN gameplan_templates.card_title IS 'Title of the game plan section card';
COMMENT ON COLUMN gameplan_templates.card_enabled IS 'Whether the card is visible in the game plan';
COMMENT ON COLUMN gameplan_templates.card_order IS 'Order of the card in the game plan';
COMMENT ON COLUMN gameplan_templates.card_size IS 'Number of play slots in the card (1-20)';
COMMENT ON COLUMN gameplan_templates.card_bg_color IS 'Background color class for the card'; 