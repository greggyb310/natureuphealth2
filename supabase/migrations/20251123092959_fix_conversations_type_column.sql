/*
  # Fix conversations type column constraint

  The conversations table has both 'type' and 'assistant_type' columns.
  Since we're transitioning to use 'assistant_type', we need to:
  1. Make 'type' column nullable
  2. Set a default value based on assistant_type for backward compatibility

  ## Changes
  - Make type column nullable
  - Add a default value for type column
*/

-- Drop the NOT NULL constraint on type column
ALTER TABLE conversations ALTER COLUMN type DROP NOT NULL;

-- Set default value for existing records where type is null
UPDATE conversations
SET type = CASE
  WHEN assistant_type = 'health_coach' THEN 'wellness_coaching'
  WHEN assistant_type = 'excursion_creator' THEN 'excursion_creation'
  ELSE 'wellness_coaching'
END
WHERE type IS NULL;
