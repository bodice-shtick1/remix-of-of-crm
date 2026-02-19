import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Bell, BellRing, Loader2, Plus, Trash2, User, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { useClientInteractions, ClientInteraction } from '@/hooks/useClientInteractions';
import { useAuth } from '@/hooks/useAuth';
import { usePermissions } from '@/hooks/usePermissions';

interface ClientNotesTabProps {
  clientId: string;
}

export function ClientNotesTab({ clientId }: ClientNotesTabProps) {
  const { user, userRole } = useAuth();
  const { can } = usePermissions();
  const isAdmin = userRole === 'admin';
  const { interactions, isLoading, createInteraction, deleteInteraction, markAsCompleted } = useClientInteractions(clientId);
  
  const [newContent, setNewContent] = useState('');
  const [reminderDate, setReminderDate] = useState<Date | undefined>();
  const [reminderTime, setReminderTime] = useState('09:00');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const handleSubmit = async () => {
    if (!newContent.trim()) return;

    setIsSubmitting(true);
    try {
      let fullReminderDate: string | null = null;
      
      if (reminderDate) {
        const [hours, minutes] = reminderTime.split(':').map(Number);
        const dateWithTime = new Date(reminderDate);
        dateWithTime.setHours(hours, minutes, 0, 0);
        fullReminderDate = dateWithTime.toISOString();
      }

      await createInteraction({
        content: newContent.trim(),
        reminder_date: fullReminderDate,
      });

      setNewContent('');
      setReminderDate(undefined);
      setReminderTime('09:00');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить заметку?')) return;
    await deleteInteraction(id);
  };

  const isReminderPast = (date: string) => {
    return new Date(date) <= new Date();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Add Note Form */}
      {can('notes_manage') && (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Добавить заметку
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {can('notes_manage') && (
          <Textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Введите текст заметки или задачи..."
            rows={3}
          />
          )}
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                      'gap-2',
                      reminderDate && 'border-primary text-primary'
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    {reminderDate 
                      ? format(reminderDate, 'd MMM yyyy', { locale: ru })
                      : 'Напоминание'
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={reminderDate}
                    onSelect={(date) => {
                      setReminderDate(date);
                      setCalendarOpen(false);
                    }}
                    disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                    initialFocus
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
              
              {reminderDate && (
                <>
                  <Input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="w-24 h-9"
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setReminderDate(undefined);
                      setReminderTime('09:00');
                    }}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    Убрать
                  </Button>
                </>
              )}
            </div>
            
            <div className="flex-1" />
            
            <Button
              onClick={handleSubmit}
              disabled={!newContent.trim() || isSubmitting}
              className="gap-2"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Добавить
            </Button>
          </div>
        </CardContent>
      </Card>
      )}

      {/* Notes List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            Заметки и задачи ({interactions.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {interactions.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
              <p className="text-muted-foreground text-sm">Нет заметок</p>
            </div>
          ) : (
            <ScrollArea className="h-[400px] pr-4">
              <div className="space-y-3">
                {interactions.map((interaction) => (
                  <NoteCard
                    key={interaction.id}
                    interaction={interaction}
                    onDelete={() => handleDelete(interaction.id)}
                    onComplete={() => markAsCompleted(interaction.id)}
                    isReminderPast={interaction.reminder_date ? isReminderPast(interaction.reminder_date) : false}
                    isAdmin={isAdmin}
                    canManageNotes={can('notes_manage')}
                  />
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

interface NoteCardProps {
  interaction: ClientInteraction;
  onDelete: () => void;
  onComplete: () => void;
  isReminderPast: boolean;
  isAdmin?: boolean;
  canManageNotes?: boolean;
}

function NoteCard({ interaction, onDelete, onComplete, isReminderPast, isAdmin, canManageNotes }: NoteCardProps) {
  return (
    <div
      className={cn(
        'p-4 rounded-lg border transition-colors',
        interaction.is_completed 
          ? 'bg-muted/30 border-border opacity-60' 
          : interaction.reminder_date && isReminderPast
            ? 'bg-warning/5 border-warning/50'
            : 'bg-card border-border hover:border-primary/30'
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          {/* Reminder badge */}
          {interaction.reminder_date && !interaction.is_completed && (
            <div className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium mb-2',
              isReminderPast 
                ? 'bg-warning/10 text-warning' 
                : 'bg-primary/10 text-primary'
            )}>
              {isReminderPast ? (
                <BellRing className="h-3 w-3" />
              ) : (
                <Bell className="h-3 w-3" />
              )}
              {format(parseISO(interaction.reminder_date), 'd MMM yyyy, HH:mm', { locale: ru })}
            </div>
          )}
          
          {/* Content */}
          <p className={cn(
            'text-sm whitespace-pre-wrap',
            interaction.is_completed ? 'line-through text-muted-foreground' : 'text-foreground'
          )}>
            {interaction.content}
          </p>
          
          {/* Meta */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(parseISO(interaction.created_at), 'd MMM yyyy, HH:mm', { locale: ru })}
            </span>
            {interaction.creator_name && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {interaction.creator_name}
              </span>
            )}
          </div>
        </div>
        
        {/* Actions */}
        <div className="flex items-center gap-1">
          {!interaction.is_completed && interaction.reminder_date && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-success hover:text-success hover:bg-success/10"
              onClick={onComplete}
              title="Отметить выполненным"
            >
              <Clock className="h-4 w-4" />
            </Button>
          )}
          {canManageNotes && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
