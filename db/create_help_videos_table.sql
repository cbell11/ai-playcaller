-- Create help_videos table
CREATE TABLE IF NOT EXISTS help_videos (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    title TEXT NOT NULL,
    loom_url TEXT NOT NULL,
    video_type TEXT NOT NULL CHECK (video_type IN ('showcase', 'tutorial')),
    position INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure unique position for active videos of the same type
    UNIQUE(video_type, position)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_help_videos_type_position ON help_videos(video_type, position);
CREATE INDEX IF NOT EXISTS idx_help_videos_active ON help_videos(is_active);

-- Enable Row Level Security
ALTER TABLE help_videos ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow everyone to view active videos
CREATE POLICY "Anyone can view active help videos" ON help_videos
    FOR SELECT USING (is_active = true);

-- Only admins can manage videos
CREATE POLICY "Admins can manage help videos" ON help_videos
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role = 'admin'
        )
    );

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_help_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER trigger_update_help_videos_updated_at
    BEFORE UPDATE ON help_videos
    FOR EACH ROW
    EXECUTE FUNCTION update_help_videos_updated_at();

-- Insert some default placeholder videos for admins to update
INSERT INTO help_videos (title, loom_url, video_type, position) VALUES
('Platform Overview', 'https://www.loom.com/embed/placeholder1', 'showcase', 1),
('Getting Started', 'https://www.loom.com/embed/placeholder2', 'tutorial', 1),
('Building Your Playbook', 'https://www.loom.com/embed/placeholder3', 'tutorial', 2),
('Creating Game Plans', 'https://www.loom.com/embed/placeholder4', 'tutorial', 3); 