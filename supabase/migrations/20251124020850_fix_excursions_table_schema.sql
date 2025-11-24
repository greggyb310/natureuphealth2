/*
  # Fix Excursions Table Schema

  1. Changes
    - Rename `title` column to `name` (if exists)
    - Rename `route_data` column to `excursion_data` (if exists)  
    - Rename `location` column and split into `latitude` and `longitude` (if exists)
    - Add `user_id` column if missing (required for RLS)
    - Add `address` column if missing
    - Ensure all required columns exist with proper types

  2. Security
    - RLS policies already exist, will work with user_id column
*/

-- Add user_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE excursions ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add address column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'address'
  ) THEN
    ALTER TABLE excursions ADD COLUMN address text;
  END IF;
END $$;

-- Rename title to name if title exists and name doesn't
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'title'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'name'
  ) THEN
    ALTER TABLE excursions RENAME COLUMN title TO name;
  END IF;
END $$;

-- Rename route_data to excursion_data if route_data exists and excursion_data doesn't
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'route_data'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'excursion_data'
  ) THEN
    ALTER TABLE excursions RENAME COLUMN route_data TO excursion_data;
  END IF;
END $$;

-- Add latitude/longitude if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'latitude'
  ) THEN
    ALTER TABLE excursions ADD COLUMN latitude double precision;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'longitude'
  ) THEN
    ALTER TABLE excursions ADD COLUMN longitude double precision;
  END IF;
END $$;

-- Migrate location jsonb to latitude/longitude if location column exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'excursions' AND column_name = 'location'
  ) THEN
    UPDATE excursions
    SET 
      latitude = COALESCE((location->>'lat')::double precision, (location->>'latitude')::double precision),
      longitude = COALESCE((location->>'lng')::double precision, (location->>'longitude')::double precision),
      address = location->>'address'
    WHERE location IS NOT NULL;
    
    ALTER TABLE excursions DROP COLUMN location;
  END IF;
END $$;