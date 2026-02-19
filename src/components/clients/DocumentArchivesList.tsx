import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { FileText, Trash2, Printer, Loader2, Car, ScrollText, Receipt, ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useDocumentArchives, DocumentArchive } from '@/hooks/useDocumentArchives';
import { useAuth } from '@/hooks/useAuth';
import { logEventDirect } from '@/hooks/useEventLog';
import { usePermissions } from '@/hooks/usePermissions';
import { printDocumentArchive } from '@/lib/documentPrinter';
import { cn } from '@/lib/utils';

interface DocumentArchivesListProps {
  clientId: string;
  onOpenArchive?: (archive: DocumentArchive) => void;
}

// --- helpers ---

function getArchiveIcon(type: string) {
  if (type === 'dkp') return <Car className="h-4 w-4 text-primary" />;
  if (type === 'cash_receipt') return <Receipt className="h-4 w-4 text-green-600" />;
  if (type === 'sales_receipt') return <FileText className="h-4 w-4 text-amber-600" />;
  if (type === 'receipt') return <Receipt className="h-4 w-4 text-warning" />;
  if (type === 'europrotocol') return <FileText className="h-4 w-4 text-blue-500" />;
  return <ScrollText className="h-4 w-4 text-success" />;
}

function getArchiveTitle(archive: DocumentArchive): string {
  const data = archive.document_data;
  if (archive.type === 'dkp') {
    const seller = data.seller?.fullName || '';
    const buyer = data.buyer?.fullName || '';
    return `ДКП: ${seller} → ${buyer}`;
  }
  if (archive.type === 'cash_receipt') return `Кассовый чек: ${data.uid || '—'} — ${data.clientName || '—'}`;
  if (archive.type === 'sales_receipt') return `Товарный чек: ${data.uid || '—'} — ${data.clientName || '—'}`;
  if (archive.type === 'receipt') return `Чек: ${data.uid || '—'} — ${data.clientName || '—'}`;
  if (archive.type === 'europrotocol') {
    const a = data.participantA?.ownerFullName || '';
    const b = data.participantB?.ownerFullName || '';
    return `Европротокол: ${a} / ${b}`;
  }
  return `Согласие ПДН: ${data.clientName || '—'}`;
}

// --- group definitions ---

interface ArchiveGroup {
  key: string;
  label: string;
  types: string[];
  icon: React.ReactNode;
}

const ARCHIVE_GROUPS: ArchiveGroup[] = [
  { key: 'contracts', label: 'Договоры', types: ['dkp'], icon: <Car className="h-4 w-4 text-primary" /> },
  { key: 'receipts', label: 'Чеки', types: ['cash_receipt', 'sales_receipt', 'receipt'], icon: <Receipt className="h-4 w-4 text-success" /> },
  { key: 'consents', label: 'Согласия', types: ['pnd'], icon: <ScrollText className="h-4 w-4 text-success" /> },
  { key: 'other', label: 'Прочее', types: ['europrotocol'], icon: <FileText className="h-4 w-4 text-blue-500" /> },
];

function groupArchives(archives: DocumentArchive[]) {
  const grouped: { group: ArchiveGroup; items: DocumentArchive[] }[] = [];
  const usedTypes = new Set<string>();

  for (const g of ARCHIVE_GROUPS) {
    const items = archives
      .filter(a => g.types.includes(a.type))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    if (items.length > 0) {
      grouped.push({ group: g, items });
      g.types.forEach(t => usedTypes.add(t));
    }
  }

  // catch-all for unknown types
  const rest = archives
    .filter(a => !usedTypes.has(a.type))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  if (rest.length > 0) {
    grouped.push({
      group: { key: '_rest', label: 'Прочее', types: [], icon: <FileText className="h-4 w-4 text-muted-foreground" /> },
      items: rest,
    });
  }

  return grouped;
}

// --- row ---

function ArchiveRow({
  archive,
  isAdmin,
  deletingId,
  onPrint,
  onDelete,
  canPrint,
  canDelete,
}: {
  archive: DocumentArchive;
  isAdmin: boolean;
  deletingId: string | null;
  onPrint: (a: DocumentArchive) => void;
  onDelete: (a: DocumentArchive) => void;
  canPrint: boolean;
  canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-primary/30 transition-colors bg-card">
      <div className="p-2 rounded-lg bg-muted shrink-0">
        {getArchiveIcon(archive.type)}
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-medium text-sm text-foreground truncate">
          {getArchiveTitle(archive)}
        </p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
          <span>{format(parseISO(archive.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}</span>
          {archive.creator_name && (
            <>
              <span>•</span>
              <span>{archive.creator_name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 shrink-0">
        {canPrint && (
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Печать" onClick={() => onPrint(archive)}>
            <Printer className="h-4 w-4" />
          </Button>
        )}
        {canDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:text-destructive"
            title="Удалить"
            onClick={() => onDelete(archive)}
            disabled={deletingId === archive.id}
          >
            {deletingId === archive.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// --- main ---

export function DocumentArchivesList({ clientId, onOpenArchive }: DocumentArchivesListProps) {
  const { archives, isLoading, deleteArchive } = useDocumentArchives(clientId);
  const { userRole } = useAuth();
  const { can } = usePermissions();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isAdmin = userRole === 'admin';
  const canPrint = can('docs_archive_print');
  const canDelete = can('docs_archive_delete');

  const handlePrint = (archive: DocumentArchive) => {
    logEventDirect({
      action: 'print', category: 'clients', entityType: 'document_archive',
      entityId: archive.id, clientId,
      newValue: `Печать архива: ${getArchiveTitle(archive)}`,
    });
    printDocumentArchive(archive.type, archive.document_data);
  };

  const handleDelete = async (archive: DocumentArchive) => {
    if (!confirm(`Удалить "${getArchiveTitle(archive)}" из архива?`)) return;
    setDeletingId(archive.id);
    try {
      await deleteArchive(archive.id);
    } finally {
      setDeletingId(null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-6 flex justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (archives.length === 0) return null;

  const groups = groupArchives(archives);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          Архив документов ({archives.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="max-h-[60vh] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
          <div className="space-y-2">
            {groups.map(({ group, items }) => (
              <Collapsible key={group.key} defaultOpen>
                <CollapsibleTrigger className="flex items-center gap-2 w-full py-2 px-1 rounded-md hover:bg-muted/50 transition-colors group text-left">
                  <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=closed]:-rotate-90" />
                  {group.icon}
                  <span className="font-medium text-sm text-foreground">{group.label}</span>
                  <Badge variant="secondary" className="text-[10px] ml-auto">{items.length}</Badge>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-1.5 pl-6 pt-1 pb-2">
                    {items.map(archive => (
                      <ArchiveRow
                        key={archive.id}
                        archive={archive}
                        isAdmin={isAdmin}
                        deletingId={deletingId}
                        onPrint={handlePrint}
                        onDelete={handleDelete}
                        canPrint={canPrint}
                        canDelete={canDelete}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
