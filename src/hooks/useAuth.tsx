import { useState, useEffect, createContext, useContext, ReactNode, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { logEventDirect } from '@/hooks/useEventLog';

type UserRole = 'admin' | 'agent' | 'viewer' | null;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: UserRole;
  customRoleName: string | null;
  isLoading: boolean;
  isBlocked: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  checkBlockedStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_TIMEOUT_MS = 5000; // 5 seconds timeout

async function fetchRole(userId: string): Promise<UserRole> {
  console.log('[Auth] Fetching role for UID:', userId);
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.warn('[Auth] Error fetching role:', error.message);
    return 'agent'; // Default to agent on error
  }
  
  const role = (data?.role as UserRole) ?? 'agent';
  console.log('[Auth] Role loaded:', role);
  return role;
}

async function fetchCustomRoleName(userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('custom_role_name')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[Auth] Error fetching custom_role_name:', error.message);
    return null;
  }
  return data?.custom_role_name ?? null;
}

async function fetchBlockedStatus(userId: string): Promise<boolean> {
  console.log('[Auth] Checking blocked status for UID:', userId);
  const { data, error } = await supabase
    .from('profiles')
    .select('is_blocked')
    .eq('user_id', userId)
    .maybeSingle();
  
  if (error) {
    console.warn('[Auth] Error checking blocked status:', error.message);
    return false;
  }
  
  const isBlocked = data?.is_blocked ?? false;
  console.log('[Auth] Blocked status:', isBlocked);
  return isBlocked;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRole] = useState<UserRole>(null);
  const [customRoleName, setCustomRoleName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBlocked, setIsBlocked] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  const { toast } = useToast();

  // Function to check and handle blocked status
  const checkBlockedStatus = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    
    const blocked = await fetchBlockedStatus(user.id);
    setIsBlocked(blocked);
    
    if (blocked) {
      console.log('[Auth] User is blocked, signing out...');
      toast({
        title: 'Доступ заблокирован',
        description: 'Ваш аккаунт заблокирован администратором. Обратитесь к руководству.',
        variant: 'destructive',
      });
      await supabase.auth.signOut();
      return true;
    }
    return false;
  }, [user, toast]);

  // Realtime listener for instant block detection
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`block-watch-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).is_blocked === true) {
            console.log('[Auth] Realtime: user blocked, signing out immediately');
            toast({
              title: 'Сессия завершена',
              description: 'Ваш аккаунт заблокирован администратором. Сессия завершена.',
              variant: 'destructive',
            });
            setIsBlocked(true);
            supabase.auth.signOut();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, toast]);

  useEffect(() => {
    isMountedRef.current = true;

    // Set a timeout to force end loading after 5 seconds
    timeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && isLoading) {
        console.warn('[Auth] Timeout reached, forcing loading state to false');
        setIsLoading(false);
        // If no role determined but we have a user, default to agent
        if (user && !userRole) {
          setUserRole('agent');
        }
      }
    }, AUTH_TIMEOUT_MS);

    const init = async () => {
      try {
        console.log('[Auth] Initializing auth...');
        
        // 1) Get initial session
        const { data, error } = await supabase.auth.getSession();
        if (!isMountedRef.current) return;
        
        if (error) {
          console.error('[Auth] getSession error:', error);
          setIsLoading(false);
          return;
        }

        const nextSession = data.session ?? null;
        setSession(nextSession);
        setUser(nextSession?.user ?? null);

        if (nextSession?.user) {
          console.log('[Auth] Session detected for user:', nextSession.user.email);
          
          // Check if user is blocked FIRST
          const blocked = await fetchBlockedStatus(nextSession.user.id);
          if (blocked) {
            console.log('[Auth] User is blocked, signing out...');
            if (isMountedRef.current) {
              setIsBlocked(true);
              toast({
                title: 'Доступ заблокирован',
                description: 'Ваш аккаунт заблокирован администратором. Обратитесь к руководству.',
                variant: 'destructive',
              });
            }
            await supabase.auth.signOut();
            return;
          }
          
          // Fetch role and custom_role_name - don't block on failure
          try {
            const [role, crn] = await Promise.all([
              fetchRole(nextSession.user.id),
              fetchCustomRoleName(nextSession.user.id),
            ]);
            if (isMountedRef.current) {
              setUserRole(role);
              setCustomRoleName(crn);
              setIsBlocked(false);
            }
          } catch (err) {
            console.error('[Auth] fetchRole error:', err);
            if (isMountedRef.current) {
              setUserRole('agent'); // Default to agent on error
            }
          }
        } else {
          console.log('[Auth] No session found');
          setUserRole(null);
          setCustomRoleName(null);
          setIsBlocked(false);
        }
      } catch (err) {
        console.error('[Auth] Init error:', err);
        if (isMountedRef.current) {
          setSession(null);
          setUser(null);
          setUserRole(null);
        }
      } finally {
        if (isMountedRef.current) {
          console.log('[Auth] Initialization complete');
          setIsLoading(false);
          // Clear timeout since we finished
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
          }
        }
      }
    };

    init();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!isMountedRef.current) return;

      console.log('[Auth] Auth state changed:', _event);
      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        // Defer role fetch to avoid blocking
        setTimeout(() => {
          Promise.all([
            fetchRole(nextSession.user.id),
            fetchCustomRoleName(nextSession.user.id),
          ])
            .then(([role, crn]) => {
              if (isMountedRef.current) {
                setUserRole(role);
                setCustomRoleName(crn);
              }
            })
            .catch(() => {
              if (isMountedRef.current) setUserRole('agent');
            });
        }, 0);
      } else {
        setUserRole(null);
        setCustomRoleName(null);
      }
      
      setIsLoading(false);
    });

    return () => {
      isMountedRef.current = false;
      subscription.unsubscribe();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    console.log('[Auth] Signing in:', email);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      logEventDirect({ action: 'login', category: 'auth', entityType: 'session', fieldAccessed: `Вход: ${email}` });
    }
    return { error };
  };

  const signUp = async (email: string, password: string, fullName: string) => {
    console.log('[Auth] Signing up:', email);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });

    if (!error && data.user) {
      await supabase.from('profiles').insert({
        user_id: data.user.id,
        full_name: fullName,
      });
      await supabase.from('user_roles').insert({
        user_id: data.user.id,
        role: 'agent',
      });
    }

    return { error };
  };

  const signOut = async () => {
    console.log('[Auth] Signing out');
    logEventDirect({ action: 'logout', category: 'auth', entityType: 'session', fieldAccessed: 'Выход из системы' });
    sessionStorage.removeItem('bypass_banner_dismissed');
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, session, userRole, customRoleName, isLoading, isBlocked, signIn, signUp, signOut, checkBlockedStatus }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
