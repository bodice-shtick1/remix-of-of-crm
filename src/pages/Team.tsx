import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, User, Loader2, Clock, CheckCircle2, UserPlus, Eye, EyeOff, Lock, LockOpen, Key, Copy, Check, Calendar, Mail } from 'lucide-react';
import { StaffCredentialsCell } from '@/components/team/StaffCredentialsCell';
import { logEventDirect } from '@/hooks/useEventLog';

interface StaffMember {
  id: string;
  email: string;
  full_name: string;
  role: string;
  custom_role_name: string | null;
  status: 'active' | 'pending';
  user_id: string | null;
  invited_at: string;
  claimed_at: string | null;
  is_blocked: boolean;
  temp_password: string | null;
  last_login_at: string | null;
  created_at: string;
}

export default function Team() {
  const { user, userRole, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<string | null>(null);
  const [newStaff, setNewStaff] = useState({ email: '', fullName: '', password: '', role: 'agent' });
  const [showPassword, setShowPassword] = useState(false);
  
  // Password reset state
  const [resetPasswordTarget, setResetPasswordTarget] = useState<{ userId: string; email: string; fullName: string } | null>(null);
  const [newPasswordData, setNewPasswordData] = useState({ password: '', confirmPassword: '' });
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const { can } = usePermissions();
  const isAdmin = userRole === 'admin';

  // Fetch available roles from user_roles_list
  const { data: availableRoles = [] } = useQuery({
    queryKey: ['user_roles_list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_roles_list')
        .select('role_name')
        .order('created_at');
      if (error) throw error;
      return (data ?? []).map(r => r.role_name);
    },
    enabled: can('team_manage'),
  });

  // Fetch all staff members from profiles + user_roles
  const { data: staff = [], isLoading, error: queryError } = useQuery({
    queryKey: ['team-staff'],
    queryFn: async () => {
      console.log('[Team] Fetching all staff members...');
      
      // Get all profiles with credentials (admin can see all due to RLS)
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, full_name, email, must_change_password, is_blocked, created_at, temp_password, last_login_at, custom_role_name');

      if (profilesError) {
        console.error('[Team] Profiles fetch error:', profilesError);
        throw profilesError;
      }
      console.log('[Team] Profiles loaded:', profiles?.length || 0);

      // Get all roles
      const { data: roles, error: rolesError } = await supabase
        .from('user_roles')
        .select('user_id, role, created_at');

      if (rolesError) {
        console.error('[Team] Roles fetch error:', rolesError);
        throw rolesError;
      }
      console.log('[Team] Roles loaded:', roles?.length || 0);

      // Get invitations for email info
      const { data: invitations } = await supabase
        .from('staff_invitations')
        .select('email, full_name, claimed_by, invited_at, claimed_at, role')
        .eq('is_active', true);

      console.log('[Team] Invitations loaded:', invitations?.length || 0);

      // Build staff list from profiles + roles
      const staffList: StaffMember[] = [];

      for (const profile of profiles || []) {
        const role = roles?.find(r => r.user_id === profile.user_id);
        const invitation = invitations?.find(inv => inv.claimed_by === profile.user_id);
        
        staffList.push({
          id: profile.user_id,
          email: profile.email || invitation?.email || '',
          full_name: profile.full_name || 'Без имени',
          role: (role?.role as string) || 'agent',
          custom_role_name: profile.custom_role_name || null,
          status: 'active',
          user_id: profile.user_id,
          invited_at: invitation?.invited_at || profile.created_at,
          claimed_at: invitation?.claimed_at || profile.created_at,
          is_blocked: profile.is_blocked ?? false,
          temp_password: profile.temp_password || null,
          last_login_at: profile.last_login_at || null,
          created_at: profile.created_at,
        });
      }

      // Add pending invitations (not yet claimed)
      for (const inv of invitations || []) {
        if (!inv.claimed_by) {
          staffList.push({
            id: inv.email,
            email: inv.email,
            full_name: inv.full_name,
            role: inv.role as string,
            custom_role_name: null,
            status: 'pending',
            user_id: null,
            invited_at: inv.invited_at,
            claimed_at: null,
            is_blocked: false,
            temp_password: null,
            last_login_at: null,
            created_at: inv.invited_at,
          });
        }
      }

      console.log('[Team] Total staff members:', staffList.length);
      return staffList;
    },
    enabled: can('team_manage'),
  });

  // Realtime subscription for profiles changes
  useEffect(() => {
    if (!can('team_manage')) return;
    const channel = supabase
      .channel('team-profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        queryClient.invalidateQueries({ queryKey: ['team-staff'] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient, can]);

  // Log query errors
  if (queryError) {
    console.error('[Team] Query error:', queryError);
  }

  // Create staff member via edge function (uses Admin API, no rate limits)
  const createStaffMember = useMutation({
    mutationFn: async (data: { email: string; fullName: string; password: string; role: string }) => {
      console.log('[Team] Creating operator via edge function...', { email: data.email, fullName: data.fullName, role: data.role });
      
      const { data: result, error } = await supabase.functions.invoke('admin-create-user', {
        body: {
          email: data.email,
          password: data.password,
          fullName: data.fullName,
          role: data.role,
        },
      });

      if (error) {
        console.error('[Team] Edge function error:', error);
        throw new Error(error.message || 'Ошибка вызова функции');
      }

      if (result?.error) {
        console.error('[Team] Creation error:', result.error);
        throw new Error(result.error);
      }

      console.log('[Team] Operator created successfully:', result?.user_id);
      return result;
    },
    onSuccess: (_result, variables) => {
      toast({
        title: 'Сотрудник создан',
        description: 'Аккаунт оператора создан. При первом входе потребуется сменить пароль.',
      });
      logEventDirect({
        action: 'create',
        category: 'access',
        entityType: 'staff',
        fieldAccessed: `Создан сотрудник: ${variables.fullName}`,
        newValue: variables.email,
      });
      setDialogOpen(false);
      setNewStaff({ email: '', fullName: '', password: '', role: 'agent' });
      queryClient.invalidateQueries({ queryKey: ['team-staff'] });
    },
    onError: (error: Error) => {
      console.error('[Team] Creation failed:', error);
      toast({ 
        title: 'Ошибка создания сотрудника', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Toggle block status with optimistic updates
  const toggleBlockStatus = useMutation({
    mutationFn: async ({ userId, email, fullName, block }: { userId: string; email: string; fullName: string; block: boolean }) => {
      console.log('[Team] Toggling block status:', { userId, block });
      
      // Update profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ is_blocked: block })
        .eq('user_id', userId);

      if (updateError) {
        console.error('[Team] Block toggle error:', updateError);
        throw new Error(`Ошибка: ${updateError.message}`);
      }

      // Log to audit
      const { error: auditError } = await supabase
        .from('security_audit_logs')
        .insert({
          user_id: user!.id,
          action: block ? 'user_blocked' : 'user_unblocked',
          target_user_id: userId,
          target_email: email,
          details: { 
            admin_name: user?.email,
            target_name: fullName,
            blocked: block 
          },
        });

      if (auditError) {
        console.warn('[Team] Audit log error (non-critical):', auditError);
      }

      console.log('[Team] Block status updated successfully');
      return { userId, block };
    },
    // Optimistic update
    onMutate: async (variables) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['team-staff'] });
      
      // Snapshot the previous value
      const previousStaff = queryClient.getQueryData<StaffMember[]>(['team-staff']);
      
      // Optimistically update the cache
      queryClient.setQueryData<StaffMember[]>(['team-staff'], (old) => 
        old?.map(member => 
          member.user_id === variables.userId 
            ? { ...member, is_blocked: variables.block }
            : member
        ) ?? []
      );
      
      return { previousStaff };
    },
    onSuccess: (_, variables) => {
      toast({ 
        title: variables.block ? '🔒 Доступ заблокирован' : '🔓 Доступ разблокирован',
        description: variables.block 
          ? 'Сотрудник будет автоматически выведен из системы'
          : 'Сотрудник снова может войти в систему',
      });
      logEventDirect({
        action: 'update',
        category: 'access',
        entityType: 'staff',
        fieldAccessed: `${variables.block ? 'Блокировка' : 'Разблокировка'}: ${variables.fullName}`,
        oldValue: variables.block ? 'active' : 'blocked',
        newValue: variables.block ? 'blocked' : 'active',
      });
    },
    onError: (error: Error, variables, context) => {
      // Rollback on error
      if (context?.previousStaff) {
        queryClient.setQueryData(['team-staff'], context.previousStaff);
      }
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
    onSettled: () => {
      // Always refetch after mutation to ensure data is in sync
      queryClient.invalidateQueries({ queryKey: ['team-staff'] });
    },
  });

  // Admin password reset
  const resetPassword = useMutation({
    mutationFn: async ({ userId, email, password }: { userId: string; email: string; password: string }) => {
      console.log('[Team] Admin resetting password for:', email);
      
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData?.session?.access_token) {
        throw new Error('Не авторизован');
      }

      const response = await supabase.functions.invoke('admin-reset-password', {
        body: { 
          targetUserId: userId, 
          newPassword: password,
          targetEmail: email,
        },
      });

      if (response.error) {
        throw new Error(response.error.message || 'Ошибка сброса пароля');
      }

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      console.log('[Team] Password reset successful');
    },
    onSuccess: () => {
      toast({ 
        title: 'Пароль сброшен',
        description: 'При следующем входе сотрудник должен будет установить новый пароль',
      });
      if (resetPasswordTarget) {
        logEventDirect({
          action: 'update',
          category: 'access',
          entityType: 'staff',
          fieldAccessed: `Сброс пароля: ${resetPasswordTarget.fullName}`,
          newValue: resetPasswordTarget.email,
        });
      }
      setResetPasswordTarget(null);
      setNewPasswordData({ password: '', confirmPassword: '' });
    },
    onError: (error: Error) => {
      console.error('[Team] Password reset error:', error);
      toast({ 
        title: 'Ошибка сброса пароля', 
        description: error.message, 
        variant: 'destructive' 
      });
    },
  });

  // Change role mutation
  const changeRole = useMutation({
    mutationFn: async ({ userId, newRole, fullName }: { userId: string; newRole: string; fullName: string }) => {
      // Update custom_role_name in profiles
      const { error } = await supabase
        .from('profiles')
        .update({ custom_role_name: newRole })
        .eq('user_id', userId);
      if (error) throw new Error(error.message);

      // Also update user_roles table
      const mappedRole = (newRole === 'admin' || newRole === 'agent' || newRole === 'viewer') ? newRole : 'agent';
      await supabase
        .from('user_roles')
        .update({ role: mappedRole })
        .eq('user_id', userId);

      return { userId, newRole, fullName };
    },
    onSuccess: (_, variables) => {
      toast({ title: 'Роль успешно обновлена', description: `${variables.fullName} → ${variables.newRole}` });
      logEventDirect({
        action: 'update',
        category: 'access',
        entityType: 'staff',
        fieldAccessed: `Смена роли: ${variables.fullName}`,
        newValue: variables.newRole,
      });
      queryClient.invalidateQueries({ queryKey: ['team-staff'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка смены роли', description: error.message, variant: 'destructive' });
    },
  });

  // Revoke invitation / deactivate staff
  const revokeAccess = useMutation({
    mutationFn: async (id: string) => {
      // First check if this is an invitation or a direct user
      const { data: invitation } = await supabase
        .from('staff_invitations')
        .select('id, claimed_by')
        .eq('id', id)
        .maybeSingle();

      if (invitation) {
        // Deactivate invitation
        await supabase
          .from('staff_invitations')
          .update({ is_active: false })
          .eq('id', id);

        // If claimed, also remove role
        if (invitation.claimed_by) {
          await supabase
            .from('user_roles')
            .delete()
            .eq('user_id', invitation.claimed_by);
        }
      } else {
        // Direct user (admin) - just remove role
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', id);
      }
    },
    onSuccess: () => {
      toast({ title: 'Доступ отозван' });
      queryClient.invalidateQueries({ queryKey: ['team-staff'] });
    },
    onError: (error: Error) => {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    },
  });

  const handlePasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordTarget) return;
    
    if (newPasswordData.password !== newPasswordData.confirmPassword) {
      toast({ title: 'Ошибка', description: 'Пароли не совпадают', variant: 'destructive' });
      return;
    }
    if (newPasswordData.password.length < 6) {
      toast({ title: 'Ошибка', description: 'Пароль должен быть не менее 6 символов', variant: 'destructive' });
      return;
    }
    
    resetPassword.mutate({
      userId: resetPasswordTarget.userId,
      email: resetPasswordTarget.email,
      password: newPasswordData.password,
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaff.email || !newStaff.fullName || !newStaff.password) return;
    if (newStaff.password.length < 6) {
      toast({ title: 'Ошибка', description: 'Пароль должен быть не менее 6 символов', variant: 'destructive' });
      return;
    }
    createStaffMember.mutate(newStaff);
  };

  if (authLoading) {
    return (
      <div className="p-6 flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!can('team_manage')) {
    return (
      <div className="p-6">
        <div className="card-elevated p-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium text-foreground mb-1">Доступ ограничен</h3>
          <p className="text-muted-foreground">
            Управление командой доступно только при наличии соответствующих прав
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Команда</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление сотрудниками и доступом</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Добавить оператора
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Пригласить сотрудника</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label>ФИО</Label>
                <Input
                  value={newStaff.fullName}
                  onChange={(e) => setNewStaff({ ...newStaff, fullName: e.target.value })}
                  placeholder="Иванов Иван Иванович"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={newStaff.email}
                  onChange={(e) => setNewStaff({ ...newStaff, email: e.target.value })}
                  placeholder="operator@company.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Временный пароль</Label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    value={newStaff.password}
                    onChange={(e) => setNewStaff({ ...newStaff, password: e.target.value })}
                    placeholder="Минимум 6 символов"
                    required
                    minLength={6}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Сообщите этот пароль сотруднику лично
                </p>
              </div>

              <div className="space-y-2">
                <Label>Роль</Label>
                <Select value={newStaff.role} onValueChange={(val) => setNewStaff({ ...newStaff, role: val })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Выберите роль" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableRoles.filter(r => r !== 'admin').map(role => (
                      <SelectItem key={role} value={role}>{role}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Как это работает:</p>
                <ol className="list-decimal list-inside space-y-1">
                  <li>Вы создаете аккаунт с временным паролем</li>
                  <li>Сообщаете сотруднику Email и пароль</li>
                  <li>При первом входе система потребует сменить пароль</li>
                </ol>
              </div>

              <Button type="submit" className="w-full" disabled={createStaffMember.isPending}>
                {createStaffMember.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Создать аккаунт
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : staff.length === 0 ? (
        <div className="card-elevated p-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <h3 className="text-lg font-medium">Пока нет сотрудников</h3>
          <p className="text-muted-foreground">Добавьте первого оператора</p>
        </div>
      ) : (
        <div className="space-y-3">
          {staff.map((member) => (
            <Card key={member.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  {/* Left section: Avatar + Name */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="avatar-initials h-10 w-10 text-sm flex-shrink-0">
                      {member.full_name ? member.full_name.slice(0, 2).toUpperCase() : 'СО'}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-foreground truncate">
                        {member.full_name || 'Без имени'}
                      </p>
                      {member.email && (
                        <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                          <Mail className="h-3 w-3 flex-shrink-0" />
                          {member.email}
                        </p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Role selector or badge */}
                        {can('team_manage') && member.user_id && member.user_id !== user?.id && member.status === 'active' ? (
                          <Select
                            value={member.custom_role_name || member.role}
                            onValueChange={(val) => {
                              changeRole.mutate({
                                userId: member.user_id!,
                                newRole: val,
                                fullName: member.full_name,
                              });
                            }}
                            disabled={changeRole.isPending}
                          >
                            <SelectTrigger className="h-6 w-auto min-w-[100px] text-xs px-2 py-0 border-none bg-transparent hover:bg-muted">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoles.map(role => (
                                <SelectItem key={role} value={role}>
                                  <span className={`inline-block w-2 h-2 rounded-full mr-1.5 ${
                                    role === 'admin' ? 'bg-destructive' : role === 'viewer' ? 'bg-muted-foreground' : 'bg-primary'
                                  }`} />
                                  {role}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Badge
                            className={`text-xs ${
                              (member.custom_role_name || member.role) === 'admin'
                                ? 'bg-destructive text-destructive-foreground'
                                : (member.custom_role_name || member.role) === 'viewer'
                                ? 'bg-muted text-muted-foreground'
                                : 'bg-primary text-primary-foreground'
                            }`}
                          >
                            {member.custom_role_name || (member.role === 'admin' ? 'Админ' : member.role)}
                          </Badge>
                        )}
                        {member.user_id === user?.id && (
                          <Badge variant="outline" className="text-xs">Вы</Badge>
                        )}
                        {member.is_blocked && (
                          <Badge variant="destructive" className="text-xs gap-1">
                            <Lock className="h-3 w-3" />
                            Заблокирован
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Middle section: Credentials (Admin only) */}
                  {member.status === 'active' && (
                    <TooltipProvider>
                      <div className="hidden md:grid grid-cols-3 gap-4 text-xs flex-1 max-w-md">
                        {/* Email */}
                        <div>
                          <p className="text-muted-foreground mb-1">Логин</p>
                          {member.email ? (
                            <StaffCredentialsCell
                              type="email"
                              value={member.email}
                              userId={member.user_id || ''}
                              adminId={user?.id || ''}
                              targetEmail={member.email}
                            />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                        
                        {/* Password */}
                        <div>
                          <p className="text-muted-foreground mb-1">Пароль</p>
                          {member.temp_password ? (
                            <StaffCredentialsCell
                              type="password"
                              value={member.temp_password}
                              userId={member.user_id || ''}
                              adminId={user?.id || ''}
                              targetEmail={member.email}
                            />
                          ) : (
                            <span className="text-muted-foreground italic">Изменён</span>
                          )}
                        </div>

                        {/* Dates */}
                        <div>
                          <p className="text-muted-foreground mb-1">Даты</p>
                          <div className="space-y-0.5">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <div className="flex items-center gap-1 cursor-help">
                                  <Calendar className="h-3 w-3 text-muted-foreground" />
                                  <span>{new Date(member.created_at).toLocaleDateString('ru-RU')}</span>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>
                                Создан: {new Date(member.created_at).toLocaleString('ru-RU')}
                              </TooltipContent>
                            </Tooltip>
                            {member.last_login_at && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-1 cursor-help text-success">
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>{new Date(member.last_login_at).toLocaleDateString('ru-RU')}</span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent>
                                  Последний вход: {new Date(member.last_login_at).toLocaleString('ru-RU')}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </div>
                      </div>
                    </TooltipProvider>
                  )}

                  {/* Pending status */}
                  {member.status === 'pending' && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="gap-1 border-warning text-warning">
                        <Clock className="h-3 w-3" />
                        Ожидает регистрации
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Password reset button - not for self, not for pending, requires team_password_reset */}
                    {can('team_password_reset') && member.user_id && member.user_id !== user?.id && member.status === 'active' && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setResetPasswordTarget({
                              userId: member.user_id!,
                              email: member.email,
                              fullName: member.full_name,
                            })}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Сбросить пароль</TooltipContent>
                      </Tooltip>
                    )}

                    {/* Block/Unblock toggle - not for self, not for pending */}
                    {member.user_id && member.user_id !== user?.id && member.status === 'active' && (
                      <div 
                        className={`flex items-center gap-1 transition-opacity ${
                          toggleBlockStatus.isPending && toggleBlockStatus.variables?.userId === member.user_id 
                            ? 'opacity-50' 
                            : ''
                        }`}
                      >
                        <Switch
                          checked={!member.is_blocked}
                          onCheckedChange={(checked) => {
                            if (member.user_id && !toggleBlockStatus.isPending) {
                              toggleBlockStatus.mutate({
                                userId: member.user_id,
                                email: member.email,
                                fullName: member.full_name,
                                block: !checked,
                              });
                            }
                          }}
                          disabled={toggleBlockStatus.isPending}
                        />
                        <span className="text-xs text-muted-foreground">
                          {toggleBlockStatus.isPending && toggleBlockStatus.variables?.userId === member.user_id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : member.is_blocked ? (
                            <Lock className="h-3 w-3" />
                          ) : (
                            <LockOpen className="h-3 w-3" />
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!revokeTarget} onOpenChange={() => setRevokeTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Отозвать доступ?</AlertDialogTitle>
            <AlertDialogDescription>
              Сотрудник потеряет доступ ко всем разделам системы. 
              Это действие можно отменить, добавив его снова.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => revokeTarget && revokeAccess.mutate(revokeTarget)}
            >
              Отозвать доступ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Password Reset Dialog */}
      <Dialog open={!!resetPasswordTarget} onOpenChange={() => {
        setResetPasswordTarget(null);
        setNewPasswordData({ password: '', confirmPassword: '' });
        setShowNewPassword(false);
        setShowConfirmPassword(false);
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Смена пароля</DialogTitle>
          </DialogHeader>
          <form onSubmit={handlePasswordReset} className="space-y-4">
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground">
                Сброс пароля для: <span className="font-medium text-foreground">{resetPasswordTarget?.email || resetPasswordTarget?.fullName}</span>
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>Новый пароль</Label>
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPasswordData.password}
                  onChange={(e) => setNewPasswordData(prev => ({ ...prev, password: e.target.value }))}
                  placeholder="Минимум 6 символов"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Подтверждение пароля</Label>
              <div className="relative">
                <Input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={newPasswordData.confirmPassword}
                  onChange={(e) => setNewPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  placeholder="Повторите пароль"
                  required
                  minLength={6}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="p-3 bg-muted rounded-lg text-sm text-muted-foreground">
              <p>После сброса пароля сотрудник должен будет установить новый постоянный пароль при следующем входе.</p>
            </div>

            <Button type="submit" className="w-full" disabled={resetPassword.isPending}>
              {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Сбросить пароль
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
