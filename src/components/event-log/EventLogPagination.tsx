import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';

interface Props {
  page: number;
  totalPages: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

const PAGE_SIZES = [20, 50, 100];

export function EventLogPagination({
  page, totalPages, totalCount, pageSize,
  onPageChange, onPageSizeChange, isLoading,
}: Props) {
  const from = totalCount === 0 ? 0 : page * pageSize + 1;
  const to = Math.min((page + 1) * pageSize, totalCount);

  return (
    <div className="flex items-center justify-between mt-2 px-1 gap-2 flex-wrap">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          Всего событий: <span className="font-medium text-foreground">{totalCount}</span>
          {totalCount > 0 && (
            <> | Показано: <span className="font-medium text-foreground">{from}—{to}</span></>
          )}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground mr-1">По:</span>
        <Select value={String(pageSize)} onValueChange={v => onPageSizeChange(Number(v))}>
          <SelectTrigger className="h-7 w-16 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="z-50">
            {PAGE_SIZES.map(s => (
              <SelectItem key={s} value={String(s)}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-0.5 ml-2">
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(0)}
            disabled={page === 0 || isLoading}
            title="Первая страница"
          >
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page - 1)}
            disabled={page === 0 || isLoading}
            title="Назад"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>

          <span className="text-xs text-muted-foreground px-2 whitespace-nowrap">
            {totalPages > 0 ? `${page + 1} / ${totalPages}` : '—'}
          </span>

          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages - 1 || isLoading}
            title="Вперёд"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="outline" size="icon"
            className="h-7 w-7"
            onClick={() => onPageChange(totalPages - 1)}
            disabled={page >= totalPages - 1 || isLoading}
            title="Последняя страница"
          >
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
