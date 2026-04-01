-- Create profiles table for Clerk user sync
CREATE TABLE IF NOT EXISTS public.profiles (
  id TEXT PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  username TEXT UNIQUE,
  avatar_url TEXT,
  phone TEXT,
  bio TEXT,
  role TEXT DEFAULT 'member',
  mosque_id UUID,
  is_verified BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  last_seen_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON public.profiles(role);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Simple policies
CREATE POLICY "allow_all_select" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "allow_all_insert" ON public.profiles FOR INSERT WITH CHECK (true);
CREATE POLICY "allow_all_update" ON public.profiles FOR UPDATE USING (true);
