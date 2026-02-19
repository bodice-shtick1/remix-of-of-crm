import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ShiftStatusBadge } from './ShiftStatusBadge';
import { OpenShiftModal } from './OpenShiftModal';
import { LockOpen, Lock, Loader2 } from 'lucide-react';
import { useShiftManagement } from '@/hooks/useShiftManagement';
import { useTabManager } from '@/hooks/useTabManager';

interface ShiftControlsProps {
  className?: string;
}

export function ShiftControls({ className }: ShiftControlsProps) {
  const {
    currentShift,
    isShiftOpen,
    isLoading,
    getExpectedOpeningBalance,
    openShift,
  } = useShiftManagement();

  const { tabs, addTab, setActiveTab } = useTabManager();

  const [isOpenModalVisible, setIsOpenModalVisible] = useState(false);

  const handleCloseShiftClick = () => {
    // Check if there's an active shift to close
    if (!currentShift) {
      return;
    }

    // Check if shift-close tab already exists
    const existingTab = tabs.find(t => t.type === 'shift-close');
    
    if (existingTab) {
      // Activate existing tab
      setActiveTab(existingTab.id);
    } else {
      // Create new shift-close tab with shift data
      addTab({
        title: 'Закрытие смены',
        type: 'shift-close',
        isPinned: false,
        isDirty: false,
        isClosable: true,
        data: {
          shiftId: currentShift.id,
          shift: currentShift,
        },
      });
    }
  };

  if (isLoading) {
    return (
      <div className={className}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-3">
        <ShiftStatusBadge isOpen={isShiftOpen} />
        
        {isShiftOpen ? (
          <Button
            variant="outline"
            size="sm"
            onClick={handleCloseShiftClick}
            className="gap-2 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <Lock className="h-4 w-4" />
            Закрыть смену
          </Button>
        ) : (
          <Button
            variant="default"
            size="sm"
            onClick={() => setIsOpenModalVisible(true)}
            className="gap-2"
          >
            <LockOpen className="h-4 w-4" />
            Открыть смену
          </Button>
        )}
      </div>

      <OpenShiftModal
        isOpen={isOpenModalVisible}
        onClose={() => setIsOpenModalVisible(false)}
        onConfirm={openShift}
        expectedBalance={getExpectedOpeningBalance()}
      />
    </div>
  );
}
