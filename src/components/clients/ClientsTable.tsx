import { useState, useMemo } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { 
  MessageSquare, 
  ShoppingCart, 
  Edit2, 
  AlertTriangle,
  ChevronRight,
  Car
} from 'lucide-react';
import { Client, Policy } from '@/types/crm';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { MaskedPhone } from '@/components/common/MaskedPhone';
import { EditClientDialog } from './EditClientDialog';
import { cn } from '@/lib/utils';
import { getClientDisplayName } from '@/lib/mappers';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientsTableProps {
  clients: Client[];
  policies: Policy[];
  onClientClick: (client: Client) => void;
  onNewSale?: (client: Client) => void;
  onOpenChat?: (client: Client) => void;
}

type ClientStatus = 'active' | 'expiring' | 'debt' | 'expired' | 'none';

export function ClientsTable({ 
  clients, 
  policies, 
  onClientClick,
  onNewSale,
  onOpenChat,
}: ClientsTableProps) {
  const { can } = usePermissions();
  const [editingClient, setEditingClient] = useState<Client | null>(null);

  // Compute client data enriched with policy info
  const enrichedClients = useMemo(() => {
    return clients.map(client => {
      const clientPolicies = policies.filter(p => p.clientId === client.id);
      const activePolicies = clientPolicies.filter(p => 
        p.status === 'active' || p.status === 'expiring_soon'
      );
      
      // Find latest policy
      const latestPolicy = clientPolicies.length > 0 
        ? clientPolicies.sort((a, b) => 
            new Date(b.endDate).getTime() - new Date(a.endDate).getTime()
          )[0]
        : null;
      
      // Find vehicle info from any policy
      const vehiclePolicy = clientPolicies.find(p => p.vehicleNumber || p.vehicleModel);
      
      // Determine status
      let status: ClientStatus = 'none';
      let daysUntilExpiry = Infinity;
      
      if (activePolicies.length > 0) {
        const soonestExpiring = activePolicies.reduce((min, p) => {
          const days = differenceInDays(parseISO(p.endDate), new Date());
          return days < min ? days : min;
        }, Infinity);
        
        daysUntilExpiry = soonestExpiring;
        
        if (soonestExpiring < 0) {
          status = 'expired';
        } else if (soonestExpiring <= 30) {
          status = 'expiring';
        } else {
          status = 'active';
        }
      }
      
      // Check for debt (simplified - would need actual debt data)
      const hasDebt = clientPolicies.some(p => p.paymentStatus === 'pending');
      if (hasDebt) {
        status = 'debt';
      }
      
      return {
        ...client,
        activePoliciesCount: activePolicies.length,
        latestPolicy,
        vehicleModel: vehiclePolicy?.vehicleModel,
        vehicleNumber: vehiclePolicy?.vehicleNumber,
        status,
        daysUntilExpiry,
      };
    });
  }, [clients, policies]);

  const getDisplayName = (client: Client) => getClientDisplayName(client);

  const getStatusBadge = (status: ClientStatus, daysUntilExpiry: number) => {
    switch (status) {
      case 'active':
        return <Badge variant="outline" className="bg-success/10 text-success border-success/30 text-[10px] px-1.5 py-0">Активен</Badge>;
      case 'expiring':
        return (
          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-[10px] px-1.5 py-0 gap-0.5">
            <AlertTriangle className="h-2.5 w-2.5" />
            {daysUntilExpiry} дн.
          </Badge>
        );
      case 'expired':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">Истёк</Badge>;
      case 'debt':
        return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 text-[10px] px-1.5 py-0">Долг</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground text-[10px] px-1.5 py-0">—</Badge>;
    }
  };

  const handleEdit = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    setEditingClient(client);
  };

  const handleNewSale = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    onNewSale?.(client);
  };

  const handleOpenChat = (e: React.MouseEvent, client: Client) => {
    e.stopPropagation();
    onOpenChat?.(client);
  };

  return (
    <>
      <div className="w-full overflow-hidden border rounded-lg">
        <Table className="w-full table-fixed text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur supports-[backdrop-filter]:bg-muted/80">
            <TableRow className="h-8">
              <TableHead className="py-1.5 px-2 text-xs font-semibold">
                ФИО / Компания
              </TableHead>
              <TableHead className="w-[140px] py-1.5 px-2 text-xs font-semibold">Телефон</TableHead>
              <TableHead className="w-[90px] py-1.5 px-2 text-xs font-semibold">Дата рожд.</TableHead>
              <TableHead className="py-1.5 px-2 text-xs font-semibold">Объект / Авто</TableHead>
              <TableHead className="py-1.5 px-2 text-xs font-semibold">Последний полис</TableHead>
              <TableHead className="w-[100px] py-1.5 px-2 text-xs font-semibold text-center">Статус</TableHead>
              <TableHead className="w-[90px] py-1.5 px-2 text-xs font-semibold text-center">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedClients.map((client, index) => (
              <TableRow 
                key={client.id}
                onClick={() => onClientClick(client)}
                className={cn(
                  "h-9 cursor-pointer transition-colors hover:bg-primary/5",
                  index % 2 === 0 ? "bg-background" : "bg-muted/30"
                )}
              >
                {/* ФИО */}
                <TableCell className="py-1 px-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-medium text-xs truncate" title={getDisplayName(client)}>
                      {getDisplayName(client)}
                    </span>
                  </div>
                </TableCell>

                {/* Телефон */}
                <TableCell className="py-1 px-2">
                  <MaskedPhone 
                    phone={client.phone} 
                    clientId={client.id}
                    clientName={getDisplayName(client)}
                    className="text-xs"
                    showIcon={true}
                    context="Таблица клиентов"
                  />
                </TableCell>

                {/* Дата рождения - hidden below xl */}
                <TableCell className="py-1 px-2 text-xs text-muted-foreground">
                  {client.birthDate && !client.isCompany
                    ? format(parseISO(client.birthDate), 'dd.MM.yyyy')
                    : '—'
                  }
                </TableCell>

                {/* Объект / Авто */}
                <TableCell className="py-1 px-2">
                  {client.vehicleModel || client.vehicleNumber ? (
                    <div className="flex items-center gap-1 text-xs min-w-0">
                      <Car className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate" title={`${client.vehicleModel || ''} ${client.vehicleNumber || ''}`.trim()}>
                        {client.vehicleModel && <span>{client.vehicleModel}</span>}
                        {client.vehicleNumber && (
                          <span className="ml-1 font-mono text-[10px] bg-muted px-1 rounded">
                            {client.vehicleNumber}
                          </span>
                        )}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Последний полис - hidden below xl */}
                <TableCell className="py-1 px-2">
                  {client.latestPolicy ? (
                    <div className="text-xs truncate">
                      <span className="font-medium">{client.latestPolicy.type}</span>
                      <span className="text-muted-foreground ml-1">
                        до {format(parseISO(client.latestPolicy.endDate), 'dd.MM.yy')}
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </TableCell>

                {/* Статус */}
                <TableCell className="py-1 px-2 text-center">
                  {getStatusBadge(client.status, client.daysUntilExpiry)}
                </TableCell>

                {/* Действия */}
                <TableCell className="py-1 px-2">
                  <div className="flex items-center justify-center gap-0">
                    {can('client_comm_actions') && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={(e) => handleOpenChat(e, client)}
                        title="Открыть чат"
                      >
                        <MessageSquare className="h-3 w-3" />
                      </Button>
                    )}
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={(e) => handleNewSale(e, client)}
                      title="Новая продажа"
                    >
                      <ShoppingCart className="h-3 w-3" />
                    </Button>
                    {can('client_info_edit') && (
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6"
                        onClick={(e) => handleEdit(e, client)}
                        title="Редактировать"
                      >
                        <Edit2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {editingClient && (
        <EditClientDialog 
          client={editingClient} 
          open={!!editingClient} 
          onOpenChange={(open) => !open && setEditingClient(null)} 
        />
      )}
    </>
  );
}
