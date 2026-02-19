import { useState } from 'react';
import { useEmailAccounts, EmailAccount } from '@/hooks/useEmailAccounts';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Mail, Plus, Pencil, Trash2, Building2, User, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AccountFormData {
  email_address: string;
  display_name: string;
  smtp_host: string;
  smtp_port: number;
  imap_host: string;
  imap_port: number;
  username: string;
  password_encrypted: string;
  is_org_account: boolean;
  use_ssl: boolean;
  signature: string;
}

const defaultForm: AccountFormData = {
  email_address: '',
  display_name: '',
  smtp_host: '',
  smtp_port: 587,
  imap_host: '',
  imap_port: 993,
  username: '',
  password_encrypted: '',
  is_org_account: false,
  use_ssl: true,
  signature: '',
};

export function EmailAccountSettings() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { accounts, isLoading, createAccount, updateAccount, deleteAccount } = useEmailAccounts();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<AccountFormData>(defaultForm);

  if (!can('email_config_manage') && !can('email_view_own')) return null;

  const handleEdit = (acc: EmailAccount) => {
    setEditingId(acc.id);
    setForm({
      email_address: acc.email_address,
      display_name: acc.display_name || '',
      smtp_host: acc.smtp_host,
      smtp_port: acc.smtp_port,
      imap_host: acc.imap_host,
      imap_port: acc.imap_port,
      username: acc.username,
      password_encrypted: '',
      is_org_account: acc.is_org_account,
      use_ssl: acc.use_ssl,
      signature: acc.signature || '',
    });
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const handleSave = () => {
    if (!user) return;
    if (editingId) {
      const update: any = { id: editingId, ...form };
      if (!form.password_encrypted) delete update.password_encrypted;
      updateAccount.mutate(update, { onSuccess: () => setDialogOpen(false) });
    } else {
      createAccount.mutate({
        ...form,
        user_id: form.is_org_account ? null : user.id,
        is_active: true,
      } as any, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const canManageOrg = can('email_config_manage');

  return (
    <div className="card-elevated p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Mail className="h-5 w-5 text-primary" />
          Почтовые аккаунты
        </h2>
        <Button size="sm" onClick={handleAdd} className="gap-1">
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2].map(i => <Skeleton key={i} className="h-16 w-full" />)}
        </div>
      ) : accounts.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          Нет настроенных почтовых аккаунтов
        </p>
      ) : (
        <div className="space-y-3">
          {accounts.map(acc => (
            <div key={acc.id} className="flex items-center justify-between p-3 rounded-lg border border-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  {acc.is_org_account ? <Building2 className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {acc.display_name || acc.email_address}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">{acc.email_address}</p>
                </div>
                <Badge variant={acc.is_org_account ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                  {acc.is_org_account ? 'Организация' : 'Личный'}
                </Badge>
                {acc.is_active && <Badge variant="outline" className="text-[10px] text-green-600 shrink-0">Активен</Badge>}
              </div>
              <div className="flex items-center gap-1">
                {(canManageOrg || acc.user_id === user?.id) && (
                  <>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEdit(acc)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => deleteAccount.mutate(acc.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? 'Редактировать аккаунт' : 'Новый почтовый аккаунт'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={form.email_address} onChange={e => setForm(p => ({ ...p, email_address: e.target.value }))} placeholder="user@mail.ru" />
              </div>
              <div className="space-y-2">
                <Label>Отображаемое имя</Label>
                <Input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))} placeholder="Мой ящик" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>SMTP хост</Label>
                <Input value={form.smtp_host} onChange={e => setForm(p => ({ ...p, smtp_host: e.target.value }))} placeholder="smtp.mail.ru" />
              </div>
              <div className="space-y-2">
                <Label>SMTP порт</Label>
                <Input type="number" value={form.smtp_port} onChange={e => setForm(p => ({ ...p, smtp_port: parseInt(e.target.value) || 587 }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>IMAP хост</Label>
                <Input value={form.imap_host} onChange={e => setForm(p => ({ ...p, imap_host: e.target.value }))} placeholder="imap.mail.ru" />
              </div>
              <div className="space-y-2">
                <Label>IMAP порт</Label>
                <Input type="number" value={form.imap_port} onChange={e => setForm(p => ({ ...p, imap_port: parseInt(e.target.value) || 993 }))} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Имя пользователя</Label>
                <Input value={form.username} onChange={e => setForm(p => ({ ...p, username: e.target.value }))} placeholder="user@mail.ru" />
              </div>
              <div className="space-y-2">
                <Label>Пароль приложения</Label>
                <Input type="password" value={form.password_encrypted} onChange={e => setForm(p => ({ ...p, password_encrypted: e.target.value }))} placeholder={editingId ? '••••••••' : 'Введите пароль'} />
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch checked={form.use_ssl} onCheckedChange={v => setForm(p => ({ ...p, use_ssl: v }))} />
                <Label>SSL/TLS</Label>
              </div>
              {canManageOrg && (
                <div className="flex items-center gap-2">
                  <Switch checked={form.is_org_account} onCheckedChange={v => setForm(p => ({ ...p, is_org_account: v }))} />
                  <Label>Общий (организация)</Label>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label>Подпись (HTML)</Label>
              <Textarea
                value={form.signature}
                onChange={e => setForm(p => ({ ...p, signature: e.target.value }))}
                placeholder="С уважением,&#10;Иван Иванов&#10;+7 (999) 123-45-67"
                rows={3}
                className="text-sm"
              />
              <p className="text-[10px] text-muted-foreground">Подпись будет автоматически добавляться к новым письмам</p>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
              <Button
                onClick={handleSave}
                disabled={createAccount.isPending || updateAccount.isPending || !form.email_address || !form.smtp_host || !form.imap_host}
              >
                {(createAccount.isPending || updateAccount.isPending) && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editingId ? 'Сохранить' : 'Добавить'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
