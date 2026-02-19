import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { DkpConstructor, DkpConstructorRef } from '@/components/dkp/DkpConstructor';
import { EuroProtocolModule, EuroProtocolModuleRef } from '@/components/europrotocol/EuroProtocolModule';
import { FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DKP_SERVICE_NAME, EURO_SERVICE_NAME } from '@/lib/systemServices';
import { usePermissions } from '@/hooks/usePermissions';

export type DocumentType = 'dkp' | 'europrotocol' | null;

export interface DocumentFormPanelRef {
  getDocumentType: () => DocumentType;
  getDocumentData: () => Record<string, any> | null;
  getClientUpdates: () => Record<string, any> | null;
  validateDkp: () => string[];
}

interface DocumentFormPanelProps {
  selectedServiceNames: string[];
  clientId: string | null;
}

export const DocumentFormPanel = forwardRef<DocumentFormPanelRef, DocumentFormPanelProps>(({
  selectedServiceNames,
  clientId,
}, ref) => {
  const { can } = usePermissions();
  const [isExpanded, setIsExpanded] = useState(true);
  const dkpRef = useRef<DkpConstructorRef>(null);
  const euroRef = useRef<EuroProtocolModuleRef>(null);

  const activeDocType: DocumentType = selectedServiceNames.includes(DKP_SERVICE_NAME)
    ? 'dkp'
    : selectedServiceNames.includes(EURO_SERVICE_NAME)
      ? 'europrotocol'
      : null;

  // Auto-expand when document type appears
  useEffect(() => {
    if (activeDocType) setIsExpanded(true);
  }, [activeDocType]);

  useImperativeHandle(ref, () => ({
    getDocumentType: () => activeDocType,
    getDocumentData: () => {
      if (activeDocType === 'dkp') return dkpRef.current?.getDocumentData() || null;
      if (activeDocType === 'europrotocol') return euroRef.current?.getDocumentData() || null;
      return null;
    },
    getClientUpdates: () => {
      if (activeDocType === 'dkp') return dkpRef.current?.getClientUpdates() || null;
      return null;
    },
    validateDkp: () => {
      if (activeDocType === 'dkp') return dkpRef.current?.validateRequired() || [];
      return [];
    },
  }));

  if (!activeDocType || !clientId || !can('sale_legal')) return null;

  const title = activeDocType === 'dkp' ? 'Договор купли-продажи ТС' : 'Европротокол';

  return (
    <div className={cn(
      "card-elevated overflow-hidden transition-all duration-300 ease-in-out",
      isExpanded ? "max-h-[2000px] opacity-100" : "max-h-12 opacity-100"
    )}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between p-2 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="font-semibold text-sm">{title}</span>
          <span className="text-[10px] text-muted-foreground bg-primary/10 px-1.5 py-0.5 rounded">
            Заполните форму документа
          </span>
        </div>
        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>

      {isExpanded && (
        <div className="border-t">
          {activeDocType === 'dkp' ? (
            <DkpConstructor ref={dkpRef} clientId={clientId} />
          ) : (
            <EuroProtocolModule ref={euroRef} clientId={clientId} />
          )}
        </div>
      )}
    </div>
  );
});

DocumentFormPanel.displayName = 'DocumentFormPanel';
