import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Car, FileText, Wrench, ShoppingCart, Loader2, Calendar, 
  Paperclip, ChevronRight
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { SaleDetailsSheet } from './SaleDetailsSheet';
import { ProlongationStatusBadge } from '@/components/common/ProlongationStatusBadge';
import { ProlongationStatus } from '@/hooks/useProlongationStatus';

interface ClientActivityFeedProps {
  clientId: string;
}

interface ActivityItem {
  id: string;
  date: string;
  type: 'policy' | 'sale' | 'service';
  title: string;
  description: string;
  amount: number;
  insuranceCompany?: string;
  vehicleNumber?: string;
  vehicleMark?: string;
  policyNumber?: string;
  policySeries?: string;
  saleId?: string;
  policyId?: string;
  hasAttachments?: boolean;
  startDate?: string;
  endDate?: string;
  prolongationStatus?: ProlongationStatus;
}

export function ClientActivityFeed({ clientId }: ClientActivityFeedProps) {
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<ActivityItem | null>(null);

  // Fetch all activity data - only from sales (not standalone policies to avoid duplicates)
  const { data: activities = [], isLoading } = useQuery({
    queryKey: ['client-activity', clientId],
    queryFn: async () => {
      const items: ActivityItem[] = [];
      const processedSaleIds = new Set<string>();

      // Fetch completed sales with sale_items
      const { data: sales } = await supabase
        .from('sales')
        .select('id, uid, total_amount, status, created_at, completed_at')
        .eq('client_id', clientId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (sales && sales.length > 0) {
        const saleIds = sales.map(s => s.id);
        
        const { data: saleItems } = await supabase
          .from('sale_items')
          .select(`
            *,
            insurance_product:insurance_products(name, code)
          `)
          .in('sale_id', saleIds);

        const { data: documents } = await supabase
          .from('client_documents')
          .select('sale_id')
          .eq('client_id', clientId)
          .not('sale_id', 'is', null);

        // Fetch policies to get prolongation_status
        const { data: policiesData } = await supabase
          .from('policies')
          .select('id, policy_number, policy_series, prolongation_status')
          .eq('client_id', clientId);

        // Map policy by series+number for quick lookup
        const policyStatusMap = new Map<string, ProlongationStatus>();
        policiesData?.forEach(p => {
          const key = `${p.policy_series || ''}${p.policy_number}`;
          policyStatusMap.set(key, (p.prolongation_status || 'pending') as ProlongationStatus);
        });

        const salesWithDocs = new Set(documents?.map(d => d.sale_id) || []);

        // Group sale_items by sale_id
        const itemsBySale: Record<string, typeof saleItems> = {};
        saleItems?.forEach(item => {
          if (!itemsBySale[item.sale_id]) {
            itemsBySale[item.sale_id] = [];
          }
          itemsBySale[item.sale_id].push(item);
        });

        // Create ONE activity entry per sale (not per item) to avoid duplicates
        sales.forEach(sale => {
          // Skip if already processed or missing key data
          if (processedSaleIds.has(sale.id) || !sale.id || !sale.completed_at) {
            return;
          }
          processedSaleIds.add(sale.id);

          const saleItemsList = itemsBySale[sale.id] || [];
          
          // Skip sales without items
          if (saleItemsList.length === 0) {
            return;
          }

          // Determine primary item for display
          const primaryItem = saleItemsList[0];
          const isService = primaryItem.item_type === 'service';
          const itemCount = saleItemsList.length;
          
          let title = 'Продажа';
          if (isService) {
            title = primaryItem.service_name || 'Услуга';
          } else {
            title = primaryItem.insurance_product?.name || 'Страховой продукт';
          }
          
          // Add count if multiple items
          if (itemCount > 1) {
            title += ` (+${itemCount - 1})`;
          }

          const description = isService
            ? `Чек #${sale.uid}`
            : `Полис ${primaryItem.policy_series || ''}${primaryItem.policy_number || '—'} • Чек #${sale.uid}`;

          // Get prolongation status if it's a policy sale
          const policyKey = `${primaryItem.policy_series || ''}${primaryItem.policy_number || ''}`;
          const prolongationStatus = !isService && policyKey ? policyStatusMap.get(policyKey) : undefined;

          items.push({
            id: `sale-${sale.id}`,
            date: sale.completed_at || sale.created_at,
            type: isService ? 'service' : 'sale',
            title,
            description,
            amount: Number(sale.total_amount),
            insuranceCompany: primaryItem.insurance_company || undefined,
            policyNumber: primaryItem.policy_number || undefined,
            policySeries: primaryItem.policy_series || undefined,
            saleId: sale.id,
            hasAttachments: salesWithDocs.has(sale.id),
            startDate: primaryItem.start_date || undefined,
            endDate: primaryItem.end_date || undefined,
            prolongationStatus,
          });
        });
      }

      // Filter out invalid records
      const validItems = items.filter(item => {
        // Must have ID and valid date
        if (!item.id || !item.date) return false;
        // Must have saleId for clickability
        if (!item.saleId) return false;
        // Skip items with error titles
        if (item.title === 'Сделка не найдена') return false;
        return true;
      });

      // Sort by date descending
      validItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      console.log('Activity feed loaded:', validItems.length, 'valid items');
      return validItems;
    },
  });

  const handleViewAttachment = async (saleId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const { data: docs } = await supabase
      .from('client_documents')
      .select('file_path, file_name')
      .eq('sale_id', saleId)
      .limit(1);

    if (docs && docs.length > 0) {
      const { data } = await supabase.storage
        .from('client-documents')
        .createSignedUrl(docs[0].file_path, 3600);

      if (data?.signedUrl) {
        window.open(data.signedUrl, '_blank');
      }
    }
  };

  const handleItemClick = (activity: ActivityItem) => {
    console.log('Activity clicked:', activity);
    // For sales, open the details sheet
    if (activity.saleId) {
      setSelectedSaleId(activity.saleId);
      setSelectedActivity(activity);
    } else if (activity.policyId) {
      // For standalone policies, also set activity
      setSelectedActivity(activity);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
        <h3 className="text-lg font-medium text-foreground mb-1">История операций пока пуста</h3>
        <p className="text-muted-foreground text-sm">
          Здесь будут отображаться завершённые сделки
        </p>
      </div>
    );
  }

  const getIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'policy':
        return <FileText className="h-4 w-4" />;
      case 'sale':
        return <ShoppingCart className="h-4 w-4" />;
      case 'service':
        return <Wrench className="h-4 w-4" />;
    }
  };

  const getIconBg = (type: ActivityItem['type']) => {
    switch (type) {
      case 'policy':
        return 'bg-primary/10 text-primary';
      case 'sale':
        return 'bg-success/10 text-success';
      case 'service':
        return 'bg-accent text-accent-foreground';
    }
  };

  // Group activities by date
  const groupedActivities: Record<string, ActivityItem[]> = {};
  activities.forEach(activity => {
    const dateKey = format(parseISO(activity.date), 'yyyy-MM-dd');
    if (!groupedActivities[dateKey]) {
      groupedActivities[dateKey] = [];
    }
    groupedActivities[dateKey].push(activity);
  });

  return (
    <>
      <ScrollArea className="h-[500px] pr-4">
        <div className="space-y-6">
          {Object.entries(groupedActivities).map(([dateKey, items]) => (
            <div key={dateKey}>
              <div className="flex items-center gap-2 mb-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">
                  {format(parseISO(dateKey), 'd MMMM yyyy', { locale: ru })}
                </span>
              </div>
              
              <div className="space-y-2 ml-2 border-l-2 border-border pl-4">
                {items.map((activity) => (
                  <div
                    key={activity.id}
                    onClick={() => handleItemClick(activity)}
                    className="p-3 rounded-lg border border-border transition-all bg-card group cursor-pointer hover:border-primary hover:shadow-md hover:bg-accent/50"
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn('p-2 rounded-lg', getIconBg(activity.type))}>
                        {getIcon(activity.type)}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{activity.title}</span>
                          {activity.prolongationStatus && (
                            <ProlongationStatusBadge status={activity.prolongationStatus} />
                          )}
                          {activity.insuranceCompany && (
                            <span className="text-xs text-muted-foreground">
                              • {activity.insuranceCompany}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {activity.description}
                        </p>
                        {(activity.vehicleNumber || activity.vehicleMark) && (
                          <div className="flex items-center gap-1 mt-1">
                            <Car className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground font-mono">
                              {activity.vehicleMark && `${activity.vehicleMark} `}
                              {activity.vehicleNumber}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right flex flex-col items-end gap-1">
                        <span className="font-semibold text-foreground">
                          {activity.amount.toLocaleString('ru-RU')} ₽
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {format(parseISO(activity.date), 'HH:mm')}
                        </p>
                        
                        {/* Attachment and arrow indicators */}
                        <div className="flex items-center gap-1 mt-1">
                          {activity.hasAttachments && (
                            <button
                              onClick={(e) => handleViewAttachment(activity.saleId!, e)}
                              className="p-1 rounded hover:bg-muted transition-colors"
                              title="Открыть вложение"
                            >
                              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
                            </button>
                          )}
                          
                          <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Sale Details Sheet */}
      <SaleDetailsSheet
        saleId={selectedSaleId}
        selectedItemInfo={selectedActivity}
        onClose={() => {
          setSelectedSaleId(null);
          setSelectedActivity(null);
        }}
      />
    </>
  );
}
