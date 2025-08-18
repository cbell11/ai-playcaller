-- Modify scout_cards table to allow null values for coverage
alter table public.scout_cards
alter column coverage drop not null; 