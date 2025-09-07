-- Update the check constraint on help_videos table to include 'tips'
ALTER TABLE help_videos 
DROP CONSTRAINT IF EXISTS help_videos_video_type_check;

-- Add the updated constraint that includes 'tips'
ALTER TABLE help_videos 
ADD CONSTRAINT help_videos_video_type_check 
CHECK (video_type IN ('showcase', 'tutorial', 'tips'));

-- Add comment explaining the constraint
COMMENT ON CONSTRAINT help_videos_video_type_check ON help_videos IS 
'Ensures video_type is one of: showcase, tutorial, or tips'; 