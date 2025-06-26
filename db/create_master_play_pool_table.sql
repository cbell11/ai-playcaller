-- SQL to create master_play_pool table

-- Create master_play_pool table
CREATE TABLE IF NOT EXISTS master_play_pool (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    play_id INTEGER,
    shifts TEXT,
    to_motions TEXT,
    formations TEXT,
    tags TEXT,
    from_motions TEXT,
    pass_protections TEXT,
    concept TEXT NOT NULL,
    concept_tag TEXT,
    rpo_tag TEXT,
    category TEXT NOT NULL,
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW())
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS master_play_pool_category_idx ON master_play_pool(category);
CREATE INDEX IF NOT EXISTS master_play_pool_concept_idx ON master_play_pool(concept);
CREATE INDEX IF NOT EXISTS master_play_pool_formations_idx ON master_play_pool(formations);

-- Add a trigger to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_master_play_pool_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_master_play_pool_updated_at
    BEFORE UPDATE ON master_play_pool
    FOR EACH ROW
    EXECUTE FUNCTION update_master_play_pool_updated_at(); 