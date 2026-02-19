import { Task, Client } from '@/types/crm';
import { 
  RefreshCcw, 
  Cake, 
  Phone, 
  CreditCard, 
  CheckCircle2,
  Clock,
  AlertCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TaskListProps {
  tasks: Task[];
  clients: Client[];
  title: string;
  emptyMessage?: string;
}

const taskTypeConfig = {
  renewal: { icon: RefreshCcw, color: 'text-primary', bg: 'bg-primary/10' },
  birthday: { icon: Cake, color: 'text-pink-500', bg: 'bg-pink-500/10' },
  call: { icon: Phone, color: 'text-accent', bg: 'bg-accent/10' },
  payment: { icon: CreditCard, color: 'text-success', bg: 'bg-success/10' },
  custom: { icon: CheckCircle2, color: 'text-muted-foreground', bg: 'bg-muted' },
};

const priorityConfig = {
  high: { icon: AlertCircle, color: 'text-destructive', label: 'Срочно' },
  medium: { icon: Clock, color: 'text-warning', label: 'Важно' },
  low: { icon: Clock, color: 'text-muted-foreground', label: 'Обычно' },
};

export function TaskList({ tasks, clients, title, emptyMessage = 'Нет задач' }: TaskListProps) {
  const getClientName = (clientId?: string) => {
    if (!clientId) return '';
    const client = clients.find(c => c.id === clientId);
    if (!client) return '';
    return client.isCompany 
      ? client.companyName 
      : `${client.lastName} ${client.firstName.charAt(0)}.${client.middleName ? client.middleName.charAt(0) + '.' : ''}`;
  };

  if (tasks.length === 0) {
    return (
      <div className="card-elevated p-6">
        <h3 className="font-semibold text-foreground mb-4">{title}</h3>
        <div className="text-center py-8 text-muted-foreground">
          <CheckCircle2 className="h-10 w-10 mx-auto mb-2 text-success/50" />
          <p>{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card-elevated">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-foreground">{title}</h3>
          <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
            {tasks.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-border">
        {tasks.map((task, index) => {
          const typeConfig = taskTypeConfig[task.type];
          const priority = priorityConfig[task.priority];
          const Icon = typeConfig.icon;
          
          return (
            <div 
              key={task.id} 
              className="task-card rounded-none border-0 border-b-0"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <div className="flex items-start gap-3">
                <div className={cn('p-2 rounded-lg shrink-0', typeConfig.bg)}>
                  <Icon className={cn('h-4 w-4', typeConfig.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-sm font-medium text-foreground line-clamp-1">
                      {task.title}
                    </h4>
                    {task.priority === 'high' && (
                      <span className="status-badge status-danger shrink-0">
                        Срочно
                      </span>
                    )}
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {task.description}
                    </p>
                  )}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(task.dueDate).toLocaleDateString('ru-RU', { 
                        day: 'numeric', 
                        month: 'short' 
                      })}
                    </span>
                    {task.clientId && (
                      <span className="text-xs text-primary font-medium">
                        {getClientName(task.clientId)}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
