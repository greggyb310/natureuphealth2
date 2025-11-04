/*
  # Create Excursions and Favorites Tables

  1. New Tables
    - `excursions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `title` (text)
      - `description` (text)
      - `location` (jsonb) - Contains {lat, lng, address}
      - `route_data` (jsonb) - Array of waypoints for the route
      - `duration_minutes` (integer)
      - `difficulty_level` (text) - Easy, Moderate, Challenging
      - `activities` (text[]) - Array of activity types
      - `weather_conditions` (jsonb) - Weather data when created
      - `created_at` (timestamptz)
      - `completed_at` (timestamptz) - When user completed it
      - `rating` (integer, 1-5) - User rating after completion

    - `favorite_excursions`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `excursion_id` (uuid, references excursions)
      - `created_at` (timestamptz)
      - Unique constraint on (user_id, excursion_id)

  2. Security
    - Enable RLS on both tables
    - Users can only view, create, and update their own excursions
    - Users can only manage their own favorites
    - Prevent duplicate favorites with unique constraint
*/

-- Create excursions table
CREATE TABLE IF NOT EXISTS excursions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  description text,
  location jsonb NOT NULL,
  route_data jsonb,
  duration_minutes integer,
  difficulty_level text CHECK (difficulty_level IN ('Easy', 'Moderate', 'Challenging')),
  activities text[],
  weather_conditions jsonb,
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  rating integer CHECK (rating >= 1 AND rating <= 5)
);

-- Create favorite_excursions table
CREATE TABLE IF NOT EXISTS favorite_excursions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  excursion_id uuid REFERENCES excursions(id) ON DELETE CASCADE NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, excursion_id)
);

-- Enable RLS
ALTER TABLE excursions ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorite_excursions ENABLE ROW LEVEL SECURITY;

-- Excursions policies
CREATE POLICY "Users can view own excursions"
  ON excursions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own excursions"
  ON excursions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own excursions"
  ON excursions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own excursions"
  ON excursions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Favorite excursions policies
CREATE POLICY "Users can view own favorites"
  ON favorite_excursions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own favorites"
  ON favorite_excursions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own favorites"
  ON favorite_excursions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS excursions_user_id_idx ON excursions(user_id);
CREATE INDEX IF NOT EXISTS excursions_created_at_idx ON excursions(created_at DESC);
CREATE INDEX IF NOT EXISTS favorite_excursions_user_id_idx ON favorite_excursions(user_id);
CREATE INDEX IF NOT EXISTS favorite_excursions_excursion_id_idx ON favorite_excursions(excursion_id);