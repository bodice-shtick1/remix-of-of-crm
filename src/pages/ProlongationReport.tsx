import { useState, useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import { format, parseISO, addMonths } from 'date-fns';
import { ru } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Printer, RefreshCcw, CalendarRange, ExternalLink } from 'lucide-react';
import { ServerPagination } from '@/components/common/ServerPagination';
import { Skeleton } from '@/components/ui/skeleton';
import { MaskedPhone } from '@/components/common/MaskedPhone';
import { maskPhone } from '@/hooks/useContactMasking';

interface PolicyWithHistory {
  id: string;
  policy_number: string;
  policy_type: string;
  end_date: string;
  insurance_company: string;
  premium_amount: number;
  vehicle_model: string | null;
  vehicle_number: string | null;
  client_id: string;
  client_name: string;
  client_phone: string;
  prev_premium: number | null;
  prev_total: number | null;
}

interface InsuranceCompany {
  id: string;
  name: string;
}

export default function ProlongationReport() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [policies, setPolicies] = useState<PolicyWithHistory[]>([]);
  const [companies, setCompanies] = useState<InsuranceCompany[]>([]);

  // Filters
  const [dateFrom, setDateFrom] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(() => format(addMonths(new Date(), 1), 'yyyy-MM-dd'));
  const [selectedCompany, setSelectedCompany] = useState<string>('all');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const tableRef = useRef<HTMLDivElement>(null);

  // Get user display name
  const getUserDisplayName = () => {
    if (!user) return 'Неизвестный пользователь';
    // Try to get name from user metadata
    const metadata = user.user_metadata;
    if (metadata?.full_name) return metadata.full_name;
    if (metadata?.name) return metadata.name;
    if (metadata?.first_name) {
      return metadata.last_name 
        ? `${metadata.first_name} ${metadata.last_name}` 
        : metadata.first_name;
    }
    // Fallback to email
    return user.email || 'Неизвестный пользователь';
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      const { data: companiesData } = await supabase
        .from('insurance_companies')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (companiesData) {
        setCompanies(companiesData);
      }

      let query = supabase
        .from('policies')
        .select(`
          id,
          policy_number,
          policy_type,
          end_date,
          insurance_company,
          premium_amount,
          vehicle_model,
          vehicle_number,
          client_id,
          clients!inner (
            id,
            first_name,
            last_name,
            middle_name,
            company_name,
            is_company,
            phone
          )
        `)
        .eq('status', 'active')
        .gte('end_date', dateFrom)
        .lte('end_date', dateTo)
        .order('end_date', { ascending: true });

      const { data: policiesData, error } = await query;

      if (error) throw error;

      if (!policiesData || policiesData.length === 0) {
        setPolicies([]);
        setIsLoading(false);
        return;
      }

      const policiesWithHistory: PolicyWithHistory[] = await Promise.all(
        policiesData.map(async (policy: any) => {
          const client = policy.clients;
          const clientName = client.is_company
            ? client.company_name || ''
            : `${client.last_name} ${client.first_name} ${client.middle_name || ''}`.trim();

          let prevQuery = supabase
            .from('policies')
            .select('premium_amount')
            .eq('client_id', client.id)
            .neq('id', policy.id)
            .eq('status', 'active')
            .lt('end_date', policy.end_date)
            .order('end_date', { ascending: false })
            .limit(1);

          if (policy.vehicle_number) {
            const { data: prevByVehicle } = await supabase
              .from('policies')
              .select('premium_amount')
              .eq('client_id', client.id)
              .eq('vehicle_number', policy.vehicle_number)
              .neq('id', policy.id)
              .lt('end_date', policy.end_date)
              .order('end_date', { ascending: false })
              .limit(1);

            if (prevByVehicle && prevByVehicle.length > 0) {
              const { data: prevSale } = await supabase
                .from('sales')
                .select('total_amount')
                .eq('client_id', client.id)
                .eq('status', 'completed')
                .order('completed_at', { ascending: false })
                .limit(2);

              const prevTotal = prevSale && prevSale.length > 1 ? prevSale[1].total_amount : null;

              return {
                id: policy.id,
                policy_number: policy.policy_number,
                policy_type: policy.policy_type,
                end_date: policy.end_date,
                insurance_company: policy.insurance_company,
                premium_amount: Number(policy.premium_amount),
                vehicle_model: policy.vehicle_model,
                vehicle_number: policy.vehicle_number,
                client_id: client.id,
                client_name: clientName,
                client_phone: client.phone,
                prev_premium: Number(prevByVehicle[0].premium_amount),
                prev_total: prevTotal ? Number(prevTotal) : null,
              };
            }
          }

          const { data: prevPolicy } = await prevQuery;
          
          const { data: prevSales } = await supabase
            .from('sales')
            .select('total_amount')
            .eq('client_id', client.id)
            .eq('status', 'completed')
            .order('completed_at', { ascending: false })
            .limit(2);

          const prevTotal = prevSales && prevSales.length > 1 ? prevSales[1].total_amount : null;

          return {
            id: policy.id,
            policy_number: policy.policy_number,
            policy_type: policy.policy_type,
            end_date: policy.end_date,
            insurance_company: policy.insurance_company,
            premium_amount: Number(policy.premium_amount),
            vehicle_model: policy.vehicle_model,
            vehicle_number: policy.vehicle_number,
            client_id: client.id,
            client_name: clientName,
            client_phone: client.phone,
            prev_premium: prevPolicy && prevPolicy.length > 0 ? Number(prevPolicy[0].premium_amount) : null,
            prev_total: prevTotal ? Number(prevTotal) : null,
          };
        })
      );

      setPolicies(policiesWithHistory);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: 'Ошибка загрузки',
        description: 'Не удалось загрузить данные',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [dateFrom, dateTo]);

  const filteredPolicies = useMemo(() => {
    if (selectedCompany === 'all') return policies;
    return policies.filter(p => p.insurance_company === selectedCompany);
  }, [policies, selectedCompany]);

  // Reset page on filter change
  useEffect(() => { setPage(0); }, [selectedCompany, dateFrom, dateTo]);

  const totalCount = filteredPolicies.length;
  const totalPages = Math.ceil(totalCount / pageSize);
  const paginatedPolicies = useMemo(() => {
    const from = page * pageSize;
    return filteredPolicies.slice(from, from + pageSize);
  }, [filteredPolicies, page, pageSize]);

  const handlePageChange = (p: number) => {
    setPage(p);
    tableRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(0);
  };

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—';
    return value.toLocaleString('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 });
  };

  const formatDate = (dateStr: string) => {
    return format(parseISO(dateStr), 'dd.MM.yyyy');
  };

  const handlePrint = () => {
    const now = new Date();
    const generatedDate = format(now, 'dd.MM.yyyy');
    const generatedTime = format(now, 'HH:mm:ss');
    const userName = getUserDisplayName();

    // Build table rows
    const tableRows = filteredPolicies.map(p => `
      <tr>
        <td>${p.client_name}</td>
        <td style="font-family: monospace; font-size: 9pt;">${maskPhone(p.client_phone)}</td>
        <td>${p.insurance_company}</td>
        <td>${p.vehicle_model || '—'}</td>
        <td style="font-family: monospace;">${p.vehicle_number || '—'}</td>
        <td style="font-family: monospace; font-size: 9pt;">${p.policy_number}</td>
        <td>${formatDate(p.end_date)}</td>
        <td style="text-align: right;">${p.prev_premium !== null ? p.prev_premium.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
        <td style="text-align: right;">${p.prev_total !== null ? p.prev_total.toLocaleString('ru-RU') + ' ₽' : '—'}</td>
      </tr>
    `).join('');

    const printContent = `
      <!DOCTYPE html>
      <html lang="ru">
      <head>
        <meta charset="UTF-8">
        <title>Отчёт по пролонгации</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          @page {
            size: A4 landscape;
            margin: 10mm;
          }
          
          body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.4;
            padding: 10mm;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
          }
          
          .header {
            margin-bottom: 15px;
          }
          
          .header h1 {
            font-size: 16pt;
            font-weight: bold;
            margin-bottom: 5px;
          }
          
          .header .period {
            font-size: 11pt;
            margin-bottom: 10px;
          }
          
          .meta-info {
            font-size: 10pt;
            color: #555;
            margin-bottom: 15px;
            border-bottom: 1px solid #ddd;
            padding-bottom: 10px;
          }
          
          .meta-info p {
            margin-bottom: 3px;
          }
          
          .content {
            flex: 1;
          }
          
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 9pt;
          }
          
          th, td {
            border: 1px solid #ccc;
            padding: 5px 8px;
            text-align: left;
            vertical-align: top;
          }
          
          th {
            background-color: #f0f0f0;
            font-weight: 600;
            font-size: 9pt;
          }
          
          tr:nth-child(even) {
            background-color: #fafafa;
          }
          
          .summary {
            margin-top: 15px;
            font-size: 10pt;
          }
          
          .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
          }
          
          .signature-line {
            font-size: 10pt;
            margin-top: 30px;
          }
          
          .signature-line .line {
            display: inline-block;
            width: 250px;
            border-bottom: 1px solid #000;
            margin-left: 10px;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Отчёт по пролонгации</h1>
          <p class="period">
            Период: ${formatDate(dateFrom)} — ${formatDate(dateTo)}
            ${selectedCompany !== 'all' ? ` | СК: ${selectedCompany}` : ''}
          </p>
        </div>
        
        <div class="meta-info">
          <p><strong>Сформировано:</strong> ${generatedDate} в ${generatedTime}</p>
          <p><strong>Отчет подготовил:</strong> ${userName}</p>
        </div>
        
        <div class="content">
          <table>
            <thead>
              <tr>
                <th>ФИО</th>
                <th>Телефон</th>
                <th>СК</th>
                <th>Марка</th>
                <th>Гос. номер</th>
                <th>Номер полиса</th>
                <th>Дата оконч.</th>
                <th style="text-align: right;">Прош. ОСАГО</th>
                <th style="text-align: right;">Прош. чек</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
          
          <div class="summary">
            Всего полисов: <strong>${filteredPolicies.length}</strong>
          </div>
        </div>
        
        <div class="footer">
          <div class="signature-line">
            Подпись ответственного лица: <span class="line"></span>
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(printContent);
      printWindow.document.close();
    }
  };

  return (
    <div className="p-4 lg:p-6 pb-24 overflow-auto max-h-[calc(100vh-48px)]">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Отчёт по пролонгации</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Полисы, срок действия которых заканчивается в выбранный период
        </p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarRange className="h-4 w-4" />
            Фильтры
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label>Дата от</Label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Дата до</Label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-[160px]"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Страховая компания</Label>
              <Select value={selectedCompany} onValueChange={setSelectedCompany}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Все компании" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все компании</SelectItem>
                  {companies.map((c) => (
                    <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={loadData} disabled={isLoading} className="gap-2">
              <RefreshCcw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              Обновить
            </Button>
            <div className="flex-1" />
            <Button onClick={handlePrint} disabled={filteredPolicies.length === 0} className="gap-2">
              <Printer className="h-4 w-4" />
              Печать
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Data table */}
      <div ref={tableRef} />
      {isLoading ? (
        <Card>
          <CardContent className="p-4 space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ) : filteredPolicies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CalendarRange className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-medium text-lg mb-1">Нет полисов</h3>
            <p className="text-muted-foreground">
              В выбранный период нет полисов с истекающим сроком
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ФИО</TableHead>
                    <TableHead>Телефон</TableHead>
                    <TableHead>СК</TableHead>
                    <TableHead>Марка</TableHead>
                    <TableHead>Гос. номер</TableHead>
                    <TableHead>Номер полиса</TableHead>
                    <TableHead>Дата оконч.</TableHead>
                    <TableHead className="text-right">Прош. ОСАГО</TableHead>
                    <TableHead className="text-right">Прош. чек</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedPolicies.map((policy) => (
                    <TableRow key={policy.id}>
                      <TableCell>
                        <Link
                          to={`/clients?search=${encodeURIComponent(policy.client_phone)}`}
                          className="text-primary hover:underline flex items-center gap-1"
                        >
                          {policy.client_name}
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        <MaskedPhone
                          phone={policy.client_phone}
                          clientId={policy.client_id}
                          clientName={policy.client_name}
                          context="Отчёт по пролонгации"
                        />
                      </TableCell>
                      <TableCell>{policy.insurance_company}</TableCell>
                      <TableCell>{policy.vehicle_model || '—'}</TableCell>
                      <TableCell className="font-mono">{policy.vehicle_number || '—'}</TableCell>
                      <TableCell className="font-mono text-sm">{policy.policy_number}</TableCell>
                      <TableCell>{formatDate(policy.end_date)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(policy.prev_premium)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(policy.prev_total)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {filteredPolicies.length > 0 && (
        <ServerPagination
          page={page}
          totalPages={totalPages}
          totalCount={totalCount}
          pageSize={pageSize}
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
          label="полисов"
        />
      )}
    </div>
  );
}
