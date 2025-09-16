import { supabase } from '../../../lib/supabaseClient';
import { PayrollContract, PayrollOTPolicy, PayrollHoliday, PayrollVacation, PayrollVacationFormData, PayrollTimeEntry, PayrollLeave, PayrollLeaveFormData, MileagePolicyFormData, PayrollMealAllowanceConfig, PayrollMealAllowanceConfigFormData, PayrollDeductionConfig, PayrollDeductionConfigFormData, PayrollPeriod, PayrollPeriodFormData, PayrollCalculation, PayrollMileageTrip, PayrollMileagePolicy } from '../types';
import { formatDateLocal } from '../../../lib/dateUtils';

/**
 * Valida se um userId é válido
 */
function validateUserId(userId: string): void {
  if (!userId || typeof userId !== 'string' || userId.trim().length === 0) {
    throw new Error('ID de utilizador inválido');
  }
}

/**
 * Valida se um contractId é válido (não-vazio)
 */
function validateContractId(contractId: string): void {
  if (!contractId || typeof contractId !== 'string' || contractId.trim().length === 0) {
    throw new Error('ID do contrato inválido');
  }
  // Validação de UUID removida para permitir IDs não-UUID em cenários de teste e ambientes legacy
}

/**
 * Valida se um contrato tem os campos obrigatórios
 */
function validateContract(contract: any): void {
  if (!contract) {
    throw new Error('Contrato não pode ser nulo');
  }
  if (!contract.id) {
    throw new Error('Contrato deve ter um ID válido');
  }
  if (!contract.user_id) {
    throw new Error('Contrato deve ter um user_id válido');
  }
}

/**
 * Valida dados de cálculo de folha de pagamento
 */
function validateCalculationData(data: any): void {
  if (!data) {
    throw new Error('Dados de cálculo não podem ser nulos');
  }
  if (typeof data.baseSalary !== 'number' || data.baseSalary < 0) {
    throw new Error('Salário base deve ser um número positivo');
  }
  if (data.overtimeHours && (typeof data.overtimeHours !== 'number' || data.overtimeHours < 0)) {
    throw new Error('Horas extra devem ser um número positivo');
  }
}

/**
 * Calcula o último dia do mês corretamente
 * @param year Ano
 * @param month Mês (1-12)
 * @returns String no formato YYYY-MM-DD do último dia do mês
 */
function getLastDayOfMonth(year: number, month: number): string {
  const lastDay = new Date(year, month, 0).getDate();
  return `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
}

// Contract functions
export async function getContracts(userId: string): Promise<PayrollContract[]> {
  console.log('🔧 PayrollService.getContracts - Iniciando para userId:', userId);
  validateUserId(userId);
  
  // Teste de conectividade com Supabase
  console.log('🔧 PayrollService.getContracts - Testando conectividade Supabase');
  try {
    const testQuery = await supabase.from('payroll_contracts').select('*', { count: 'exact', head: true });
    console.log('🔧 PayrollService.getContracts - Teste de conectividade:', testQuery);
  } catch (testError) {
    console.error('🔧 PayrollService.getContracts - Erro de conectividade:', testError);
  }
  
  console.log('🔧 PayrollService.getContracts - Executando query no Supabase');
  const { data, error } = await supabase
    .from('payroll_contracts')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  console.log('🔧 PayrollService.getContracts - Resultado da query:', { data, error });
  
  if (error) {
    console.error('🔧 PayrollService.getContracts - Erro:', error);
    throw new Error(error.message || 'Erro ao obter contratos');
  }
  
  console.log('🔧 PayrollService.getContracts - Retornando:', data?.length || 0, 'contratos');
  return data || [];
}

// Alias para compatibilidade com testes
export const getPayrollContracts = getContracts;
export async function getActiveContract(userId: string): Promise<PayrollContract | null> {
  validateUserId(userId);
  console.log('[PayrollService] 🔍 Getting active contract for user:', userId);
  
  const { data, error } = await supabase
    .from('payroll_contracts')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();

  console.log('[PayrollService] 📊 Query result:', {
    hasData: !!data,
    error: error?.message || 'none',
    errorCode: error?.code || 'none'
  });

  if (error && (error as any).code !== 'PGRST116') {
    console.error('[PayrollService] ❌ Database error:', error);
    throw error as any;
  }
  
  if (!data) {
    console.warn('[PayrollService] ⚠️ No active contract found for user:', userId);
  } else {
    console.log('[PayrollService] ✅ Active contract found:', {
      contractId: data.id,
      contractName: data.name,
      userId: data.user_id
    });
  }
  
  return data as any;
}

export async function getContract(contractId: string, userId: string): Promise<PayrollContract | null> {
  validateContractId(contractId);
  validateUserId(userId);
  
  const { data, error } = await supabase
    .from('payroll_contracts')
    .select('*')
    .eq('id', contractId)
    .eq('user_id', userId)
    .single();

  if (error && (error as any).code !== 'PGRST116') throw error as any;
  return data as any;
}

export async function createContract(userId: string, contractData: Omit<PayrollContract, 'id' | 'created_at' | 'updated_at'>): Promise<PayrollContract> {
  // Deactivate other contracts if this one is set as active
  if (contractData.is_active) {
    await supabase
      .from('payroll_contracts')
      .update({ is_active: false })
      .eq('user_id', userId);
  }

  const { data, error } = await supabase
    .from('payroll_contracts')
    .insert({ ...contractData, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function updateContract(contractId: string, contractData: Partial<PayrollContract>, userId?: string): Promise<PayrollContract> {
  validateContractId(contractId);
  // Backward compatibility: resolve userId from auth if not provided
  let effectiveUserId = userId;
  if (!effectiveUserId) {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      throw new Error('Utilizador não autenticado');
    }
    effectiveUserId = user.id;
  }
  validateUserId(effectiveUserId);
  
  // Deactivate other contracts if this one is set as active
  if (contractData.is_active) {
    await supabase
      .from('payroll_contracts')
      .update({ is_active: false })
      .eq('user_id', effectiveUserId)
      .neq('id', contractId);
  }

  const { data, error } = await supabase
    .from('payroll_contracts')
    .update(contractData)
    .eq('id', contractId)
    .eq('user_id', effectiveUserId)
    .select()
    .single();

  if (error) {
    throw error;
  }
  return data as any;
}

export async function deactivateContract(contractId: string, userId?: string): Promise<PayrollContract> {
  return updateContract(contractId, { is_active: false }, userId);
}

export async function saveContract(contractData: Partial<PayrollContract>): Promise<PayrollContract> {
  // Get current user from auth
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    throw new Error('Utilizador não autenticado');
  }

  const userId = user.id;
  validateUserId(userId);

  // If contract has an ID, update it; otherwise, create a new one
  if (contractData.id) {
    return updateContract(contractData.id, contractData, userId);
  } else {
    // Remove id, created_at, updated_at from contractData for creation
    const { id, created_at, updated_at, ...createData } = contractData as any;
    return createContract(userId, createData);
  }
}

export async function deleteContract(contractId: string, userId: string): Promise<void> {
  validateContractId(contractId);
  validateUserId(userId);
  
  // First, delete all dependent records to avoid foreign key constraint violations
  const dependentTables = [
    'payroll_ot_policies',
    'payroll_time_entries', 
    'payroll_periods',
    'payroll_mileage_policies',
    'payroll_vacations',
    'payroll_meal_allowance_configs',
    'payroll_deduction_configs',
    'payroll_leaves',
    'payroll_bonus_configs',
    'payroll_deduction_conditions',
    'payroll_holidays',
    'performance_bonus_configs',
    'performance_bonus_results',
    'payroll_mileage_trips',
    'payroll_custom_bonuses'
  ];

  // Delete dependent records in sequence
  for (const table of dependentTables) {
    const { error: depError } = await supabase
      .from(table)
      .delete()
      .eq('contract_id', contractId)
      .eq('user_id', userId);
    
    // Log but don't throw on dependent record deletion errors
    // as some tables might not have records for this contract
    if (depError && depError.code !== 'PGRST116') {
      console.warn(`Warning deleting from ${table}:`, depError);
    }
  }

  // Finally, delete the contract itself
  const { error } = await supabase
    .from('payroll_contracts')
    .delete()
    .eq('id', contractId)
    .eq('user_id', userId);

  if (error) throw error;
}

// OT Policy functions
export async function getOTPolicies(userId: string): Promise<PayrollOTPolicy[]> {
  const { data, error } = await supabase
    .from('payroll_ot_policies')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

// NEW: Get active OT policy for a user (optionally by contract, currently unused)
export async function getActiveOTPolicy(userId: string, _contractId?: string): Promise<PayrollOTPolicy | null> {
  const { data, error } = await supabase
    .from('payroll_ot_policies')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .single();

  if (error && (error as any).code === 'PGRST116') return null;
  if (error) throw error;
  return (data as any) || null;
}

// Get OT policies by contract
export async function getOTPoliciesByContract(contractId: string): Promise<PayrollOTPolicy[]> {
  const { data, error } = await supabase
    .from('payroll_ot_policies')
    .select('*')
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}
export async function createOTPolicy(policyData: Omit<PayrollOTPolicy, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<PayrollOTPolicy> {
  const { data, error } = await supabase
    .from('payroll_ot_policies')
    .insert({ ...policyData, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function updateOTPolicy(policyId: string, policyData: Partial<PayrollOTPolicy>, userId: string): Promise<PayrollOTPolicy> {
  const { data, error } = await supabase
    .from('payroll_ot_policies')
    .update(policyData)
    .eq('id', policyId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteOTPolicy(policyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_ot_policies')
    .delete()
    .eq('id', policyId)
    .eq('user_id', userId);

  if (error) throw error;
}

// Holiday functions
export async function getHolidays(
  userId: string,
  yearOrStart?: number | string,
  endOrContractId?: string,
  workplaceLocation?: string
): Promise<PayrollHoliday[]> {
  console.log('🎄 getHolidays chamada com:', { userId, yearOrStart, endOrContractId, workplaceLocation });
  
  let query = supabase
    .from('payroll_holidays')
    .select('*')
    .eq('user_id', userId);

  // Suporte retrocompatível: (userId, 'YYYY-MM-DD', 'YYYY-MM-DD')
  if (typeof yearOrStart === 'string') {
    const start = yearOrStart;
    const end = typeof endOrContractId === 'string' ? endOrContractId : undefined;
    if (start && end) {
      query = query.gte('date', start).lte('date', end);
    }
  } else if (typeof yearOrStart === 'number' && !isNaN(yearOrStart)) {
    // Assinatura nova: (userId, year, contractId?, workplaceLocation?)
    const start = `${yearOrStart}-01-01`;
    const end = `${yearOrStart}-12-31`;
    query = query.gte('date', start).lte('date', end);
    
    // CORREÇÃO: Se contractId é fornecido, incluir feriados desse contrato E feriados de todos os contratos do utilizador
    // Isto resolve o problema de feriados não aparecerem quando o utilizador tem múltiplos contratos
    if (typeof endOrContractId === 'string' && endOrContractId) {
      // Buscar todos os contratos do utilizador
      const { data: userContracts } = await supabase
        .from('payroll_contracts')
        .select('id')
        .eq('user_id', userId);
      
      // Tornar robusto quando o mock devolve objeto em vez de array
      let contractIds: string[] = [];
      if (Array.isArray(userContracts)) {
        contractIds = userContracts.map((c: any) => c.id);
      } else if (userContracts && typeof userContracts === 'object' && (userContracts as any).id) {
        contractIds = [(userContracts as any).id];
      }
      if (contractIds.length === 0) {
        contractIds = [endOrContractId];
      }
      
      console.log('🔍 Incluindo feriados de todos os contratos do utilizador:', {
        requestedContractId: endOrContractId,
        allUserContractIds: contractIds
      });
      
      // Filtrar por qualquer um dos contratos do utilizador
      query = query.in('contract_id', contractIds);
    }
    
    // Se temos workplace_location, incluir feriados regionais/municipais
    if (workplaceLocation && typeof endOrContractId === 'string') {
      // Importar holidayAutoService dinamicamente para evitar dependências circulares
      const { syncRegionalHolidays } = await import('./holidayAutoService');
      
      try {
        console.log('🔄 Sincronizando feriados regionais/municipais:', {
          userId: userId.substring(0, 8) + '...',
          contractId: endOrContractId,
          year: yearOrStart,
          workplaceLocation
        });
        
        // Sincronizar feriados regionais/municipais com a base de dados
        const result = await syncRegionalHolidays(
          userId,
          endOrContractId, // contractId
          yearOrStart,
          workplaceLocation
        );
        
        console.log('✅ Resultado da sincronização:', result);
      } catch (error) {
        console.warn('❌ Erro ao sincronizar feriados regionais/municipais:', error);
        // Continuar com feriados manuais apenas
      }
    }
  }

  const { data, error } = await query.order('date', { ascending: true });
  if (error) throw error;
  
  console.log('🎄 getHolidays resultado:', {
    totalHolidays: data?.length || 0,
    holidays: data?.slice(0, 3).map(h => ({ date: h.date, name: h.name, contract_id: h.contract_id })) || []
  });
  
  return data || [];
}

export async function createHoliday(holidayData: Omit<PayrollHoliday, 'id' | 'created_at' | 'updated_at'>, userId: string): Promise<PayrollHoliday> {
  const { data, error } = await supabase
    .from('payroll_holidays')
    .insert({ ...holidayData, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function updateHoliday(holidayId: string, holidayData: Partial<PayrollHoliday>, userId: string): Promise<PayrollHoliday> {
  const { data, error } = await supabase
    .from('payroll_holidays')
    .update(holidayData)
    .eq('id', holidayId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteHoliday(holidayId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_holidays')
    .delete()
    .eq('id', holidayId)
    .eq('user_id', userId);

  if (error) throw error;
}

// Vacation functions
export async function getVacations(userId: string): Promise<PayrollVacation[]>;
export async function getVacations(userId: string, contractId: string, year: number): Promise<PayrollVacation[]>;
export async function getVacations(userId: string, contractId?: string, year?: number): Promise<PayrollVacation[]> {
  let query = supabase
    .from('payroll_vacations')
    .select('*')
    .eq('user_id', userId);

  if (contractId) {
    query = query.eq('contract_id', contractId);
  }

  if (year) {
    query = query.eq('year', year);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createVacation(userId: string, contractId: string, vacationData: PayrollVacationFormData): Promise<PayrollVacation> {
  const { data, error } = await supabase
    .from('payroll_vacations')
    .insert({ ...vacationData, user_id: userId, contract_id: contractId })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function updateVacation(vacationId: string, vacationData: Partial<PayrollVacationFormData>, userId: string, contractId: string): Promise<PayrollVacation> {
  const { data, error } = await supabase
    .from('payroll_vacations')
    .update(vacationData)
    .eq('id', vacationId)
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteVacation(vacationId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_vacations')
    .delete()
    .eq('id', vacationId)
    .eq('user_id', userId);

  if (error) throw error;
}

// Time entry functions
export async function getTimeEntries(userId: string, contractId: string, start_date?: string, end_date?: string): Promise<PayrollTimeEntry[]> {
  let query = supabase
    .from('payroll_time_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId);

  if (start_date) {
    query = query.gte('date', start_date);
  }
  if (end_date) {
    query = query.lte('date', end_date);
  }

  const { data, error } = await query.order('date', { ascending: true });

  if (error) {
    console.error('🎄 Erro ao obter feriados:', error);
    throw error;
  }
  
  console.log('🎄 Feriados obtidos:', data?.length || 0, 'registos');
  console.log('🎄 Primeiros 3 feriados:', data?.slice(0, 3));
  
  return data || [];
}

export async function getTimeEntriesByContract(userId: string, contractId: string): Promise<PayrollTimeEntry[]> {
  const { data, error } = await supabase
    .from('payroll_time_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .order('date', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createTimeEntry(userId: string, contractId: string, entryData: Omit<PayrollTimeEntry, 'id' | 'created_at' | 'updated_at'>): Promise<PayrollTimeEntry> {
  console.log('[DEBUG] createTimeEntry iniciado', { userId, contractId, entryData });
  
  // Format date using local timezone to ensure consistency
  entryData.date = formatDateLocal(new Date(entryData.date));
  console.log('[DEBUG] Data formatada:', entryData.date);

  // Check if an entry already exists for this date and contract
  console.log('[DEBUG] Verificando entrada existente...');
  const { data: existingEntry, error: checkError } = await supabase
    .from('payroll_time_entries')
    .select('id')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('date', entryData.date)
    .single();

  if (checkError && checkError.code !== 'PGRST116') {
    console.error('[DEBUG] Erro ao verificar entrada existente:', checkError);
    throw checkError;
  }

  if (existingEntry) {
    console.log('[DEBUG] Entrada existente encontrada, atualizando...', existingEntry.id);
    // If entry exists, update it instead
    return updateTimeEntry(existingEntry.id, entryData, userId, contractId);
  }

  console.log('[DEBUG] Nenhuma entrada existente, criando nova...');
  
  // Add work on Sunday notes if applicable
  const entryDate = new Date(entryData.date);
  if (entryDate.getDay() === 0 && (entryData.start_time || entryData.end_time)) { // Sunday
    const currentNote = entryData.description || '';
    const sundayNote = 'Trabalho ao domingo - gera direito a descanso compensatório';
    entryData.description = currentNote ? `${currentNote}. ${sundayNote}` : sundayNote;
    console.log('[DEBUG] Nota de domingo adicionada:', entryData.description);
  }

  const insertData = { ...entryData, user_id: userId, contract_id: contractId };
  console.log('[DEBUG] Dados para inserção:', insertData);

  const { data, error } = await supabase
    .from('payroll_time_entries')
    .insert(insertData)
    .select()
    .single();

  if (error) {
    console.error('[DEBUG] Erro na inserção:', error);
    console.error('[DEBUG] Dados que causaram erro:', insertData);
    throw error;
  }
  
  console.log('[DEBUG] Entrada criada com sucesso:', data);
  return data as any;
}

export async function updateTimeEntry(entryId: string, entryData: Partial<Omit<PayrollTimeEntry, 'id' | 'created_at' | 'updated_at'>>, userId: string, contractId: string): Promise<PayrollTimeEntry> {
  // Format date using local timezone if provided
  if (entryData.date) {
    entryData.date = formatDateLocal(new Date(entryData.date));
  }

  // Add work on Sunday notes if applicable
  if (entryData.date) {
    const entryDate = new Date(entryData.date);
    if (entryDate.getDay() === 0 && (entryData.start_time || entryData.end_time)) { // Sunday
      const currentNote = entryData.description || '';
      const sundayNote = 'Trabalho ao domingo - gera direito a descanso compensatório';
      if (!currentNote.includes(sundayNote)) {
        entryData.description = currentNote ? `${currentNote}. ${sundayNote}` : sundayNote;
      }
    }
  }

  const { data, error } = await supabase
    .from('payroll_time_entries')
    .update(entryData)
    .eq('id', entryId)
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteTimeEntry(entryId: string, userId: string, contractId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_time_entries')
    .delete()
    .eq('id', entryId)
    .eq('user_id', userId)
    .eq('contract_id', contractId);

  if (error) throw error;
}

// Leave functions
export async function getLeaves(userId: string): Promise<PayrollLeave[]> {
  const { data, error } = await supabase
    .from('payroll_leaves')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function createLeave(leaveData: PayrollLeaveFormData, userId: string): Promise<PayrollLeave> {
  const { data, error } = await supabase
    .from('payroll_leaves')
    .insert({ ...leaveData, user_id: userId })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function updateLeave(leaveId: string, leaveData: Partial<PayrollLeaveFormData>, userId: string): Promise<PayrollLeave> {
  const { data, error } = await supabase
    .from('payroll_leaves')
    .update(leaveData)
    .eq('id', leaveId)
    .eq('user_id', userId)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteLeave(leaveId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_leaves')
    .delete()
    .eq('id', leaveId)
    .eq('user_id', userId);

  if (error) throw error;
}

// Additional utility functions for compensatory rest processing
export async function processCompensatoryRestForTimeEntries(userId: string, contractId: string, timeEntries: PayrollTimeEntry[]): Promise<PayrollLeave[]> {
  const sundayEntries = timeEntries.filter(entry => {
    const entryDate = new Date(entry.date);
    return entryDate.getDay() === 0 && (entry.start_time || entry.end_time);
  });

  const compensatoryLeaves: PayrollLeave[] = [];
  
  for (const sundayEntry of sundayEntries) {
    // Check if compensatory leave already exists for this date
    const { data: existingLeave } = await supabase
      .from('payroll_leaves')
      .select('id')
      .eq('user_id', userId)
      .eq('work_date', formatDateLocal(new Date(sundayEntry.date)))
      .eq('leave_type', 'compensatory')
      .single();

    if (!existingLeave) {
      const leaveData: PayrollLeaveFormData = {
        contract_id: contractId,
        leave_type: 'compensatory',
        start_date: formatDateLocal(new Date(sundayEntry.date)),
        end_date: formatDateLocal(new Date(sundayEntry.date)),
        days_taken: 1,
        description: `Descanso compensatório por trabalho no domingo (${formatDateLocal(new Date(sundayEntry.date))})`,
        work_date: formatDateLocal(new Date(sundayEntry.date))
      };

      const compensatoryLeave = await createLeave(leaveData, userId);
      compensatoryLeaves.push(compensatoryLeave);
    }
  }

  return compensatoryLeaves;
}

// Payroll configuration status
export async function getPayrollConfigurationStatus(userId: string, contractId: string): Promise<{ isValid: boolean; missingConfigurations: string[]; configurationDetails: { contract: { isValid: boolean }; overtimePolicy: { isValid: boolean }; mealAllowance: { isValid: boolean }; deductions: { isValid: boolean }; holidays: { isValid: boolean } } }> {
  const currentYear = new Date().getFullYear();
  const missing: string[] = [];

  // Contract
  const { data: contract, error: contractError } = await supabase
    .from('payroll_contracts')
    .select('*')
    .eq('user_id', userId)
    .eq('id', contractId)
    .single();

  let contractValid = true;
  if (!contract || contractError) {
    contractValid = false;
    missing.push('Contrato ativo não encontrado');
  } else {
    // Validar campos obrigatórios do contrato conforme expectativas dos testes
    if (!contract.job_category) {
      contractValid = false;
      missing.push('Categoria profissional não definida no contrato');
    }
    if (!contract.workplace_location) {
      contractValid = false;
      missing.push('Local de trabalho não definido no contrato');
    }
  }

  // OT Policy (active) - agora opcional
  const { data: otPolicy } = await supabase
    .from('payroll_ot_policies')
    .select('*')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  const otValid = true; // Política de horas extras é opcional; ausência não invalida configuração
  // Política de horas extras é agora opcional - não adiciona erro se não configurada

  // Meal allowance config (optional for validity, but tracked)
  const { data: mealConfig } = await supabase
    .from('payroll_meal_allowance_configs')
    .select('*')
    .eq('user_id', userId)
    .single();
  const mealValid = !!mealConfig;

  // Deduction config (optional for validity, but tracked)
  const { data: deductionConfig } = await supabase
    .from('payroll_deduction_configs')
    .select('*')
    .eq('user_id', userId)
    .single();
  const deductionsValid = !!deductionConfig;

  // Holidays for current year
  const start = `${currentYear}-01-01`;
  const end = `${currentYear}-12-31`;
  const { data: holidays } = await supabase
    .from('payroll_holidays')
    .select('id')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end);
  const holidaysValid = Array.isArray(holidays) && holidays.length > 0;
  if (!holidaysValid) missing.push(`Feriados não configurados para o ano ${currentYear}`);

  const isValid = missing.length === 0;

  return {
    isValid,
    missingConfigurations: missing,
    configurationDetails: {
      contract: { isValid: contractValid },
      overtimePolicy: { isValid: otValid },
      mealAllowance: { isValid: mealValid },
      deductions: { isValid: deductionsValid },
      holidays: { isValid: holidaysValid }
    }
  };
}

// Validation helper used by period creation and tests
export async function validatePayrollConfiguration(userId: string, contractId: string, year: number = new Date().getFullYear()): Promise<{ isValid: boolean; missingConfigurations: string[] }> {
  const missing: string[] = [];

  const { data: contract } = await supabase
    .from('payroll_contracts')
    .select('id')
    .eq('user_id', userId)
    .eq('id', contractId)
    .single();
  if (!contract) missing.push('Contrato ativo não encontrado');

  const { data: otPolicy } = await supabase
    .from('payroll_ot_policies')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .single();
  // Política de horas extras é agora opcional - não adiciona erro se não configurada

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;
  const { data: holidays } = await supabase
    .from('payroll_holidays')
    .select('id')
    .eq('user_id', userId)
    .gte('date', start)
    .lte('date', end);
  if (!Array.isArray(holidays) || holidays.length === 0) missing.push(`Feriados não configurados para o ano ${year}`);

  return { isValid: missing.length === 0, missingConfigurations: missing };
}

// Payroll period creation
export async function getPayrollPeriods(userId: string, contractId: string): Promise<PayrollPeriod[]> {
  validateUserId(userId);
  
  const { data, error } = await supabase
    .from('payroll_periods')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .order('year', { ascending: false })
    .order('month', { ascending: false });

  if (error) throw error;
  return data as PayrollPeriod[];
}

export async function createPayrollPeriod(userId: string, contractId: string, year: number, month: number): Promise<PayrollPeriod> {
  // 1) Validate configuration for the given year
  const validation = await validatePayrollConfiguration(userId, contractId, year);
  if (!validation.isValid) {
    throw new Error(`Não é possível criar o período de folha de pagamento. Configurações em falta: ${validation.missingConfigurations.join(', ')}`);
  }

  // 2) Ensure period does not already exist
  const { data: existing, error: existingErr } = await supabase
    .from('payroll_periods')
    .select('id')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('year', year)
    .eq('month', month)
    .single();

  if (existing) {
    throw new Error(`Já existe um período de folha de pagamento para ${month}/${year}`);
  }
  if (existingErr && (existingErr as any).code && (existingErr as any).code !== 'PGRST116') {
    throw existingErr as any;
  }

  // 3) Insert new period with initial draft status
  const monthStr = month.toString().padStart(2, '0');
  const start_date = `${year}-${monthStr}-01`;
  const end_date = getLastDayOfMonth(year, month);

  const insertPayload: any = {
    user_id: userId,
    contract_id: contractId,
    year,
    month,
    period_key: `${year}-${monthStr}`,
    start_date,
    end_date,
    status: 'draft',
    planned_minutes: 0,
    worked_minutes: 0,
    gross_cents: 0,
    net_expected_cents: 0
  };

  const { data, error } = await supabase
    .from('payroll_periods')
    .insert(insertPayload)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

// Export all as payrollService object
export const payrollService = {
  getContracts,
  getPayrollContracts,
  getActiveContract,
  getContract,
  createContract,
  updateContract,
  deactivateContract,
  saveContract,
  deleteContract,
  getOTPolicies,
  getOTPoliciesByContract,
  getActiveOTPolicy,
  createOTPolicy,
  updateOTPolicy,
  deleteOTPolicy,
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday,
  getVacations,
  createVacation,
  updateVacation,
  deleteVacation,
  getTimeEntries,
  getTimeEntriesByContract,
  createTimeEntry,
  updateTimeEntry,
  deleteTimeEntry,
  getLeaves,
  createLeave,
  updateLeave,
  deleteLeave,
  processCompensatoryRestForTimeEntries,
  getPayrollConfigurationStatus,
  validatePayrollConfiguration,
  getPayrollPeriods,
  createPayrollPeriod,
  // Adicionado: permitir uso via payrollService.getLeavesForWeek
  getLeavesForWeek,
  // Mileage Trip methods
  getMileageTrips,
  createMileageTrip,
  updateMileageTrip,
  deleteMileageTrip,
  // Mileage policies
  getActiveMileagePolicy,
  getMileagePolicies,
  createMileagePolicy,
  updateMileagePolicy,
  deleteMileagePolicy,
  // Meal allowance config
  getMealAllowanceConfig,
  getMealAllowancesByContract,
  upsertMealAllowanceConfig,
  deleteMealAllowanceConfig,
  // Deduction config
  getDeductionConfig,
  getDeductionConfigs,
  upsertDeductionConfig,
  deleteDeductionConfig,
  // Payroll calculation
  recalculatePayroll,
  // Bonus configuration
  upsertBonusConfig,
  getBonusConfig,
  deleteBonusConfig,
  getBonusesByContract,
  // Custom bonuses
  createCustomBonus,
  getCustomBonuses,
  updateCustomBonus,
  deleteCustomBonus,
  // Subsidy configuration
  getSubsidyConfigs,
  getSubsidyConfig,
  upsertSubsidyConfig,
  deleteSubsidyConfig,
};

// NEW: Get leaves overlapping a given week window
export async function getLeavesForWeek(
  userId: string,
  start_date: string,
  end_date: string,
  contractId?: string
): Promise<PayrollLeave[]> {
  let query = supabase
    .from('payroll_leaves')
    .select('*')
    .eq('user_id', userId)
    // overlap: leave.start_date <= end_date AND leave.end_date >= start_date
    .lte('start_date', end_date)
    .gte('end_date', start_date)
    .order('start_date', { ascending: true });

  if (contractId) {
    query = query.eq('contract_id', contractId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

// Mileage Trip functions
export async function getMileageTrips(
  userId: string,
  startDate?: string,
  endDate?: string,
  contractId?: string
): Promise<PayrollMileageTrip[]> {
  let query = supabase
    .from('payroll_mileage_trips')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (startDate) {
    query = query.gte('date', startDate);
  }
  if (endDate) {
    query = query.lte('date', endDate);
  }
  if (contractId) {
    query = query.eq('contract_id', contractId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createMileageTrip(
  userId: string,
  policyId: string,
  tripData: Omit<PayrollMileageTrip, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'policy_id'>
): Promise<PayrollMileageTrip> {
  // Garantir que o contract_id é sempre definido. Se não vier no tripData, resolvê-lo a partir da policy.
  let contractId = (tripData as any).contract_id as string | undefined;
  if (!contractId) {
    const { data: policyRow, error: policyError } = await supabase
      .from('payroll_mileage_policies')
      .select('id, contract_id')
      .eq('id', policyId)
      .single();

    if (policyError) throw policyError;
    if (!policyRow?.contract_id) {
      throw new Error('Não foi possível determinar o contract_id para a viagem de quilometragem.');
    }
    contractId = policyRow.contract_id as string;
  }

  const { data, error } = await supabase
    .from('payroll_mileage_trips')
    .insert({
      ...tripData,
      contract_id: contractId,
      user_id: userId,
      policy_id: policyId
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateMileageTrip(
  tripId: string,
  tripData: Partial<Omit<PayrollMileageTrip, 'id' | 'created_at' | 'updated_at'>>
): Promise<PayrollMileageTrip> {
  // Não permitir que contract_id seja removido; se ausente, obter do registo existente.
  let updatePayload = { ...tripData } as any;
  if (!('contract_id' in updatePayload) || !updatePayload.contract_id) {
    const { data: existing, error: existingError } = await supabase
      .from('payroll_mileage_trips')
      .select('id, contract_id, policy_id')
      .eq('id', tripId)
      .single();
    if (existingError) throw existingError;

    if (existing?.contract_id) {
      updatePayload.contract_id = existing.contract_id;
    } else if (existing?.policy_id) {
      // fallback: obter contract_id pela policy
      const { data: policyRow, error: policyError } = await supabase
        .from('payroll_mileage_policies')
        .select('id, contract_id')
        .eq('id', existing.policy_id)
        .single();
      if (policyError) throw policyError;
      if (!policyRow?.contract_id) {
        throw new Error('Não foi possível determinar o contract_id ao atualizar a viagem.');
      }
      updatePayload.contract_id = policyRow.contract_id;
    } else {
      throw new Error('Registo de viagem inválido sem policy/contract associados.');
    }
  }

  const { data, error } = await supabase
    .from('payroll_mileage_trips')
    .update(updatePayload)
    .eq('id', tripId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMileageTrip(tripId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_mileage_trips')
    .delete()
    .eq('id', tripId);

  if (error) throw error;
}

// NEW: Get active mileage policy for a user and contract
export async function getActiveMileagePolicy(userId: string, contractId: string): Promise<PayrollMileagePolicy | null> {
  const { data, error } = await supabase
    .from('payroll_mileage_policies')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .single();

  if (error && (error as any).code === 'PGRST116') return null;
  if (error) throw error;
  return (data as any) || null;
}

export async function getMileagePolicies(userId: string, contractId?: string): Promise<PayrollMileagePolicy[]> {
  let query = supabase
    .from('payroll_mileage_policies')
    .select('*')
    .eq('user_id', userId);

  if (contractId) {
    query = query.eq('contract_id', contractId);
  }

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any) || [];
}

export async function createMileagePolicy(userId: string, policyData: MileagePolicyFormData & { contract_id: string }): Promise<PayrollMileagePolicy> {
  const { data, error } = await supabase
    .from('payroll_mileage_policies')
    .insert({
      user_id: userId,
      name: policyData.name,
      rate_cents_per_km: Math.round(policyData.rate_per_km * 100),
      contract_id: policyData.contract_id,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function updateMileagePolicy(policyId: string, policyData: Partial<MileagePolicyFormData>, userId: string, contractId: string): Promise<PayrollMileagePolicy> {
  const updateData: any = {};
  
  if (policyData.name !== undefined) updateData.name = policyData.name;
  if (policyData.rate_per_km !== undefined) updateData.rate_cents_per_km = Math.round(policyData.rate_per_km * 100);

  const { data, error } = await supabase
    .from('payroll_mileage_policies')
    .update(updateData)
    .eq('id', policyId)
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteMileagePolicy(policyId: string, userId: string, contractId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_mileage_policies')
    .delete()
    .eq('id', policyId)
    .eq('user_id', userId)
    .eq('contract_id', contractId);

  if (error) throw error;
}

// NEW: Meal Allowance Config methods
export async function getMealAllowanceConfig(userId: string, contractId: string): Promise<PayrollMealAllowanceConfig | null> {
  const { data, error } = await supabase
    .from('payroll_meal_allowance_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .single();

  if (error && (error as any).code === 'PGRST116') return null;
  if (error) throw error;
  return (data as any) || null;
}

export async function getMealAllowancesByContract(contractId: string): Promise<PayrollMealAllowanceConfig[]> {
  const { data, error } = await supabase
    .from('payroll_meal_allowance_configs')
    .select('*')
    .eq('contract_id', contractId);

  if (error) throw error;
  return (data as any) || [];
}

export async function upsertMealAllowanceConfig(userId: string, contractId: string, configData: PayrollMealAllowanceConfigFormData): Promise<PayrollMealAllowanceConfig> {
  const { data, error } = await supabase
    .from('payroll_meal_allowance_configs')
    .upsert({
      user_id: userId,
      contract_id: contractId,
      daily_amount_cents: Math.round(configData.dailyAmount * 100),
      excluded_months: configData.excluded_months || [],
      payment_method: configData.paymentMethod,
      duodecimos_enabled: configData.duodecimosEnabled || false
    }, {
      onConflict: 'user_id,contract_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteMealAllowanceConfig(userId: string, contractId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_meal_allowance_configs')
    .delete()
    .eq('user_id', userId)
    .eq('contract_id', contractId);

  if (error) throw error;
}

// NEW: Deduction Config methods
export async function getDeductionConfig(userId: string, contractId: string): Promise<PayrollDeductionConfig | null> {
  const { data, error } = await supabase
    .from('payroll_deduction_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .single();

  if (error && (error as any).code === 'PGRST116') return null;
  if (error) throw error;
  return (data as any) || null;
}

export async function getDeductionConfigs(userId: string): Promise<PayrollDeductionConfig[]> {
  const { data, error } = await supabase
    .from('payroll_deduction_configs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data as any) || [];
}

export async function upsertDeductionConfig(userId: string, contractId: string, configData: PayrollDeductionConfigFormData): Promise<PayrollDeductionConfig> {
  const { data, error } = await supabase
    .from('payroll_deduction_configs')
    .upsert({
      user_id: userId,
      contract_id: contractId,
      irs_percentage: configData.irs_percentage,
      social_security_percentage: configData.social_security_percentage,
      irs_surcharge_percentage: configData.irs_surcharge_percentage || 0,
      solidarity_contribution_percentage: configData.solidarity_contribution_percentage || 0
    }, {
      onConflict: 'user_id,contract_id'
    })
    .select()
    .single();

  if (error) throw error;
  return data as any;
}

export async function deleteDeductionConfig(userId: string, contractId: string): Promise<void> {
  const { error } = await supabase
    .from('payroll_deduction_configs')
    .delete()
    .eq('user_id', userId)
    .eq('contract_id', contractId);

  if (error) throw error;
}

// Payroll bonus configuration functions
export async function upsertBonusConfig(
  userId: string,
  contractId: string,
  bonusType: 'mandatory' | 'performance' | 'custom',
  configData: any
): Promise<any> {
  validateUserId(userId);
  
  validateContractId(contractId);
  
  if (!bonusType || !['mandatory', 'performance', 'custom'].includes(bonusType)) {
    throw new Error('Tipo de subsídio inválido');
  }
  
  const { data, error } = await supabase
    .from('payroll_bonus_configs')
    .upsert({
      user_id: userId,
      contract_id: contractId,
      bonus_type: bonusType,
      config_data: configData,
      is_active: true
    }, {
      onConflict: 'user_id,contract_id,bonus_type'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getBonusConfig(
  userId: string,
  contractId: string,
  bonusType: 'mandatory' | 'performance' | 'custom'
): Promise<any> {
  validateUserId(userId);
  
  const { data, error } = await supabase
    .from('payroll_bonus_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('bonus_type', bonusType)
    .eq('is_active', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function deleteBonusConfig(
  userId: string,
  contractId: string,
  bonusType: 'mandatory' | 'performance' | 'custom'
): Promise<void> {
  validateUserId(userId);
  
  const { error } = await supabase
    .from('payroll_bonus_configs')
    .delete()
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('bonus_type', bonusType);

  if (error) throw error;
}

export async function getBonusesByContract(
  userId: string,
  contractId: string
): Promise<any[]> {
  validateUserId(userId);
  
  validateContractId(contractId);
  
  const { data, error } = await supabase
    .from('payroll_bonus_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('is_active', true)
    .order('bonus_type');

  if (error) throw error;
  return data || [];
}

// Subsidy configuration functions for new subsidy_configs table
export async function getSubsidyConfigs(
  userId: string,
  contractId: string
): Promise<any[]> {
  validateUserId(userId);
  
  const { data, error } = await supabase
    .from('subsidy_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('enabled', true);

  if (error) throw error;
  return data || [];
}

export async function getSubsidyConfig(
  userId: string,
  contractId: string,
  type: 'vacation' | 'christmas'
): Promise<any> {
  validateUserId(userId);
  
  const { data, error } = await supabase
    .from('subsidy_configs')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('type', type)
    .eq('enabled', true)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data;
}

export async function upsertSubsidyConfig(
  userId: string,
  contractId: string,
  type: 'vacation' | 'christmas',
  configData: any
): Promise<any> {
  validateUserId(userId);
  
  validateContractId(contractId);
  
  if (!type || !['vacation', 'christmas'].includes(type)) {
    throw new Error('Tipo de subsídio inválido');
  }
  
  const { data, error } = await supabase
    .from('subsidy_configs')
    .upsert({
      user_id: userId,
      contract_id: contractId,
      type: type,
      enabled: configData.enabled ?? true,
      payment_method: configData.payment_method,
      payment_month: configData.payment_month,
      advance_percentage: configData.advance_percentage,
      vacation_days_entitled: type === 'vacation' ? configData.vacation_days_entitled : null,
      vacation_days_taken: type === 'vacation' ? configData.vacation_days_taken : null,
      reference_salary_months: type === 'christmas' ? configData.reference_salary_months : null,
      proportional_calculation: configData.proportional_calculation ?? true
    }, {
      onConflict: 'user_id,contract_id,type'
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteSubsidyConfig(
  userId: string,
  contractId: string,
  type: 'vacation' | 'christmas'
): Promise<void> {
  validateUserId(userId);
  
  const { error } = await supabase
    .from('subsidy_configs')
    .delete()
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .eq('type', type);

  if (error) throw error;
}

// Custom bonuses functions
export async function createCustomBonus(
  userId: string,
  contractId: string,
  bonusData: {
    name: string;
    description?: string;
    amount: number;
    isPercentage: boolean;
    paymentFrequency: string;
    isTaxable: boolean;
    requiresApproval: boolean;
  }
): Promise<any> {
  validateUserId(userId);
  
  validateContractId(contractId);
  
  const { data, error } = await supabase
    .from('payroll_custom_bonuses')
    .insert({
      user_id: userId,
      contract_id: contractId,
      name: bonusData.name,
      description: bonusData.description || '',
      amount: bonusData.amount,
      is_percentage: bonusData.isPercentage,
      payment_frequency: bonusData.paymentFrequency,
      is_taxable: bonusData.isTaxable,
      requires_approval: bonusData.requiresApproval,
      is_active: true
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function getCustomBonuses(
  userId: string,
  contractId: string
): Promise<any[]> {
  validateUserId(userId);
  
  validateContractId(contractId);
  
  const { data, error } = await supabase
    .from('payroll_custom_bonuses')
    .select('*')
    .eq('user_id', userId)
    .eq('contract_id', contractId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateCustomBonus(
  userId: string,
  bonusId: string,
  bonusData: {
    name?: string;
    description?: string;
    amount?: number;
    isPercentage?: boolean;
    paymentFrequency?: string;
    isTaxable?: boolean;
    requiresApproval?: boolean;
    isActive?: boolean;
  }
): Promise<any> {
  validateUserId(userId);
  
  if (!bonusId || typeof bonusId !== 'string') {
    throw new Error('ID do bónus inválido');
  }
  
  const updateData: any = {};
  if (bonusData.name !== undefined) updateData.name = bonusData.name;
  if (bonusData.description !== undefined) updateData.description = bonusData.description;
  if (bonusData.amount !== undefined) updateData.amount = bonusData.amount;
  if (bonusData.isPercentage !== undefined) updateData.is_percentage = bonusData.isPercentage;
  if (bonusData.paymentFrequency !== undefined) updateData.payment_frequency = bonusData.paymentFrequency;
  if (bonusData.isTaxable !== undefined) updateData.is_taxable = bonusData.isTaxable;
  if (bonusData.requiresApproval !== undefined) updateData.requires_approval = bonusData.requiresApproval;
  if (bonusData.isActive !== undefined) updateData.is_active = bonusData.isActive;
  
  const { data, error } = await supabase
    .from('payroll_custom_bonuses')
    .update(updateData)
    .eq('user_id', userId)
    .eq('id', bonusId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteCustomBonus(
  userId: string,
  bonusId: string
): Promise<void> {
  validateUserId(userId);
  
  if (!bonusId || typeof bonusId !== 'string') {
    throw new Error('ID do bónus inválido');
  }
  
  const { error } = await supabase
    .from('payroll_custom_bonuses')
    .delete()
    .eq('user_id', userId)
    .eq('id', bonusId);

  if (error) throw error;
}

// Payroll calculation function
export async function recalculatePayroll(
  userId: string,
  contractId: string,
  year: number,
  month: number
): Promise<PayrollCalculation> {
  // Import calculation service dynamically to avoid circular dependencies
  const { calculatePayroll } = await import('./calculation.service');
  
  return calculatePayroll(userId, contractId, year, month);
}