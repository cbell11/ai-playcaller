-- Add scout_card_url column to scout_cards table
alter table public.scout_cards
add column if not exists scout_card_url text;

-- Update existing rows to have a default value if needed
-- Uncomment if you want to set a default value for existing rows
-- update public.scout_cards
-- set scout_card_url = '' where scout_card_url is null;

-- Make the column required for future inserts if needed
-- Uncomment if you want to make the column required
-- alter table public.scout_cards
-- alter column scout_card_url set not null; 