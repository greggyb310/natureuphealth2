/*
  # Add Custom Nature Locations

  1. New Table
    - `custom_nature_locations`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `description` (text, nullable)
      - `latitude` (double precision, required)
      - `longitude` (double precision, required)
      - `tags` (text array, default empty)
      - `created_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz, default now())

  2. Security
    - Enable RLS
    - All authenticated users can read custom locations (community-shared knowledge)
    - Users can insert locations they create
    - Creators can update/delete their own locations

  3. Purpose
    - Stores user-taught nature micro-spaces (office courtyards, hidden parks, etc.)
    - Serves as training data for location recommendations
    - Community-built database of accessible nature spots
*/

create table if not exists custom_nature_locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  latitude double precision not null,
  longitude double precision not null,
  tags text[] default '{}',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

alter table custom_nature_locations enable row level security;

create policy "Users can read all custom locations"
  on custom_nature_locations
  for select
  to authenticated
  using (true);

create policy "Users can insert custom locations"
  on custom_nature_locations
  for insert
  to authenticated
  with check (auth.uid() = created_by);

create policy "Users can update own custom locations"
  on custom_nature_locations
  for update
  to authenticated
  using (auth.uid() = created_by)
  with check (auth.uid() = created_by);

create policy "Users can delete own custom locations"
  on custom_nature_locations
  for delete
  to authenticated
  using (auth.uid() = created_by);

create index if not exists custom_nature_locations_lat_lng_idx 
  on custom_nature_locations (latitude, longitude);

create index if not exists custom_nature_locations_created_by_idx 
  on custom_nature_locations (created_by);
