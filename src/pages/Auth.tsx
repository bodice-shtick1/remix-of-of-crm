import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useOrganization } from '@/hooks/useOrganization';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
export default function Auth() {
  const {
    user,
    isLoading,
    signIn
  } = useAuth();
  const {
    needsSetup,
    isLoading: orgLoading
  } = useOrganization();
  const {
    toast
  } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  });
  if (isLoading || orgLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>;
  }

  // If system not set up, redirect to root which shows SetupWizard
  if (needsSetup) {
    return <Navigate to="/" replace />;
  }
  if (user) {
    return <Navigate to="/" replace />;
  }
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const {
      error
    } = await signIn(loginForm.email, loginForm.password);
    if (error) {
      toast({
        title: 'Ошибка входа',
        description: 'Неверный email или пароль',
        variant: 'destructive'
      });
      // Log failed login attempt (no user session, so insert directly with service-level info)
      try {
        await supabase.from('access_logs').insert([{
          user_id: '00000000-0000-0000-0000-000000000000',
          action: 'login_failed',
          category: 'auth',
          entity_type: 'session',
          field_accessed: `Неудачный вход: ${loginForm.email}`,
        }] as any);
      } catch (e) {
        console.warn('[Auth] Failed to log failed login:', e);
      }
    }
    setIsSubmitting(false);
  };
  return <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-accent/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-primary/10 rounded-full w-fit">
            <Shield className="h-8 w-8 text-primary" />
          </div>
          <CardTitle className="text-2xl">СтрахАгент CRM</CardTitle>
          <CardDescription>Войдите в систему для продолжения работы</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="login-email">Email</Label>
              <Input id="login-email" type="email" value={loginForm.email} onChange={e => setLoginForm({
              ...loginForm,
              email: e.target.value
            })} placeholder="agent@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="login-password">Пароль</Label>
              <Input id="login-password" type="password" value={loginForm.password} onChange={e => setLoginForm({
              ...loginForm,
              password: e.target.value
            })} placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Войти
            </Button>
          </form>
          
        </CardContent>
      </Card>
    </div>;
}