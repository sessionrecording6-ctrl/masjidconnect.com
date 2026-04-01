"use client";

import { createContext, useContext, useEffect, useState, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session, SupabaseClient } from "@supabase/supabase-js";

export type UserRole = "admin" | "shura" | "imam" | "member";

export interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  phone: string | null;
  bio: string | null;
  role: UserRole;
  mosque_id: string | null;
  is_verified: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  isAdmin: boolean;
  isShura: boolean;
  isImam: boolean;
  isMember: boolean;
  hasRole: (roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseError, setSupabaseError] = useState<string | null>(null);

  const supabase = useMemo<SupabaseClient | null>(() => {
    try {
      return createClient();
    } catch (error) {
      setSupabaseError(error instanceof Error ? error.message : "Failed to initialize Supabase");
      setLoading(false);
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string) => {
    if (!supabase) return null;
    
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      return null;
    }

    return data as Profile;
  }, [supabase]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      const profileData = await fetchProfile(user.id);
      setProfile(profileData);
    }
  }, [user, fetchProfile]);

  // Update user online status every 30 seconds
  useEffect(() => {
    if (!user) return;

    const updateStatus = async () => {
      try {
        await fetch('/api/users/status', { method: 'POST' });
      } catch (error) {
        console.error('Error updating status:', error);
      }
    };

    updateStatus();
    const interval = setInterval(updateStatus, 30000);

    return () => clearInterval(interval);
  }, [user]);

  // Initialize auth and listen for changes
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const initAuth = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          const profileData = await fetchProfile(currentSession.user.id);
          setProfile(profileData);
        }
      } catch (error) {
        console.error("Error initializing auth:", error);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          const profileData = await fetchProfile(newSession.user.id);
          setProfile(profileData);
        } else {
          setProfile(null);
        }

        if (event === "SIGNED_OUT") {
          setProfile(null);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, fetchProfile]);

  const signOut = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const hasRole = (roles: UserRole[]) => {
    if (!profile) return false;
    return roles.includes(profile.role);
  };

  const value: AuthContextType = {
    user,
    session,
    profile,
    loading,
    signOut,
    refreshProfile,
    isAdmin: profile?.role === "admin",
    isShura: profile?.role === "shura",
    isImam: profile?.role === "imam",
    isMember: profile?.role === "member",
    hasRole,
  };

  // Show error if Supabase failed to initialize
  if (supabaseError) {
    return (
      <AuthContext.Provider value={value}>
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center max-w-md">
            <h2 className="text-lg font-semibold text-destructive mb-2">Configuration Error</h2>
            <p className="text-sm text-muted-foreground">{supabaseError}</p>
          </div>
        </div>
      </AuthContext.Provider>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
