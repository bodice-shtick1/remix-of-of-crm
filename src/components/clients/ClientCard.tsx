import { useState } from 'react';
import { Client, Policy } from '@/types/crm';
import { Phone, Mail, Calendar, Building2, FileText, ChevronRight, ExternalLink, Edit2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEntityTab } from '@/hooks/useEntityTab';
import { Button } from '@/components/ui/button';
import { EditClientDialog } from './EditClientDialog';
import { MaskedPhone, MaskedEmail } from '@/components/common/MaskedPhone';
import { getClientDisplayName, getClientInitials } from '@/lib/mappers';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientCardProps {
  client: Client;
  policies: Policy[];
  onClick?: () => void;
}

export function ClientCard({ client, policies, onClick }: ClientCardProps) {
  const [editOpen, setEditOpen] = useState(false);
  const { openClientTab } = useEntityTab();
  const { can } = usePermissions();

  const clientPolicies = policies.filter(p => p.clientId === client.id);
  const activePolicies = clientPolicies.filter(p => p.status === 'active' || p.status === 'expiring_soon');
  
  const displayName = getClientDisplayName(client);
  const initials = getClientInitials(client);

  const handleOpenInTab = (e: React.MouseEvent) => {
    e.stopPropagation();
    openClientTab(client);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditOpen(true);
  };

  return (
    <div 
      onClick={onClick}
      className="card-elevated p-4 cursor-pointer group hover:border-primary/30 transition-all duration-200"
    >
      <div className="flex items-start gap-4">
        <div className={cn(
          'avatar-initials h-12 w-12 text-sm shrink-0',
          client.isCompany && 'bg-accent'
        )}>
          {client.isCompany ? <Building2 className="h-5 w-5" /> : initials}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-foreground group-hover:text-primary transition-colors line-clamp-1">
                  {displayName}
                </h3>
                {can('client_info_edit') && (
                  <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleEdit} title="Редактировать">
                    <Edit2 className="h-3 w-3" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={handleOpenInTab} title="Открыть в вкладке">
                  <ExternalLink className="h-3 w-3" />
                </Button>
              </div>
              <div className="flex items-center gap-1 mt-1">
                <Phone className="h-3 w-3 text-muted-foreground" />
                <MaskedPhone 
                  phone={client.phone} 
                  clientId={client.id} 
                  clientName={displayName}
                  className="text-sm text-muted-foreground"
                  context="Карточка клиента"
                />
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all shrink-0" />
          </div>

          {client.email && (
            <div className="flex items-center gap-1 mt-1">
              <Mail className="h-3 w-3 text-muted-foreground" />
              <MaskedEmail 
                email={client.email} 
                clientId={client.id}
                clientName={displayName}
                className="text-xs text-muted-foreground truncate"
                context="Карточка клиента"
              />
            </div>
          )}

          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1">
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-medium text-primary">
                {activePolicies.length} {activePolicies.length === 1 ? 'полис' : 'полисов'}
              </span>
            </div>
            {client.birthDate && !client.isCompany && (
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">
                  {new Date(client.birthDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      <EditClientDialog client={client} open={editOpen} onOpenChange={setEditOpen} />
    </div>
  );
}
