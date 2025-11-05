/*
  # Fix Database Function Security - Search Path Configuration
  
  This migration addresses the security warnings by properly configuring the search_path
  for database functions to prevent potential security vulnerabilities.
  
  ## Changes Made
  
  1. **update_updated_at_column() Function**
     - Added `SET search_path = public, pg_temp` to prevent mutable search_path vulnerability
     - This ensures the function always uses the correct schema and temporary tables safely
  
  2. **handle_new_user() Function**
     - Added `SET search_path = public, pg_temp` to prevent mutable search_path vulnerability
     - Already marked as SECURITY DEFINER, now has explicit search_path control
     - This prevents privilege escalation attacks through search_path manipulation
  
  ## Security Impact
  
  Without explicit search_path configuration, functions marked as SECURITY DEFINER could be 
  vulnerable to attacks where malicious users create objects in their own schema that shadow
  legitimate objects, potentially gaining elevated privileges or corrupting data.
  
  Setting `search_path = public, pg_temp` ensures:
  - Functions only look in the public schema and temporary tables
  - No risk of schema shadowing attacks
  - Consistent behavior regardless of caller's search_path settings
*/

-- Recreate update_updated_at_column with secure search_path
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER 
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate handle_new_user with secure search_path
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email)
  VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
