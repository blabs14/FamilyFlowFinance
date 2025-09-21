import React, { useState, useMemo } from 'react';
import { Calendar, Filter, TrendingUp, TrendingDown, Eye, EyeOff } from 'lucide-react';
import { Button } from '../ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Checkbox } from '../ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../ui/collapsible';
import { DailyCashflowSummary, CashflowEvent, CashflowEventType } from '../../types/cashflow';
import { formatCurrency } from '../../lib/utils';

interface CashflowListProps {
  dailySummaries: DailyCashflowSummary[];
  currency?: string;
  onDateSelect?: (date: string) => void;
}

interface ListFilters {
  searchTerm: string;
  eventTypes: CashflowEventType[];
  showOnlyWithEvents: boolean;
  dateRange: 'all' | '7days' | '15days' | '30days';
}

export function CashflowList({ 
  dailySummaries, 
  currency = 'EUR', 
  onDateSelect 
}: CashflowListProps) {
  const [filters, setFilters] = useState<ListFilters>({
    searchTerm: '',
    eventTypes: [],
    showOnlyWithEvents: false,
    dateRange: 'all'
  });
  
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  // Filtrar e ordenar dados
  const filteredSummaries = useMemo(() => {
    let filtered = [...dailySummaries];
    
    // Filtro por data
    if (filters.dateRange !== 'all') {
      const today = new Date();
      const daysToShow = parseInt(filters.dateRange.replace('days', ''));
      const cutoffDate = new Date(today.getTime() + daysToShow * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter(summary => {
        const summaryDate = new Date(summary.date);
        return summaryDate >= today && summaryDate <= cutoffDate;
      });
    }
    
    // Filtro por eventos
    if (filters.showOnlyWithEvents) {
      filtered = filtered.filter(summary => summary.events.length > 0);
    }
    
    // Filtro por tipos de evento
    if (filters.eventTypes.length > 0) {
      filtered = filtered.filter(summary => 
        summary.events.some(event => filters.eventTypes.includes(event.type))
      );
    }
    
    // Filtro por termo de busca
    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(summary => 
        summary.events.some(event => 
          event.description.toLowerCase().includes(searchLower) ||
          event.payee?.toLowerCase().includes(searchLower)
        )
      );
    }
    
    // Ordenar por data
    return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [dailySummaries, filters]);

  const toggleDayExpansion = (date: string) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(date)) {
        newSet.delete(date);
      } else {
        newSet.add(date);
      }
      return newSet;
    });
  };

  const getEventTypeColor = (eventType: CashflowEventType): string => {
    switch (eventType) {
      case 'recurring_income': return 'bg-green-100 text-green-800';
      case 'recurring_expense': return 'bg-red-100 text-red-800';
      case 'subscription': return 'bg-purple-100 text-purple-800';
      case 'goal_funding': return 'bg-blue-100 text-blue-800';
      case 'credit_card_due': return 'bg-orange-100 text-orange-800';
      case 'scheduled_transaction': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getEventTypeLabel = (eventType: CashflowEventType): string => {
    switch (eventType) {
      case 'recurring_income': return 'Receita Recorrente';
      case 'recurring_expense': return 'Despesa Recorrente';
      case 'subscription': return 'Subscrição';
      case 'goal_funding': return 'Funding de Objetivo';
      case 'credit_card_due': return 'Vencimento Cartão';
      case 'scheduled_transaction': return 'Transação Agendada';
      default: return 'Outro';
    }
  };

  const eventTypeOptions: CashflowEventType[] = [
    'recurring_income',
    'recurring_expense', 
    'subscription',
    'goal_funding',
    'credit_card_due',
    'scheduled_transaction'
  ];

  const updateEventTypeFilter = (eventType: CashflowEventType, checked: boolean) => {
    setFilters(prev => ({
      ...prev,
      eventTypes: checked 
        ? [...prev.eventTypes, eventType]
        : prev.eventTypes.filter(type => type !== eventType)
    }));
  };

  const clearFilters = () => {
    setFilters({
      searchTerm: '',
      eventTypes: [],
      showOnlyWithEvents: false,
      dateRange: 'all'
    });
  };

  const totalIncome = filteredSummaries.reduce((sum, day) => sum + (typeof day.total_income_cents === 'number' ? day.total_income_cents : parseFloat(day.total_income_cents) || 0), 0);
  const totalExpense = filteredSummaries.reduce((sum, day) => sum + (typeof day.total_expense_cents === 'number' ? day.total_expense_cents : parseFloat(day.total_expense_cents) || 0), 0);
  const netFlow = totalIncome - totalExpense;

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Busca */}
            <div>
              <label className="text-sm font-medium mb-2 block">Buscar</label>
              <Input
                placeholder="Descrição ou beneficiário..."
                value={filters.searchTerm}
                onChange={(e) => setFilters(prev => ({ ...prev, searchTerm: e.target.value }))}
              />
            </div>
            
            {/* Período */}
            <div>
              <label className="text-sm font-medium mb-2 block">Período</label>
              <Select
                value={filters.dateRange}
                onValueChange={(value: any) => setFilters(prev => ({ ...prev, dateRange: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os dias</SelectItem>
                  <SelectItem value="7days">Próximos 7 dias</SelectItem>
                  <SelectItem value="15days">Próximos 15 dias</SelectItem>
                  <SelectItem value="30days">Próximos 30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Apenas com eventos */}
            <div className="flex items-center space-x-2 pt-6">
              <Checkbox
                id="showOnlyWithEvents"
                checked={filters.showOnlyWithEvents}
                onCheckedChange={(checked) => 
                  setFilters(prev => ({ ...prev, showOnlyWithEvents: !!checked }))
                }
              />
              <label htmlFor="showOnlyWithEvents" className="text-sm font-medium">
                Apenas dias com eventos
              </label>
            </div>
            
            {/* Limpar filtros */}
            <div className="pt-6">
              <Button variant="outline" onClick={clearFilters} className="w-full">
                Limpar Filtros
              </Button>
            </div>
          </div>
          
          {/* Tipos de evento */}
          <div>
            <label className="text-sm font-medium mb-2 block">Tipos de Evento</label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
              {eventTypeOptions.map(eventType => (
                <div key={eventType} className="flex items-center space-x-2">
                  <Checkbox
                    id={eventType}
                    checked={filters.eventTypes.includes(eventType)}
                    onCheckedChange={(checked) => updateEventTypeFilter(eventType, !!checked)}
                  />
                  <label htmlFor={eventType} className="text-xs">
                    {getEventTypeLabel(eventType)}
                  </label>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(totalIncome / 100, currency)}
              </div>
              <div className="text-sm text-muted-foreground">Total Receitas</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {formatCurrency(totalExpense / 100, currency)}
              </div>
              <div className="text-sm text-muted-foreground">Total Despesas</div>
            </div>
            <div className="text-center">
              <div className={`text-2xl font-bold ${netFlow >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netFlow / 100, currency)}
              </div>
              <div className="text-sm text-muted-foreground">Saldo Líquido</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de dias */}
      <div className="space-y-2">
        {filteredSummaries.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Nenhum resultado encontrado com os filtros aplicados.
            </CardContent>
          </Card>
        ) : (
          filteredSummaries.map((summary) => {
            const isExpanded = expandedDays.has(summary.date);
            const hasEvents = summary.events.length > 0;
            
            return (
              <Card key={summary.date} className="overflow-hidden">
                <Collapsible open={isExpanded} onOpenChange={() => toggleDayExpansion(summary.date)}>
                  <CollapsibleTrigger asChild>
                    <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <div className="font-medium">
                              {new Date(summary.date).toLocaleDateString('pt-PT', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                                year: 'numeric'
                              })}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {hasEvents ? `${summary.events.length} evento(s)` : 'Sem eventos'}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <div className={`font-medium flex items-center gap-1 ${
                              summary.net_flow_cents >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {summary.net_flow_cents >= 0 ? (
                                <TrendingUp className="h-4 w-4" />
                              ) : (
                                <TrendingDown className="h-4 w-4" />
                              )}
                              {formatCurrency(summary.net_flow_cents / 100, currency)}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              Saldo: {formatCurrency(summary.running_balance_cents / 100, currency)}
                            </div>
                          </div>
                          
                          {hasEvents && (
                            <div className="flex items-center">
                              {isExpanded ? (
                                <EyeOff className="h-4 w-4 text-muted-foreground" />
                              ) : (
                                <Eye className="h-4 w-4 text-muted-foreground" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>
                  
                  {hasEvents && (
                    <CollapsibleContent>
                      <CardContent className="pt-0">
                        <div className="space-y-3">
                          {summary.events.map((event, index) => (
                            <div key={event.id || `event-${event.type}-${index}`} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                              <div className="flex items-center gap-3">
                                <Badge 
                                  variant="secondary" 
                                  className={getEventTypeColor(event.type)}
                                >
                                  {getEventTypeLabel(event.type)}
                                </Badge>
                                <div>
                                  <div className="font-medium">{event.description}</div>
                                  {event.payee && (
                                    <div className="text-sm text-muted-foreground">
                                      {event.payee}
                                    </div>
                                  )}
                                  {event.account_name && (
                                    <div className="text-xs text-muted-foreground">
                                      Conta: {event.account_name}
                                    </div>
                                  )}
                                </div>
                              </div>
                              
                              <div className="text-right">
                                <div className={`font-medium ${
                                  event.is_income ? 'text-green-600' : 'text-red-600'
                                }`}>
                                  {event.is_income ? '+' : '-'}
                                  {formatCurrency(event.amount_cents / 100, currency)}
                                </div>
                                {event.category && (
                                  <div className="text-xs text-muted-foreground">
                                    {event.category}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </CollapsibleContent>
                  )}
                </Collapsible>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}