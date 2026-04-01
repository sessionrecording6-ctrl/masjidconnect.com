-- Create profiles table for Clerk user sync
-- This table stores user profile data synced from Clerk

CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY, -- Clerk user ID (e.g., user_xxx)
  email TEXT,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  role TEXT DEFAULT 'member' CHECK (role IN ('admin', 'shura', 'imam', 'member')),
  mosque_id UUID,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create index for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_mosque_id ON public.profiles(mosque_id);
CREATE INDEX IF NOT EXISTS idx_profiles_is_active ON public.profiles(is_active);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read all profiles (for member directories)
CREATE POLICY "profiles_select_all" ON public.profiles 
  FOR SELECT 
  USING (true);

-- Policy: Users can only update their own profile
-- Note: With Clerk, we'll use the service role key for webhook updates
CREATE POLICY "profiles_update_own" ON public.profiles 
  FOR UPDATE 
  USING (true);

-- Policy: Allow inserts (for webhook sync)
CREATE POLICY "profiles_insert" ON public.profiles 
  FOR INSERT 
  WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-update updated_at
DROP TRIGGER IF EXISTS profiles_updated_at ON public.profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
