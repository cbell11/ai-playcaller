-- Drop the existing playpool table if it exists
DROP TABLE IF EXISTS playpool;

-- Recreate the playpool table with the correct columns
CREATE TABLE playpool (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    team_id UUID NOT NULL REFERENCES teams(id),
    opponent_id UUID REFERENCES opponents(id),
    play_id TEXT,
    shifts TEXT,
    to_motions TEXT,
    formations TEXT,
    tags TEXT,
    from_motions TEXT,
    pass_protections TEXT,
    concept TEXT,
    concept_tag TEXT,
    rpo_tag TEXT,
    category TEXT,
    third_s BOOLEAN DEFAULT false,
    third_m BOOLEAN DEFAULT false,
    third_l BOOLEAN DEFAULT false,
    rz BOOLEAN DEFAULT false,
    gl BOOLEAN DEFAULT false,
    front_beaters TEXT,
    coverage_beaters TEXT,
    blitz_beaters TEXT,
    notes TEXT,
    concept_direction TEXT,
    is_enabled BOOLEAN DEFAULT true,
    is_locked BOOLEAN DEFAULT false,
    is_favorite BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Add indexes for better query performance
CREATE INDEX playpool_team_id_idx ON playpool(team_id);
CREATE INDEX playpool_opponent_id_idx ON playpool(opponent_id);
CREATE INDEX playpool_category_idx ON playpool(category);

-- Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_playpool_updated_at
    BEFORE UPDATE ON playpool
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 