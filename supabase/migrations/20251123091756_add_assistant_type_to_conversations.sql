/*
  # Add assistant_type column to conversations table

  This migration adds the assistant_type column to match the expected schema
  used by the excursion-engine edge function.

  ## Changes
  - Add assistant_type column to conversations table
  - Populate assistant_type based on existing type column
  - Add constraint to validate assistant_type values
*/

-- Add assistant_type column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'assistant_type'
  ) THEN
    ALTER TABLE conversations ADD COLUMN assistant_type text;
  END IF;
END $$;

-- Populate assistant_type from existing type column
UPDATE conversations
SET assistant_type = CASE
  WHEN type = 'wellness_coaching' THEN 'health_coach'
  WHEN type = 'excursion_creation' THEN 'excursion_creator'
  ELSE 'health_coach'
END
WHERE assistant_type IS NULL;

-- Make assistant_type NOT NULL
ALTER TABLE conversations ALTER COLUMN assistant_type SET NOT NULL;

-- Drop existing constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'conversations_assistant_type_check'
  ) THEN
    ALTER TABLE conversations DROP CONSTRAINT conversations_assistant_type_check;
  END IF;
END $$;

-- Add constraint to validate assistant_type values
ALTER TABLE conversations
ADD CONSTRAINT conversations_assistant_type_check
CHECK (assistant_type IN ('health_coach', 'excursion_creator'));

-- Create index for efficient lookups by assistant_type
CREATE INDEX IF NOT EXISTS idx_conversations_assistant_type ON conversations(assistant_type);
