-- Create scout_cards table
create table if not exists public.scout_cards (
    id uuid default gen_random_uuid() primary key,
    front text not null,
    coverage text,  -- Allow null values
    blitz text,     -- Allow null values
    image_url text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable Row Level Security (RLS)
alter table public.scout_cards enable row level security;

-- Create updated_at trigger
create or replace function public.handle_updated_at()
returns trigger
language plpgsql
security definer
as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$;

-- Create trigger for updated_at
create trigger handle_scout_cards_updated_at
    before update on public.scout_cards
    for each row
    execute function public.handle_updated_at();

-- Create policy to allow all authenticated users to read scout_cards
create policy "Allow authenticated users to read scout_cards"
    on public.scout_cards
    for select
    to authenticated
    using (true);

-- Create policy to allow authenticated users to insert scout_cards
create policy "Allow authenticated users to insert scout_cards"
    on public.scout_cards
    for insert
    to authenticated
    with check (true);

-- Create policy to allow authenticated users to update their scout_cards
create policy "Allow authenticated users to update scout_cards"
    on public.scout_cards
    for update
    to authenticated
    using (true)
    with check (true);

-- Create policy to allow authenticated users to delete scout_cards
create policy "Allow authenticated users to delete scout_cards"
    on public.scout_cards
    for delete
    to authenticated
    using (true); 