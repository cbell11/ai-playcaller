-- First add the column as nullable
alter table public.scout_cards
add column team_id uuid references public.teams(id);

-- Create index for better query performance
create index idx_scout_cards_team_id on public.scout_cards(team_id);

-- Update existing records to use the default team_id
update public.scout_cards
set team_id = '8feef3dc-942f-4bc5-b526-0b39e14cb683'
where team_id is null;

-- Now make the column required and set the default value
alter table public.scout_cards
alter column team_id set not null,
alter column team_id set default '8feef3dc-942f-4bc5-b526-0b39e14cb683'; 