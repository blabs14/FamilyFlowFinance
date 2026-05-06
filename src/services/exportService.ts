import { supabase } from '../lib/supabaseClient';
import { CashflowEvent, DailyCashflowSummary } from '../types/cashflow';
import { format } from 'date-fns';
import { pt } from 'date-fns/locale';

export interface ExportData {
  transactions: any[];
  accounts: any[];
  categories: any[];
  dateRange: {
    start: string;
    end: string;
  };
}

export interface ExportOptions {
  format: 'pdf' | 'csv' | 'excel';
  dateRange: {
    start: string;
    end: string;
  };
  includeCharts?: boolean;
}

export interface CashflowExportOptions {
  format: 'csv' | 'ics';
  filename?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

interface CategoryStats {
  receitas: number;
  despesas: number;
}

/**
 * Exporta relatório em formato PDF
 */
export const exportToPDF = async (data: ExportData, options: ExportOptions): Promise<Blob> => {
  const { default: jsPDF } = await import('jspdf');
  const { default: autoTable } = await import('jspdf-autotable');
  const doc = new jsPDF();
  
  // Título
  doc.setFontSize(20);
  doc.text('Relatório Financeiro', 105, 20, { align: 'center' });
  
  // Período
  doc.setFontSize(12);
  doc.text(`Período: ${new Date(options.dateRange.start).toLocaleDateString('pt-PT')} - ${new Date(options.dateRange.end).toLocaleDateString('pt-PT')}`, 20, 35);
  
  // Resumo
  const totalIncome = data.transactions
    .filter(t => t.tipo === 'receita')
    .reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
  
  const totalExpenses = data.transactions
    .filter(t => t.tipo === 'despesa')
    .reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
  
  const balance = totalIncome - totalExpenses;
  
  doc.setFontSize(14);
  doc.text('Resumo Financeiro', 20, 50);
  doc.setFontSize(10);
  doc.text(`Receitas: ${totalIncome.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`, 20, 60);
  doc.text(`Despesas: ${totalExpenses.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`, 20, 70);
  doc.text(`Saldo: ${balance.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' })}`, 20, 80);
  
  // Tabela de transações
  if (data.transactions.length > 0) {
    doc.setFontSize(14);
    doc.text('Transações', 20, 100);
    
    const tableData = data.transactions.map(t => [
      new Date(t.data).toLocaleDateString('pt-PT'),
      t.descricao || '-',
      t.tipo === 'receita' ? '+' : '-',
      ((t.amount_cents || 0) / 100).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }),
      t.categoria_nome || '-',
      t.account_nome || '-',
    ]);
    
    (autoTable as any)(doc, {
      head: [['Data', 'Descrição', 'Tipo', 'Valor', 'Categoria', 'Conta']],
      body: tableData,
      startY: 110,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
      },
    });
  }
  
  // Estatísticas por categoria
  if (data.transactions.length > 0) {
    const categoryStats = data.transactions.reduce((acc, t) => {
      const category = t.categoria_nome || 'Sem categoria';
      if (!acc[category]) {
        acc[category] = { receitas: 0, despesas: 0 };
      }
      if (t.tipo === 'receita') {
        acc[category].receitas += (t.amount_cents || 0) / 100;
      } else {
        acc[category].despesas += (t.amount_cents || 0) / 100;
      }
      return acc;
    }, {} as Record<string, CategoryStats>);
    
    const categoryData = Object.entries(categoryStats).map(([category, stats]) => [
      category,
      stats.receitas.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }),
        stats.despesas.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }),
    ]);
    
    doc.addPage();
    doc.setFontSize(14);
    doc.text('Estatísticas por Categoria', 20, 20);
    
    (autoTable as any)(doc, {
      head: [['Categoria', 'Receitas', 'Despesas']],
      body: categoryData,
      startY: 30,
      styles: {
        fontSize: 8,
        cellPadding: 2,
      },
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
      },
    });
  }
  
  return doc.output('blob');
};

/**
 * Exporta relatório em formato CSV
 */
export const exportToCSV = (data: ExportData, options: ExportOptions): Blob => {
  const headers = ['Data', 'Descrição', 'Tipo', 'Valor', 'Categoria', 'Conta'];
  const csvData = data.transactions.map(t => [
    new Date(t.data).toLocaleDateString('pt-PT'),
    t.descricao || '',
    t.tipo,
    ((t.amount_cents || 0) / 100).toFixed(2),
    t.categoria_nome || '',
    t.account_nome || '',
  ]);
  
  const csvContent = [
    headers.join(','),
    ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  return new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
};

/**
 * Exporta relatório em formato Excel
 */
export const exportToExcel = async (data: ExportData, options: ExportOptions): Promise<Blob> => {
  const ExcelJS = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  
  // Planilha de transações
  const transactionSheet = workbook.addWorksheet('Transações');
  
  // Cabeçalhos da planilha de transações
  transactionSheet.addRow(['Data', 'Descrição', 'Tipo', 'Valor', 'Categoria', 'Conta']);
  
  // Dados das transações
  data.transactions.forEach(t => {
    transactionSheet.addRow([
      new Date(t.data).toLocaleDateString('pt-PT'),
      t.descricao || '',
      t.tipo,
      (t.amount_cents || 0) / 100,
      t.categoria_nome || '',
      t.account_nome || '',
    ]);
  });
  
  // Planilha de estatísticas
  const categoryStats = data.transactions.reduce((acc, t) => {
    const category = t.categoria_nome || 'Sem categoria';
    if (!acc[category]) {
      acc[category] = { receitas: 0, despesas: 0 };
    }
    if (t.tipo === 'receita') {
      acc[category].receitas += (t.amount_cents || 0) / 100;
    } else {
      acc[category].despesas += (t.amount_cents || 0) / 100;
    }
    return acc;
  }, {} as Record<string, CategoryStats>);
  
  const statsSheet = workbook.addWorksheet('Estatísticas');
  statsSheet.addRow(['Categoria', 'Receitas', 'Despesas', 'Saldo']);
  
  Object.entries(categoryStats).forEach(([category, stats]) => {
    statsSheet.addRow([
      category,
      stats.receitas,
        stats.despesas,
        stats.receitas - stats.despesas,
    ]);
  });
  
  // Planilha de resumo
  const totalIncome = data.transactions
    .filter(t => t.tipo === 'receita')
    .reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
  
  const totalExpenses = data.transactions
    .filter(t => t.tipo === 'despesa')
    .reduce((sum, t) => sum + (t.amount_cents || 0) / 100, 0);
  
  const summarySheet = workbook.addWorksheet('Resumo');
  summarySheet.addRow(['Item', 'Valor']);
  summarySheet.addRow(['Receitas Totais', totalIncome]);
  summarySheet.addRow(['Despesas Totais', totalExpenses]);
  summarySheet.addRow(['Saldo', totalIncome - totalExpenses]);
  
  // Gerar o buffer do Excel
  const excelBuffer = await workbook.xlsx.writeBuffer();
  return new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
};

/**
 * Busca dados para exportação
 */
export const fetchExportData = async (userId: string, dateRange: { start: string; end: string }): Promise<ExportData> => {
  // Buscar transações
  const { data: transactions, error: transactionsError } = await supabase
    .from('transactions')
    .select(`
      *,
      categories(nome),
      accounts(nome)
    `)
    .eq('user_id', userId)
    .gte('data', dateRange.start)
    .lte('data', dateRange.end)
    .order('data', { ascending: false });
  
  if (transactionsError) throw transactionsError;
  
  // Buscar contas
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('user_id', userId);
  
  if (accountsError) throw accountsError;
  
  // Buscar categorias
  const { data: categories, error: categoriesError } = await supabase
    .from('categories')
    .select('*')
    .eq('user_id', userId);
  
  if (categoriesError) throw categoriesError;
  
  // Processar dados
  const processedTransactions = (transactions || []).map(t => ({
    ...t,
    categoria_nome: t.categories?.nome || 'Sem categoria',
    account_nome: t.accounts?.nome || 'Sem conta',
  }));
  
  return {
    transactions: processedTransactions,
    accounts: accounts || [],
    categories: categories || [],
    dateRange,
  };
};

/**
 * Função principal de exportação
 */
export const exportReport = async (
  userId: string,
  options: ExportOptions
): Promise<{ blob: Blob; filename: string }> => {
  const data = await fetchExportData(userId, options.dateRange);
  
  let blob: Blob;
  let filename: string;
  
  const dateRangeStr = `${new Date(options.dateRange.start).toISOString().split('T')[0]}_${new Date(options.dateRange.end).toISOString().split('T')[0]}`;
  
  switch (options.format) {
    case 'pdf':
      blob = await exportToPDF(data, options);
      filename = `relatorio_financeiro_${dateRangeStr}.pdf`;
      break;
    case 'csv':
      blob = exportToCSV(data, options);
      filename = `relatorio_financeiro_${dateRangeStr}.csv`;
      break;
    case 'excel':
      blob = await exportToExcel(data, options);
      filename = `relatorio_financeiro_${dateRangeStr}.xlsx`;
      break;
    default:
      throw new Error('Formato não suportado');
  }
  
  return { blob, filename };
};

// ===== FUNCIONALIDADES DE EXPORTAÇÃO DO CALENDÁRIO DE FLUXOS =====

/**
 * Converte eventos de fluxo de caixa para formato CSV
 */
export function exportCashflowToCsv(events: CashflowEvent[], summaries: DailyCashflowSummary[]): string {
  const headers = [
    'Data',
    'Tipo',
    'Descrição',
    'Categoria',
    'Valor',
    'Moeda',
    'Conta',
    'Escopo',
    'Saldo Diário',
    'Receitas Diárias',
    'Despesas Diárias'
  ];

  const rows = events.map(event => {
    const eventDate = format(new Date(event.date), 'dd/MM/yyyy', { locale: pt });
    const summary = summaries.find(s => s.date === event.date);
    
    return [
      eventDate,
      getCashflowEventTypeLabel(event.type),
      event.description,
      event.category || '',
      (event.amount_cents / 100).toFixed(2),
      event.currency,
      event.account_name || '',
      event.scope === 'personal' ? 'Pessoal' : 'Família',
      summary ? (summary.net_balance_cents / 100).toFixed(2) : '0.00',
      summary ? (summary.total_income_cents / 100).toFixed(2) : '0.00',
      summary ? (summary.total_expenses_cents / 100).toFixed(2) : '0.00'
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');

  return csvContent;
}

/**
 * Converte eventos de fluxo de caixa para formato ICS (iCalendar)
 */
export function exportCashflowToIcs(events: CashflowEvent[]): string {
  const now = new Date();
  const timestamp = format(now, "yyyyMMdd'T'HHmmss'Z'");
  
  let icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//FinanceApp//Cashflow Calendar//PT',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Fluxo de Caixa',
    'X-WR-CALDESC:Calendário de previsões financeiras'
  ].join('\r\n');

  events.forEach((event, index) => {
    const eventDate = format(new Date(event.date), 'yyyyMMdd');
    const uid = `cashflow-${event.id || index}-${timestamp}@financeapp.local`;
    const summary = `${getCashflowEventTypeLabel(event.type)}: ${event.description}`;
    const description = [
      `Tipo: ${getCashflowEventTypeLabel(event.type)}`,
      `Valor: ${(event.amount_cents / 100).toFixed(2)} ${event.currency}`,
      event.category ? `Categoria: ${event.category}` : '',
      event.account_name ? `Conta: ${event.account_name}` : '',
      `Escopo: ${event.scope === 'personal' ? 'Pessoal' : 'Família'}`
    ].filter(Boolean).join('\\n');

    icsContent += '\r\n' + [
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTAMP:${timestamp}`,
      `DTSTART;VALUE=DATE:${eventDate}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `CATEGORIES:${event.type.includes('income') || event.amount_cents > 0 ? 'RECEITA' : 'DESPESA'}`,
      'STATUS:TENTATIVE',
      'TRANSP:TRANSPARENT',
      'END:VEVENT'
    ].join('\r\n');
  });

  icsContent += '\r\nEND:VCALENDAR';
  return icsContent;
}

/**
 * Faz download de um arquivo
 */
export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Exporta eventos de fluxo de caixa
 */
export function exportCashflowData(
  events: CashflowEvent[],
  summaries: DailyCashflowSummary[],
  options: CashflowExportOptions
): void {
  const timestamp = format(new Date(), 'yyyy-MM-dd_HH-mm-ss');
  const baseFilename = options.filename || `fluxo-caixa_${timestamp}`;
  
  let content: string;
  let filename: string;
  let mimeType: string;
  
  if (options.format === 'csv') {
    content = exportCashflowToCsv(events, summaries);
    filename = `${baseFilename}.csv`;
    mimeType = 'text/csv;charset=utf-8';
  } else if (options.format === 'ics') {
    content = exportCashflowToIcs(events);
    filename = `${baseFilename}.ics`;
    mimeType = 'text/calendar;charset=utf-8';
  } else {
    throw new Error(`Formato de exportação não suportado: ${options.format}`);
  }
  
  downloadFile(content, filename, mimeType);
}

/**
 * Obtém o rótulo legível para um tipo de evento de fluxo de caixa
 */
function getCashflowEventTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    'recurring_income': 'Receita Recorrente',
    'recurring_expense': 'Despesa Recorrente',
    'subscription': 'Subscrição',
    'goal_funding': 'Funding de Objetivo',
    'credit_card_payment': 'Pagamento Cartão',
    'credit_card_due': 'Vencimento Cartão',
    'scheduled_transaction': 'Transação Agendada',
    'income': 'Receita',
    'expense': 'Despesa'
  };
  
  return labels[type] || type;
}

/**
 * Filtra eventos por intervalo de datas
 */
export function filterCashflowEventsByDateRange(
  events: CashflowEvent[],
  startDate: Date,
  endDate: Date
): CashflowEvent[] {
  return events.filter(event => {
    const eventDate = new Date(event.date);
    return eventDate >= startDate && eventDate <= endDate;
  });
}

/**
 * Filtra resumos por intervalo de datas
 */
export function filterCashflowSummariesByDateRange(
  summaries: DailyCashflowSummary[],
  startDate: Date,
  endDate: Date
): DailyCashflowSummary[] {
  return summaries.filter(summary => {
    const summaryDate = new Date(summary.date);
    return summaryDate >= startDate && summaryDate <= endDate;
  });
}