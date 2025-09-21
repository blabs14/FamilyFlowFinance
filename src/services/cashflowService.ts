import { supabase } from '../lib/supabaseClient';
import {
  CashflowEvent,
  CashflowEventType,
  CashflowScope,
  DailyCashflowSummary,
  CashflowPeriod,
  CashflowFilters,
  CashflowProjection,
  RecurringRuleSource,
  GoalFundingSource,
  CreditCardSource,
  AccountBalance
} from '../types/cashflow';

/**
 * Serviço principal para geração de previsões de fluxo de caixa
 */
export class CashflowService {
  private static instance: CashflowService;
  
  static getInstance(): CashflowService {
    if (!CashflowService.instance) {
      CashflowService.instance = new CashflowService();
    }
    return CashflowService.instance;
  }

  /**
   * Gera projeção de fluxo de caixa para os próximos N dias
   */
  async generateCashflowProjection(
    days: number = 30,
    filters: CashflowFilters = {},
    userId?: string,
    familyId?: string
  ): Promise<CashflowProjection> {
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(startDate.getDate() + days);

    // Obter saldos atuais das contas
    const currentBalances = await this.getCurrentAccountBalances(filters, userId, familyId);
    
    // Gerar eventos de fluxo de caixa
    const events = await this.generateCashflowEvents(startDate, endDate, filters, userId, familyId);
    
    // Criar resumos diários
    const dailySummaries = this.createDailySummaries(events, currentBalances, startDate, endDate);
    
    const period: CashflowPeriod = {
      start_date: startDate.toISOString().split('T')[0],
      end_date: endDate.toISOString().split('T')[0],
      daily_summaries: dailySummaries,
      total_income_cents: dailySummaries.reduce((sum, day) => sum + (typeof day.total_income_cents === 'number' ? day.total_income_cents : parseFloat(day.total_income_cents) || 0), 0),
    total_expense_cents: dailySummaries.reduce((sum, day) => sum + (typeof day.total_expense_cents === 'number' ? day.total_expense_cents : parseFloat(day.total_expense_cents) || 0), 0),
    net_flow_cents: dailySummaries.reduce((sum, day) => sum + (typeof day.net_flow_cents === 'number' ? day.net_flow_cents : parseFloat(day.net_flow_cents) || 0), 0),
    starting_balance_cents: currentBalances.reduce((sum, acc) => sum + (typeof acc.current_balance_cents === 'number' ? acc.current_balance_cents : parseFloat(acc.current_balance_cents) || 0), 0),
      ending_balance_cents: dailySummaries[dailySummaries.length - 1]?.running_balance_cents || 0,
      currency: 'EUR' // Assumindo EUR como padrão
    };

    return {
      current_balances: currentBalances,
      period,
      filters,
      generated_at: new Date().toISOString()
    };
  }

  /**
   * Obtém saldos atuais das contas
   */
  private async getCurrentAccountBalances(
    filters: CashflowFilters,
    userId?: string,
    familyId?: string
  ): Promise<AccountBalance[]> {
    let query = supabase
      .from('accounts')
      .select('id, nome, tipo, saldo, family_id, user_id');

    // Aplicar filtros de escopo
    if (filters.scope === 'personal') {
      query = query.eq('user_id', userId).is('family_id', null);
    } else if (filters.scope === 'family') {
      query = query.eq('family_id', familyId);
    } else {
      // Ambos: pessoal + família
      query = query.or(`and(user_id.eq.${userId},family_id.is.null),family_id.eq.${familyId}`);
    }

    // Filtrar por contas específicas (array)
    if (filters.account_ids?.length) {
      query = query.in('id', filters.account_ids);
    }

    // Filtrar por conta específica (individual)
    if (filters.account_id) {
      query = query.eq('id', filters.account_id);
    }

    const { data: accounts, error } = await query;
    if (error) throw error;

    return (accounts || []).map(account => ({
      account_id: account.id,
      account_name: account.nome,
      account_type: account.tipo,
      current_balance_cents: Math.round((account.saldo || 0) * 100),
      currency: 'EUR',
      scope: account.family_id ? 'family' : 'personal'
    }));
  }

  /**
   * Gera todos os eventos de fluxo de caixa para o período
   */
  private async generateCashflowEvents(
    startDate: Date,
    endDate: Date,
    filters: CashflowFilters,
    userId?: string,
    familyId?: string
  ): Promise<CashflowEvent[]> {
    const events: CashflowEvent[] = [];

    // 1. Eventos de regras recorrentes
    const recurringEvents = await this.generateRecurringEvents(startDate, endDate, filters, userId, familyId);
    events.push(...recurringEvents);

    // 2. Eventos de funding de objetivos
    const goalFundingEvents = await this.generateGoalFundingEvents(startDate, endDate, filters, userId, familyId);
    events.push(...goalFundingEvents);

    // 3. Eventos de cartões de crédito (placeholder - implementar quando houver estrutura)
    // const creditCardEvents = await this.generateCreditCardEvents(startDate, endDate, filters, userId, familyId);
    // events.push(...creditCardEvents);

    // Ordenar por data
    events.sort((a, b) => a.date.localeCompare(b.date));

    return events;
  }

  /**
   * Gera eventos de regras recorrentes
   */
  private async generateRecurringEvents(
    startDate: Date,
    endDate: Date,
    filters: CashflowFilters,
    userId?: string,
    familyId?: string
  ): Promise<CashflowEvent[]> {
    let query = supabase
      .from('recurring_rules')
      .select('*')
      .eq('status', 'active')
      .lte('start_date', endDate.toISOString().split('T')[0]);

    // Aplicar filtros de escopo
    if (filters.scope === 'personal') {
      query = query.eq('scope', 'personal').eq('user_id', userId);
    } else if (filters.scope === 'family') {
      query = query.eq('scope', 'family').eq('family_id', familyId);
    } else {
      // Ambos
      query = query.or(`and(scope.eq.personal,user_id.eq.${userId}),and(scope.eq.family,family_id.eq.${familyId})`);
    }

    const { data: rules, error } = await query;
    if (error) throw error;

    const events: CashflowEvent[] = [];

    for (const rule of rules || []) {
      const ruleEvents = this.generateEventsForRecurringRule(rule, startDate, endDate);
      events.push(...ruleEvents);
    }

    return events;
  }

  /**
   * Gera eventos para uma regra recorrente específica
   */
  private generateEventsForRecurringRule(
    rule: any,
    startDate: Date,
    endDate: Date
  ): CashflowEvent[] {
    const events: CashflowEvent[] = [];
    let currentDate = new Date(Math.max(new Date(rule.next_run_date).getTime(), startDate.getTime()));

    while (currentDate <= endDate) {
      // Verificar se a regra ainda está ativa nesta data
      if (rule.end_date && currentDate > new Date(rule.end_date)) {
        break;
      }

      const eventType: CashflowEventType = rule.is_subscription ? 'subscription' : 
        (rule.amount_cents > 0 ? 'recurring_income' : 'recurring_expense');

      events.push({
        id: `${rule.id}_${currentDate.toISOString().split('T')[0]}`,
        type: eventType,
        scope: rule.scope,
        date: currentDate.toISOString().split('T')[0],
        amount_cents: Math.abs(rule.amount_cents),
        currency: rule.currency,
        description: rule.description || rule.payee || 'Transação recorrente',
        category_id: rule.category_id,
        source_id: rule.id,
        source_type: 'recurring_rule',
        is_income: rule.amount_cents > 0,
        metadata: {
          payee: rule.payee,
          vendor: rule.vendor,
          rule_description: rule.description,
          payment_method: rule.payment_method,
          is_subscription: rule.is_subscription
        }
      });

      // Calcular próxima data
      currentDate = this.getNextRecurrenceDate(currentDate, rule.interval_unit, rule.interval_count);
    }

    return events;
  }

  /**
   * Gera eventos de funding de objetivos
   */
  private async generateGoalFundingEvents(
    startDate: Date,
    endDate: Date,
    filters: CashflowFilters,
    userId?: string,
    familyId?: string
  ): Promise<CashflowEvent[]> {
    let query = supabase
      .from('goal_funding_rules')
      .select(`
        *,
        goals!inner(id, nome, family_id, user_id)
      `)
      .eq('enabled', true)
      .eq('type', 'fixed_monthly')
      .not('fixed_cents', 'is', null)
      .not('day_of_month', 'is', null);

    // Aplicar filtros de escopo através dos objetivos
    if (filters.scope === 'personal') {
      query = query.eq('goals.user_id', userId).is('goals.family_id', null);
    } else if (filters.scope === 'family') {
      query = query.eq('goals.family_id', familyId);
    } else {
      // Ambos
      query = query.or(`goals.user_id.eq.${userId},goals.family_id.eq.${familyId}`);
    }

    const { data: fundingRules, error } = await query;
    if (error) throw error;

    const events: CashflowEvent[] = [];

    for (const rule of fundingRules || []) {
      const ruleEvents = this.generateEventsForGoalFunding(rule, startDate, endDate);
      events.push(...ruleEvents);
    }

    return events;
  }

  /**
   * Gera eventos para uma regra de funding de objetivo
   */
  private generateEventsForGoalFunding(
    rule: any,
    startDate: Date,
    endDate: Date
  ): CashflowEvent[] {
    const events: CashflowEvent[] = [];
    const dayOfMonth = rule.day_of_month;
    
    // Gerar eventos mensais
    let currentDate = new Date(startDate);
    currentDate.setDate(1); // Começar no primeiro dia do mês
    
    while (currentDate <= endDate) {
      const eventDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), dayOfMonth);
      
      // Verificar se a data está no período desejado
      if (eventDate >= startDate && eventDate <= endDate) {
        events.push({
          id: `${rule.id}_${eventDate.toISOString().split('T')[0]}`,
          type: 'goal_funding',
          scope: rule.goals.family_id ? 'family' : 'personal',
          date: eventDate.toISOString().split('T')[0],
          amount_cents: rule.fixed_cents,
          currency: rule.currency,
          description: `Funding automático: ${rule.goals.nome}`,
          source_id: rule.id,
          source_type: 'goal_funding_rule',
          is_income: false, // Funding é sempre uma saída
          metadata: {
            goal_name: rule.goals.nome,
            goal_id: rule.goal_id,
            funding_type: 'fixed_monthly',
            day_of_month: dayOfMonth
          }
        });
      }
      
      // Próximo mês
      currentDate.setMonth(currentDate.getMonth() + 1);
    }

    return events;
  }

  /**
   * Cria resumos diários agregando eventos
   */
  private createDailySummaries(
    events: CashflowEvent[],
    currentBalances: AccountBalance[],
    startDate: Date,
    endDate: Date
  ): DailyCashflowSummary[] {
    const summaries: DailyCashflowSummary[] = [];
    const startingBalance = currentBalances.reduce((sum, acc) => sum + (typeof acc.current_balance_cents === 'number' ? acc.current_balance_cents : parseFloat(acc.current_balance_cents) || 0), 0);
    let runningBalance = startingBalance;

    // Agrupar eventos por data
    const eventsByDate = new Map<string, CashflowEvent[]>();
    events.forEach(event => {
      const date = event.date;
      if (!eventsByDate.has(date)) {
        eventsByDate.set(date, []);
      }
      eventsByDate.get(date)!.push(event);
    });

    // Criar resumo para cada dia
    const currentDate = new Date(startDate);
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const dayEvents = eventsByDate.get(dateStr) || [];
      
      const totalIncome = dayEvents
        .filter(e => e.is_income)
        .reduce((sum, e) => sum + (typeof e.amount_cents === 'number' ? e.amount_cents : parseFloat(e.amount_cents) || 0), 0);
      
      const totalExpense = dayEvents
        .filter(e => !e.is_income)
        .reduce((sum, e) => sum + (typeof e.amount_cents === 'number' ? e.amount_cents : parseFloat(e.amount_cents) || 0), 0);
      
      const netFlow = totalIncome - totalExpense;
      runningBalance += netFlow;

      summaries.push({
        date: dateStr,
        total_income_cents: totalIncome,
        total_expense_cents: totalExpense,
        net_flow_cents: netFlow,
        running_balance_cents: runningBalance,
        events: dayEvents,
        currency: 'EUR'
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return summaries;
  }

  /**
   * Método público para gerar projeção de fluxo de caixa
   * Usado pelo componente CashflowView
   */
  async generateProjection(filters: CashflowFilters & { days_ahead?: number }): Promise<{ daily_summaries: DailyCashflowSummary[] }> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Utilizador não autenticado');
    
    const userId = user.id;
    let familyId: string | undefined;
    
    // Se o escopo incluir família, obter o familyId
    if (filters.scope === 'family') {
      const familyData = await this.getUserFamilyData(userId);
      familyId = familyData?.family?.id;
      if (!familyId) {
        throw new Error('Utilizador não pertence a nenhuma família');
      }
    }
    
    const days = filters.days_ahead || 30;
    const projection = await this.generateCashflowProjection(days, filters, userId, familyId);
    return {
      daily_summaries: projection.period.daily_summaries
    };
  }

  /**
   * Método público para obter saldos das contas
   * Usado pelo componente CashflowView
   */
  async getAccountBalances(scope?: CashflowScope): Promise<AccountBalance[]> {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!user) throw new Error('Utilizador não autenticado');
    
    const userId = user.id;
    let familyId: string | undefined;
    
    // Se o escopo incluir família, obter o familyId
    if (scope === 'family') {
      const familyData = await this.getUserFamilyData(userId);
      familyId = familyData?.family?.id;
      if (!familyId) {
        throw new Error('Utilizador não pertence a nenhuma família');
      }
    }
    
    const filters: CashflowFilters = { scope };
    return await this.getCurrentAccountBalances(filters, userId, familyId);
  }

  /**
   * Método auxiliar para obter dados da família do utilizador
   */
  private async getUserFamilyData(userId: string) {
    try {
      // Tentar primeiro a função RPC
      const { data, error } = await supabase.rpc('get_user_family_data');
      if (error) throw error;
      return data;
    } catch (error) {
      // Fallback: buscar diretamente da tabela family_members
      const { data: memberData, error: memberError } = await supabase
        .from('family_members')
        .select(`
          *,
          families:family_id (
            id,
            nome,
            description,
            created_by,
            created_at,
            updated_at,
            settings
          )
        `)
        .eq('user_id', userId)
        .single();

      if (memberError) throw memberError;
      
      return memberData ? {
        family: memberData.families,
        user_role: memberData.role
      } : null;
    }
  }

  /**
   * Calcula a próxima data de recorrência
   */
  private getNextRecurrenceDate(
    currentDate: Date,
    intervalUnit: string,
    intervalCount: number
  ): Date {
    const nextDate = new Date(currentDate);
    
    switch (intervalUnit) {
      case 'day':
        nextDate.setDate(nextDate.getDate() + intervalCount);
        break;
      case 'week':
        nextDate.setDate(nextDate.getDate() + (intervalCount * 7));
        break;
      case 'month':
        nextDate.setMonth(nextDate.getMonth() + intervalCount);
        break;
      case 'year':
        nextDate.setFullYear(nextDate.getFullYear() + intervalCount);
        break;
    }
    
    return nextDate;
  }
}

// Instância singleton
export const cashflowService = CashflowService.getInstance();
export default CashflowService;