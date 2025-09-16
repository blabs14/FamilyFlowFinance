import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Clock, Save, Upload, Download, Calendar, Trash2, AlertTriangle, CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { PayrollTimeEntry, PayrollContract, TimesheetEntry, WeeklyTimesheet, PayrollOTPolicy } from '../types';
import { payrollService } from '../services/payrollService';
import { performanceBonusService } from '../services/performanceBonusService';
import { holidayAutoService } from '../services/holidayAutoService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useActiveContract } from '../hooks/useActiveContract';
import { formatCurrency } from '@/lib/utils';
import { calculateHours, segmentEntry, calcHourly } from '../lib/calc';
import { formatDateLocal } from '@/lib/dateUtils';
import { withContext, maskId } from '@/shared/lib/logger';
import { TimesheetHeader } from './timesheet/TimesheetHeader';
import { useTimesheetWeekSchedule } from '../hooks/useTimesheetWeekSchedule';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLocale } from '@/contexts/LocaleProvider';
import { useTranslation } from 'react-i18next';


interface WeeklyTimesheetFormProps {
  initialWeekStart?: Date;
  contractId?: string;
  onSave?: (entries: PayrollTimeEntry[]) => void;
}

export function WeeklyTimesheetForm({ initialWeekStart, contractId, onSave }: WeeklyTimesheetFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const { activeContract, contracts, setActiveContract } = useActiveContract();
  const [loading, setLoading] = useState(false);
  const [weekNavigationLoading, setWeekNavigationLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const selectedContractId = contractId || activeContract?.id || '';
  // Definir contrato selecionado (corrige ReferenceError em JSX quando usado no disabled)
  const selectedContract = contracts.find(c => c.id === selectedContractId) || activeContract || null;
  

  
  // CorrelationId e logger com contexto
  const correlationIdRef = useRef<string>('');
  if (!correlationIdRef.current) {
    correlationIdRef.current = (globalThis as any)?.crypto?.randomUUID?.() ?? `timesheet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }
  const log = withContext({ feature: 'payroll', component: 'WeeklyTimesheetForm', correlationId: correlationIdRef.current });
  
  const { language } = useLocale();
  const { t } = useTranslation();
  
  // Hook unificado de semana
  const {
    selectedWeek,
    setSelectedWeek,
    weekDays,
    weekStartDate,
    weekEndDate,
    getWeekStart,
    getWeekNumber,
  } = useTimesheetWeekSchedule(initialWeekStart);

  const goToPrevWeek = React.useCallback(() => {
    const currentDate = new Date(selectedWeek);
    currentDate.setDate(currentDate.getDate() - 7);
    setSelectedWeek(formatDateLocal(getWeekStart(currentDate)));
  }, [selectedWeek, setSelectedWeek, getWeekStart]);

  const goToNextWeek = React.useCallback(() => {
    const currentDate = new Date(selectedWeek);
    currentDate.setDate(currentDate.getDate() + 7);
    setSelectedWeek(formatDateLocal(getWeekStart(currentDate)));
  }, [selectedWeek, setSelectedWeek, getWeekStart]);

  const formattedWeekRange = useMemo(() => {
    if (!weekDays || weekDays.length < 7) return '';
    const locale = language || (typeof navigator !== 'undefined' ? navigator.language : 'pt-PT');
    const opts: Intl.DateTimeFormatOptions = { day: '2-digit', month: 'short', year: 'numeric' };
    const start = new Intl.DateTimeFormat(locale, opts).format(weekDays[0]);
    const end = new Intl.DateTimeFormat(locale, opts).format(weekDays[6]);
    return `${start} – ${end}`;
  }, [weekDays, language]);

  // Atalhos de teclado Alt+← / Alt+→ sem interferir com inputs focados
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!e.altKey) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable = (target as HTMLElement).isContentEditable;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || isEditable) return;
        const role = target.getAttribute('role');
        if (role === 'combobox') return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goToPrevWeek();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goToNextWeek();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [goToPrevWeek, goToNextWeek]);

  const [timesheet, setTimesheet] = useState<WeeklyTimesheet>({ entries: [] });
  const [existingEntries, setExistingEntries] = useState<PayrollTimeEntry[]>([]);
  const [otPolicy, setOtPolicy] = useState<PayrollOTPolicy | null>(null);

  // Região aria-live e aviso inline de dias bloqueados
  const [ariaLiveMsg, setAriaLiveMsg] = useState('');
  const blockedDaysCount = useMemo(() => {
    return (timesheet.entries || []).filter(e => (e.isHoliday || e.isSick || e.isVacation) && !e.isException).length;
  }, [timesheet.entries]);
  const blockedNotice = useMemo(() => {
    if (blockedDaysCount > 0) {
      return blockedDaysCount === 1
        ? '1 dia está bloqueado para edição por feriado/férias/doença. Marque "Exceção" para editar.'
        : `${blockedDaysCount} dias estão bloqueados para edição por feriado/férias/doença. Marque "Exceção" para editar.`;
    }
    return '';
  }, [blockedDaysCount]);
  const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

  // Listener para sincronização de feriados: recarrega a semana e anuncia via aria-live
  useEffect(() => {
    const handler = (ev: Event) => {
      const detail = (ev as CustomEvent)?.detail as { contractId?: string; year?: number } | undefined;
      if (!detail) return;
      const currentYear = new Date(selectedWeek).getFullYear();
      if (detail.contractId === selectedContractId && detail.year === currentYear) {
        loadExistingEntries();
        setAriaLiveMsg('Feriados sincronizados — semana atualizada.');
      }
    };
    window.addEventListener('holiday-sync:completed', handler as EventListener);
    return () => window.removeEventListener('holiday-sync:completed', handler as EventListener);
  }, [selectedContractId, selectedWeek]);

  // Função para criar entradas vazias para a semana
  const createEmptyWeekEntries = async (): Promise<TimesheetEntry[]> => {
    if (!selectedContractId || !user?.id) {
      return weekDays.map(day => {
        const dateStr = formatDateLocal(day);
        return {
          date: dateStr,
          startTime: '',
          endTime: '',
          breakMinutes: 0,
          description: '',
          isHoliday: false,
          isSick: false,
          isVacation: false,
          isException: false
        };
      });
    }

    try {
      // Carregar feriados para o ano da semana selecionada
      const weekYear = new Date(selectedWeek).getFullYear();
      console.log('🎄 createEmptyWeekEntries: Carregando feriados', { userId: user.id, weekYear, selectedContractId });
      const holidays = await payrollService.getHolidays(
        user.id,
        weekYear,
        selectedContractId,
        selectedContract?.workplace_location
      );
      console.log('🎄 createEmptyWeekEntries: Feriados carregados:', holidays);

      return weekDays.map(day => {
        const dateStr = formatDateLocal(day);
        const isHolidayDate = holidays.some(holiday => holiday.date === dateStr);
        
        return {
          date: dateStr,
          startTime: '',
          endTime: '',
          breakMinutes: 0,
          description: '',
          isHoliday: isHolidayDate,
          isSick: false,
          isVacation: false,
          isException: false
        };
      });
    } catch (error) {
      log.error('Error loading holidays for empty entries:', error);
      return weekDays.map(day => {
        const dateStr = formatDateLocal(day);
        return {
          date: dateStr,
          startTime: '',
          endTime: '',
          breakMinutes: 0,
          description: '',
          isHoliday: false,
          isSick: false,
          isVacation: false,
          isException: false
        };
      });
    }
  };

  // Remove the loadContracts useEffect since useActiveContract handles this

  // Effect para carregar política OT quando contrato muda
  useEffect(() => {
    const loadOTPolicy = async () => {
      if (selectedContractId && user?.id) {
        try {
          const policy = await payrollService.getActiveOTPolicy(user.id, selectedContractId);
          setOtPolicy(policy);
        } catch (error) {
          log.error('Failed to load OT policy:', { error, userId: maskId(user?.id), contractId: maskId(selectedContractId) });
          setOtPolicy(null);
        }
      }
    };
    loadOTPolicy();
  }, [selectedContractId]);

  // Effect para carregar entradas quando semana ou contrato muda
  useEffect(() => {
    const initializeEntries = async () => {
      if (selectedContractId) {
        const isWeekNavigation = selectedContractId === activeContract?.id;
        log.info('[Timesheet] week change/init', {
          selectedWeek,
          weekStart: formatDateLocal(weekStartDate),
          weekEnd: formatDateLocal(weekEndDate),
          contractId: maskId(selectedContractId),
          isWeekNavigation,
        });
        await loadExistingEntries(isWeekNavigation);
      } else {
        const emptyEntries = await createEmptyWeekEntries();
        setTimesheet({ entries: emptyEntries });
      }
    };
    initializeEntries();
  }, [selectedContractId, selectedWeek]);

  // Effect para sincronizar feriados regionais/municipais quando contrato muda
  useEffect(() => {
    const syncRegionalHolidaysForContract = async () => {
      if (!selectedContract?.workplace_location || !selectedContractId || !user?.id) {
        return;
      }

      const location = selectedContract.workplace_location.trim();
      if (location === '') {
        return;
      }

      try {
        const isSupported = holidayAutoService.isLocationSupported(location);

        if (isSupported) {
          const currentYear = new Date().getFullYear();

          await holidayAutoService.syncRegionalHolidays(
            user.id,
            selectedContractId,
            currentYear,
            location
          );
          
          log.debug('[Timesheet] Regional holidays synced for contract change', {
            contractId: maskId(selectedContractId),
            location,
            year: currentYear
          });
          
          // Recarregar entradas para refletir os novos feriados
          if (selectedWeek) {
            await loadExistingEntries();
          }
        }
      } catch (error) {
        log.warn('[Timesheet] Failed to sync regional holidays for contract', error);
      }
    };

    syncRegionalHolidaysForContract();
  }, [selectedContract?.workplace_location, selectedContractId]);

  // loadContracts function removed since useActiveContract handles this

  const loadExistingEntries = async (isWeekNavigation = false) => {
     if (!selectedContractId || !user?.id) {
       return;
     }

    if (isWeekNavigation) {
      setWeekNavigationLoading(true);
    } else {
      setLoading(true);
    }
    const t0 = Date.now();
    try {
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      log.debug('[Timesheet] loadExistingEntries window', {
        userId: maskId(user?.id),
        contractId: maskId(selectedContractId),
        isWeekNavigation,
        selectedWeek,
        weekStart: formatDateLocal(weekStart),
        weekEnd: formatDateLocal(weekEnd)
      });

      // Sincronizar feriados regionais/municipais se workplace_location estiver definido
      if (selectedContract?.workplace_location && selectedContract.workplace_location.trim() !== '') {
        try {
          const isSupported = holidayAutoService.isLocationSupported(selectedContract.workplace_location);
          if (isSupported) {
            const currentYear = new Date(selectedWeek).getFullYear();
            await holidayAutoService.syncRegionalHolidays(
              user.id,
              selectedContractId,
              currentYear,
              selectedContract.workplace_location
            );
            log.debug('[Timesheet] Regional holidays synced', {
              contractId: maskId(selectedContractId),
              location: selectedContract.workplace_location,
              year: currentYear
            });
          }
        } catch (error) {
          log.warn('[Timesheet] Failed to sync regional holidays', error);
        }
      }

      // Debug: verificar parâmetros antes de carregar feriados
      console.log('🎄 WeeklyTimesheetForm - Parâmetros para getHolidays:', {
        userId: user.id,
        year: new Date(selectedWeek).getFullYear(),
        selectedContractId,
        activeContractId: activeContract?.id,
        workplaceLocation: selectedContract?.workplace_location,
        allContracts: contracts.map(c => ({ id: c.id, name: c.name, workplace_location: c.workplace_location }))
      });
      
      // Debug: verificar se existe feriado para 15/08/2025 especificamente
      if (new Date(selectedWeek).getFullYear() === 2025) {
        console.log('🔍 Verificando feriado 15/08/2025 para diferentes contratos...');
        
        // Testar com todos os contratos do utilizador
        for (const contract of contracts) {
          try {
            const testHolidays = await payrollService.getHolidays(
              user.id,
              2025,
              contract.id,
              contract.workplace_location
            );
            const august15Holiday = testHolidays.find(h => h.date === '2025-08-15');
            console.log(`🎄 Contrato ${contract.id} (${contract.name}):`, {
              totalHolidays: testHolidays.length,
              august15Holiday: august15Holiday ? { date: august15Holiday.date, name: august15Holiday.name } : 'NÃO ENCONTRADO'
            });
          } catch (error) {
            console.error(`❌ Erro ao testar contrato ${contract.id}:`, error);
          }
        }
      }

      // Buscar dados em paralelo
      const [entries, leaves, holidays, vacations] = await Promise.all([
        payrollService.getTimeEntries(
          user.id,
          selectedContractId,
          selectedWeek,
          formatDateLocal(weekEnd)
        ),
        payrollService.getLeavesForWeek(
          user.id,
          selectedWeek,
          formatDateLocal(weekEnd),
          selectedContractId
        ),
        payrollService.getHolidays(
          user.id,
          new Date(selectedWeek).getFullYear(),
          selectedContractId,
          selectedContract?.workplace_location
        ),
        payrollService.getVacations(
          user.id,
          selectedContractId,
          new Date(selectedWeek).getFullYear()
        )
      ]);

      // Normalizar maps auxiliares
      const entriesByDate = new Map<string, PayrollTimeEntry>();
      for (const e of entries) {
        let d: string;
        if (typeof (e as any).date === 'string') {
          const raw = (e as any).date as unknown as string;
          d = raw.includes('T') ? raw.split('T')[0] : raw;
        } else {
          d = formatDateLocal(new Date((e as any).date));
        }
        entriesByDate.set(d, e);
      }

      const holidaysSet = new Set<string>((holidays || []).map(h => h.date));
      
      // Debug: verificar feriados carregados
      console.log('🎄 WeeklyTimesheetForm - Feriados carregados:', {
        holidaysCount: holidays?.length || 0,
        holidays: holidays?.slice(0, 5), // primeiros 5 feriados
        holidaysSet: Array.from(holidaysSet).slice(0, 5), // primeiras 5 datas no Set
        weekDays: weekDays.map(d => formatDateLocal(d)),
        august15Holiday: holidays?.find(h => h.date === '2025-08-15') ? 'ENCONTRADO ✅' : 'NÃO ENCONTRADO ❌'
      });
      
      // Debug específico para 15/08/2025
      const august15 = '2025-08-15';
      if (weekDays.some(d => formatDateLocal(d) === august15)) {
        console.log('🎯 SEMANA CONTÉM 15/08/2025! Verificando se está marcado como feriado...');
        console.log('🎯 holidaysSet.has("2025-08-15"):', holidaysSet.has(august15));
        console.log('🎯 Feriado 15/08 nos dados:', holidays?.find(h => h.date === august15));
      }

      // Para cada dia da semana, verificar se intersects com algum leave ou vacation
      const leavesByDate = new Map<string, { isSick?: boolean; isVacation?: boolean; leave_type?: string; percentage_paid?: number }>();
      for (const day of weekDays) {
        const ds = formatDateLocal(day);
        
        // Verificar licenças
        const overlaps = (leaves || []).filter(l => {
          const start = new Date((l as any).start_date);
          const end = new Date((l as any).end_date);
          const cur = new Date(ds);
          // normalizar para ignorar horas
          start.setHours(0,0,0,0); end.setHours(0,0,0,0); cur.setHours(0,0,0,0);
          return cur >= start && cur <= end;
        });
        
        // Verificar períodos de férias aprovados
        const vacationOverlaps = (vacations || []).filter(v => {
          // Só considerar férias aprovadas
          if (!(v as any).is_approved) return false;
          
          const start = new Date((v as any).start_date);
          const end = new Date((v as any).end_date);
          const cur = new Date(ds);
          // normalizar para ignorar horas
          start.setHours(0,0,0,0); end.setHours(0,0,0,0); cur.setHours(0,0,0,0);
          return cur >= start && cur <= end;
        });
        
        if (overlaps.length || vacationOverlaps.length) {
          // Mapear tipos simples: sick, vacation (outros ignorados por enquanto)
          let isSick = false;
          let isVacation = false;
          let percentage_paid: number | undefined = undefined;
          
          // Processar licenças
          for (const lv of overlaps) {
            const t = String((lv as any).leave_type || '').toLowerCase();
            if (t.includes('sick') || t === 'doente') isSick = true;
            if (t.includes('vacation') || t === 'férias' || t === 'ferias' || t === 'paid_leave') isVacation = true;
            if (typeof (lv as any).percentage_paid === 'number') percentage_paid = (lv as any).percentage_paid;
          }
          
          // Processar períodos de férias (têm precedência sobre licenças de férias)
          if (vacationOverlaps.length > 0) {
            isVacation = true;
            isSick = false; // férias têm precedência sobre doença
          }
          
          leavesByDate.set(ds, { isSick, isVacation, leave_type: overlaps[0]?.leave_type, percentage_paid });
        }
      }

      // Construir as 7 entradas sempre
      const weekEntries: TimesheetEntry[] = weekDays.map(day => {
        const dateStr = formatDateLocal(day);
        const persisted = entriesByDate.get(dateStr) as any;
        const leaveFlags = leavesByDate.get(dateStr) || {};
        const isHoliday = holidaysSet.has(dateStr);

        // Precedência: feriado > licença
        const isSick = isHoliday ? false : !!leaveFlags.isSick;
        const isVacation = isHoliday ? false : !!leaveFlags.isVacation;

        return {
          date: dateStr,
          startTime: persisted?.start_time || '',
          endTime: persisted?.end_time || '',
          breakMinutes: Number.isFinite(persisted?.break_minutes) ? Number(persisted.break_minutes) : 0,
          description: persisted?.description || '',
          isHoliday,
          isSick,
          isVacation,
          isException: !!persisted?.is_exception,
        } as TimesheetEntry;
      });

      setExistingEntries(entries);
      setTimesheet({ entries: weekEntries });
      
      // Salvar automaticamente as entradas de férias e feriados detectadas
      setTimeout(async () => {
        await autoSaveVacationEntries();
        await autoSaveHolidayEntries();
      }, 100);

      log.info('[Timesheet] loadExistingEntries success', {
        action: 'loadExistingEntries',
        contractId: maskId(selectedContractId),
        userId: maskId(user?.id),
        weekStart: formatDateLocal(weekStart),
        weekEnd: formatDateLocal(weekEnd),
        weekNumber: getWeekNumber(weekStart),
        result: 'ok',
        durationMs: Date.now() - t0,
        entriesCount: entries?.length || 0
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Erro ao carregar entradas da semana.',
        variant: 'destructive'
      });
      log.error('[Timesheet] loadExistingEntries failed', {
        action: 'loadExistingEntries',
        contractId: maskId(selectedContractId),
        userId: maskId(user?.id),
        error
      });
    } finally {
      if (isWeekNavigation) {
        setWeekNavigationLoading(false);
      } else {
        setLoading(false);
      }
    }
  };

  // Guardar timesheet da semana
  const handleSave = async () => {
    console.log('[DEBUG] handleSave iniciado', { selectedContractId, userId: user?.id });
    
    if (!selectedContractId || !user?.id) {
      console.log('[DEBUG] Erro: contrato ou usuário inválido', { selectedContractId, userId: user?.id });
      toast({
        title: 'Erro',
        description: 'Selecione um contrato válido antes de salvar.',
        variant: 'destructive'
      });
      return;
    }

    console.log('[DEBUG] Iniciando salvamento...');
    setSaving(true);
    try {
      console.log('[DEBUG] Calculando datas da semana...');
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      console.log('[DEBUG] Datas calculadas', { weekStart, weekEnd, selectedWeek });

      // Carregar entradas existentes para decidir remoções
      console.log('[DEBUG] Carregando entradas existentes...');
      const existing = await payrollService.getTimeEntries(
        user.id,
        selectedContractId,
        selectedWeek,
        formatDateLocal(weekEnd)
      );
      console.log('[DEBUG] Entradas existentes carregadas', { count: existing.length });

      const existingByDate = new Map<string, PayrollTimeEntry>();
      for (const e of existing) {
        let d: string;
        if (typeof e.date === 'string') {
          d = e.date.includes('T') ? e.date.split('T')[0] : e.date;
        } else {
          d = formatDateLocal(new Date(e.date as any));
        }
        existingByDate.set(d, e);
      }

      const savedEntries: PayrollTimeEntry[] = [];

      for (const e of timesheet.entries) {
        const dateStr = e.date.includes('T') ? e.date.split('T')[0] : e.date;
        const hasData = (!!e.startTime && !!e.endTime) || !!e.isHoliday || !!e.isSick || !!e.isVacation || (!!e.description && e.description.trim().length > 0);
        const existingForDay = existingByDate.get(dateStr);

        if (hasData) {
          // Para feriados, férias e baixas médicas sem horários, usar horários padrão do contrato
          let startTime = e.startTime;
          let endTime = e.endTime;
          
          if ((e.isHoliday || e.isSick || e.isVacation) && (!startTime || !endTime)) {
            const contractTimes = getContractDefaultTimes();
            startTime = contractTimes.startTime;
            endTime = contractTimes.endTime;
          }
          
          // Só criar entrada se temos horários válidos
          if (!startTime || !endTime) {
            console.log('[DEBUG] Entrada ignorada - sem horários válidos:', { date: dateStr, startTime, endTime });
            continue;
          }
          
          const payload = {
            date: dateStr,
            start_time: startTime,
            end_time: endTime,
            break_minutes: e.breakMinutes || 0,
            description: e.description || '',
            is_overtime: false,
            is_holiday: !!e.isHoliday,
            is_sick: !!e.isSick,
            is_vacation: !!e.isVacation,
            is_exception: !!e.isException,
          } as Omit<PayrollTimeEntry, 'id' | 'created_at' | 'updated_at'>;
          
          console.log('[DEBUG] Payload criado:', payload);

          // Upsert via createTimeEntry (já faz update se existir)
          const saved = await payrollService.createTimeEntry(
            user.id,
            selectedContractId,
            payload as any
          );
          savedEntries.push(saved);
        } else if (existingForDay) {
          await payrollService.deleteTimeEntry(existingForDay.id, user.id, selectedContractId);
        }
      }

      // Pós-processamentos não bloqueantes
      try {
        const compensatoryLeaves = await payrollService.processCompensatoryRestForTimeEntries(
          user.id,
          selectedContractId,
          savedEntries
        );
        if (compensatoryLeaves.length > 0) {
          toast({
            title: 'Descanso Compensatório Criado',
            description: `${compensatoryLeaves.length} dia(s) de descanso compensatório foram atribuídos automaticamente por trabalho ao domingo.`,
            duration: 5000
          });
        }
      } catch (e) {
        log.error('Erro ao processar descanso compensatório:', e);
      }

      try {
        const bonusResults = await performanceBonusService.calculateAndSavePerformanceBonuses(
          user.id,
          selectedContractId,
          weekStart,
          weekEnd
        );
        if (Array.isArray(bonusResults)) {
          const applied = bonusResults.filter(r => (r as any).threshold_met);
          if (applied.length > 0) {
            const totalBonus = applied.reduce((sum, r: any) => sum + (r.applied_bonus_amount || 0), 0);
            toast({
              title: 'Bónus de Performance Calculados',
              description: `${applied.length} bónus aplicados totalizando ${formatCurrency(totalBonus)}.`,
              duration: 5000
            });
          }
        }
      } catch (e) {
        log.error('Erro ao calcular bónus de performance:', e);
      }

      toast({
        title: 'Timesheet Salvo',
        description: `${savedEntries.length} entradas de tempo foram salvas.`
      });

      onSave?.(savedEntries);

      // Recarregar entradas para refletir estado atual
      await loadExistingEntries();
    } catch (error) {
      console.error('[DEBUG] Erro ao salvar timesheet:', error);
      console.error('[DEBUG] Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('[DEBUG] Error details:', {
        message: error instanceof Error ? error.message : String(error),
        name: error instanceof Error ? error.name : 'Unknown',
        selectedContractId,
        userId: user?.id,
        selectedWeek
      });
      
      toast({
        title: 'Erro',
        description: `Erro ao salvar timesheet: ${error instanceof Error ? error.message : String(error)}`,
        variant: 'destructive'
      });
      log.error('Error saving timesheet:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const normalizeISO = (raw: string): string => {
      const s = (raw || '').trim().replace(/^"|"$/g, '');
      if (!s) return '';
      // Suporta YYYY-MM-DD e DD/MM/YYYY
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const ddmmyyyy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
      if (ddmmyyyy) {
        const d = parseInt(ddmmyyyy[1], 10);
        const m = parseInt(ddmmyyyy[2], 10) - 1;
        const y = parseInt(ddmmyyyy[3], 10);
        const dt = new Date(y, m, d);
        return formatDateLocal(dt);
      }
      return s; // fallback
    };

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).filter(line => line.trim());

      if (lines.length < 2) {
        throw new Error('Arquivo CSV deve ter pelo menos um cabeçalho e uma linha de dados.');
      }

      // Detectar delimitador por cabeçalho: vírgula ou ponto e vírgula
      const header = lines[0];
      const delimiter = header.includes(';') ? ';' : ',';

      const parseBool = (v?: string): boolean => {
        const s = (v ?? '').trim().replace(/^"|"$/g, '').toLowerCase();
        if (!s) return false;
        if (['1','true','sim','yes','y'].includes(s)) return true;
        if (['0','false','nao','não','no','n'].includes(s)) return false;
        return false;
      };

      const parseField = (v?: string): string => {
        if (!v) return '';
        const trimmed = v.trim();
        // Remover aspas duplas de campos quoted
        return trimmed.replace(/^"|"$/g, '');
      };

      // Ler entradas importadas
      const importedMap = new Map<string, TimesheetEntry>();
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(delimiter).map(s => s.trim());
        if (!parts.length) continue;
        const [date, startTime, endTime, breakMinutes, notes, isHolidayCsv, isSick, isVacation, isException] = parts;
        const iso = normalizeISO(date || '');
        if (iso) {
          importedMap.set(iso, {
            date: iso,
            startTime: normalizeHHmm(parseField(startTime)),
            endTime: normalizeHHmm(parseField(endTime)),
            breakMinutes: parseInt(parseField(breakMinutes)) || 0,
            description: parseField(notes),
            // Ignorar coluna 'feriado' do CSV — gerido pelo calendário da aplicação
            isHoliday: false,
            isSick: parseBool(isSick),
            isVacation: parseBool(isVacation),
            isException: parseBool(isException),
          });
        }
      }

      // Construir semana atual e mesclar import
      const emptyWeek = await createEmptyWeekEntries();
      const currentByDate = new Map<string, TimesheetEntry>((timesheet.entries || []).map(e => [e.date, e]));
      const merged = emptyWeek.map(skel => {
        const iso = skel.date;
        const cur = currentByDate.get(iso) || skel;
        const imp = importedMap.get(iso);
        if (!imp) return cur; // sem alteração para esse dia
        const mergedFlags = {
          // Feriado vem apenas do estado/servidor (ignorar CSV)
          isHoliday: cur.isHoliday || false,
          isSick: (cur.isHoliday) ? false : (imp.isSick ?? cur.isSick),
          isVacation: (cur.isHoliday) ? false : (imp.isVacation ?? cur.isVacation),
          isException: imp.isException ?? cur.isException,
        };
        const blocked = (mergedFlags.isHoliday || mergedFlags.isSick || mergedFlags.isVacation) && !mergedFlags.isException;
        return {
          ...cur,
          startTime: blocked ? '' : (imp.startTime || ''),
          endTime: blocked ? '' : (imp.endTime || ''),
          breakMinutes: blocked ? 0 : (Number.isFinite(imp.breakMinutes as any) ? Number(imp.breakMinutes) : 0),
          description: imp.description || '',
          ...mergedFlags,
        } as TimesheetEntry;
      });

      setTimesheet({ entries: merged });
      log.info('[Timesheet] CSV imported', { count: importedMap.size, contractId: maskId(selectedContractId) });
      toast({
        title: 'CSV Importado',
        description: `${importedMap.size} entradas foram importadas.`
      });
      setAriaLiveMsg('Importação CSV concluída. Entradas atualizadas.');
    } catch (error) {
      toast({
        title: 'Erro de Importação',
        description: 'Erro ao importar arquivo CSV.',
        variant: 'destructive'
      });
      log.error('Error importing CSV:', { error, contractId: maskId(selectedContractId) });
    }
    event.target.value = '';
  };

  // --- Helpers de cálculo de horas (dia/semana) ---
  const getContractDailyHours = (): number => {
    const sc = contracts.find(c => c.id === selectedContractId) || activeContract;
    if (!sc) return 8;
    const workHoursPerDay = (sc as any).work_hours_per_day;
    if (typeof workHoursPerDay === 'number' && workHoursPerDay > 0) return workHoursPerDay;
    const weekly = (sc as any).weekly_hours || 40;
    const daysPerWeek = (sc as any).work_days_per_week || 5;
    return weekly / daysPerWeek;
  };

  // Helper para obter horários padrão do contrato
  const getContractDefaultTimes = (): { startTime: string; endTime: string; breakMinutes: number } => {
    const sc = contracts.find(c => c.id === selectedContractId) || activeContract;
    if (!sc || !sc.schedule_json) {
      return { startTime: '08:00', endTime: '17:00', breakMinutes: 60 };
    }

    const schedule = sc.schedule_json as Record<string, any>;
    const useStandard = !!schedule.use_standard && !!schedule.start_time && !!schedule.end_time;
    
    return useStandard ? {
      startTime: schedule.start_time || '08:00',
      endTime: schedule.end_time || '17:00',
      breakMinutes: schedule.break_minutes ?? 60
    } : {
      startTime: '08:00', 
      endTime: '17:00', 
      breakMinutes: 60
    };
  };

  const calculateDayHours = (entry: TimesheetEntry): number => {
    if (!entry?.startTime || !entry?.endTime) return 0;
    const breakM = Number.isFinite(Number(entry.breakMinutes)) ? Number(entry.breakMinutes) : 0;
    const hours = calculateHours(entry.startTime, entry.endTime, breakM);
    if (!Number.isFinite(hours)) {
      log.warn('[Timesheet] calculateDayHours -> resultado inválido', { entry, breakM, hours });
      return 0;
    }
    return Math.max(0, hours);
  };

  const calculateDayHoursWithOT = (entry: TimesheetEntry): { totalHours: number; regularHours: number; overtimeHours: number } => {
    if (!entry?.startTime || !entry?.endTime) {
      return { totalHours: 0, regularHours: 0, overtimeHours: 0 };
    }

    const totalHours = calculateDayHours(entry);
    const contractDailyHours = getContractDailyHours();

    if (!Number.isFinite(totalHours)) {
      log.warn('[Timesheet] calculateDayHoursWithOT -> totalHours inválido', { entry, totalHours });
      return { totalHours: 0, regularHours: 0, overtimeHours: 0 };
    }

    // Em feriado, todas as horas são OT por padrão
    if (entry.isHoliday) {
      return { totalHours, regularHours: 0, overtimeHours: totalHours };
    }

    // Sem política OT definida, considerar excedente sobre horas contratuais diárias
    if (!otPolicy) {
      const regular = Math.min(totalHours, contractDailyHours);
      const overtime = Math.max(0, totalHours - contractDailyHours);
      return { totalHours, regularHours: regular, overtimeHours: overtime };
    }

    // Converter para PayrollTimeEntry e segmentar com a política OT
    const pte = {
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      break_minutes: Number.isFinite(Number(entry.breakMinutes)) ? Number(entry.breakMinutes) : 0,
      is_holiday: !!entry.isHoliday,
      is_sick: !!entry.isSick,
      is_vacation: !!entry.isVacation,
    } as any;

    try {
      const segments = segmentEntry(pte, otPolicy, contractDailyHours);
      let regular = 0;
      let overtime = 0;
      segments.forEach((s: any) => {
        if (s.isOvertime) overtime += s.hours; else regular += s.hours;
      });
      return { totalHours, regularHours: regular, overtimeHours: overtime };
    } catch (e) {
      if (typeof console !== 'undefined') {
        log.warn('[Timesheet] segmentEntry falhou, fallback simples aplicado', { error: e, pte });
      }
      // Fallback conservador
      const regular = Math.min(totalHours, contractDailyHours);
      const overtime = Math.max(0, totalHours - contractDailyHours);
      return { totalHours, regularHours: regular, overtimeHours: overtime };
    }
  };

  const calculateWeekTotals = () => {
    return timesheet.entries.reduce(
      (acc, entry) => {
        const b = calculateDayHoursWithOT(entry);
        acc.total += b.totalHours;
        acc.regular += b.regularHours;
        acc.overtime += b.overtimeHours;
        return acc;
      },
      { total: 0, regular: 0, overtime: 0 }
    );
  };

  const calculateWeekTotal = () => calculateWeekTotals().total;
  const calculateWeekRegularTotal = () => calculateWeekTotals().regular;
  const calculateWeekOvertimeTotal = () => calculateWeekTotals().overtime;

  // --- Handlers de edição e ações da semana ---
  const updateEntry = <K extends keyof TimesheetEntry>(index: number, field: K, value: TimesheetEntry[K]) => {
    setTimesheet(prev => {
      const entries = [...prev.entries];
      const current = { ...entries[index] };
  
      // Regras de consistência entre flags
      if (field === 'isHoliday' && typeof value === 'boolean') {
        if (value) {
          // Feriado tem precedência: desmarcar férias/doente se não for exceção
          current.isVacation = false;
          current.isSick = false;
          if (!current.isException) {
            current.startTime = '';
            current.endTime = '';
            current.breakMinutes = 0;
          }
        }
      }
      if (field === 'isVacation' && typeof value === 'boolean') {
        if (value) {
          current.isHoliday = false;
          current.isSick = false;
          if (!current.isException) {
            current.startTime = '';
            current.endTime = '';
            current.breakMinutes = 0;
          }
        }
      }
      if (field === 'isSick' && typeof value === 'boolean') {
        if (value) {
          current.isHoliday = false;
          current.isVacation = false;
          if (!current.isException) {
            current.startTime = '';
            current.endTime = '';
            current.breakMinutes = 0;
          }
        }
      }
  
      if (field === 'breakMinutes' && typeof value === 'number') {
        current.breakMinutes = Math.max(0, value || 0);
      } else {
        // @ts-expect-error - atribuição dinâmica controlada
        current[field] = value as any;
      }
  
      entries[index] = current;
      return { entries };
    });
  };
  
  const clearDayEntry = (index: number) => {
    setTimesheet(prev => {
      const entries = [...prev.entries];
      const current = { ...entries[index] };
      entries[index] = {
        ...current,
        startTime: '',
        endTime: '',
        breakMinutes: 0,
        description: '',
        isException: false,
        // Manter flags de feriado/férias/doente como estão
      };
      return { entries };
    });
  };
  
  const fillNormalWeek = async () => {
    try {
      const sc = contracts.find(c => c.id === selectedContractId) || activeContract;

      if (!sc || !sc.schedule_json) {
        toast({
          title: 'Sem horário padrão',
          description: 'Este contrato não possui um horário semanal definido.',
          variant: 'destructive'
        });
        return;
      }

      // Calcular janela da semana atual
      const weekStart = new Date(selectedWeek);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      // Buscar feriados, licenças e férias para esta semana para garantir flags corretas mesmo sem entradas prévias
      let holidays: any[] = [];
      let leaves: any[] = [];
      let vacations: any[] = [];
      try {
        [holidays, leaves, vacations] = await Promise.all([
          payrollService.getHolidays(
            user!.id,
            weekStart.getFullYear(),
            selectedContractId,
            sc?.workplace_location ?? selectedContract?.workplace_location
          ),
          payrollService.getLeavesForWeek(
            user!.id,
            selectedWeek,
            formatDateLocal(weekEnd),
            selectedContractId
          ),
          payrollService.getVacations(
            user!.id,
            selectedContractId,
            weekStart.getFullYear()
          )
        ]);

      } catch (err) {
          log.warn('fillNormalWeek: falha ao obter feriados/licenças/férias', err);
        }

      const holidaysSet = new Set<string>((holidays || []).map((h: any) => h.date));
      const leavesByDate = new Map<string, { isSick?: boolean; isVacation?: boolean }>();
      for (const day of weekDays) {
        const ds = formatDateLocal(day);
        
        // Verificar licenças
        const overlaps = (leaves || []).filter((l: any) => {
          const start = new Date(l.start_date);
          const end = new Date(l.end_date);
          const cur = new Date(ds);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          cur.setHours(0, 0, 0, 0);
          return cur >= start && cur <= end;
        });
        
        // Verificar períodos de férias aprovados
        const vacationOverlaps = (vacations || []).filter((v: any) => {
          // Só considerar férias aprovadas
          if (!v.is_approved) return false;
          
          const start = new Date(v.start_date);
          const end = new Date(v.end_date);
          const cur = new Date(ds);
          start.setHours(0, 0, 0, 0);
          end.setHours(0, 0, 0, 0);
          cur.setHours(0, 0, 0, 0);
          return cur >= start && cur <= end;
        });
        
        if (overlaps.length || vacationOverlaps.length) {
          let isSick = false;
          let isVacation = false;
          
          // Processar licenças
          for (const lv of overlaps) {
            const t = String(lv.leave_type || '').toLowerCase();
            if (t.includes('sick') || t === 'doente') isSick = true;
            if (t.includes('vacation') || t === 'férias' || t === 'ferias' || t === 'paid_leave') isVacation = true;
          }
          
          // Processar períodos de férias (têm precedência sobre licenças de férias)
          if (vacationOverlaps.length > 0) {
            isVacation = true;
            isSick = false; // férias têm precedência sobre doença
          }
          
          leavesByDate.set(ds, { isSick, isVacation });
        }
      }

      const schedule = sc.schedule_json as Record<string, any>;
      const dayKeyByIndex = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];

      // Obter horários padrão usando a função helper
      const contractTimes = getContractDefaultTimes();
      const useStandard = !!schedule.use_standard && !!schedule.start_time && !!schedule.end_time;
      const standardStart = contractTimes.startTime;
      const standardEnd = contractTimes.endTime;
      const standardBreak = contractTimes.breakMinutes;



      log.debug('fillNormalWeek()', { useStandard, standardStart, standardEnd, standardBreak, schedule });

      setTimesheet(prev => {
        const filled = weekDays.map((d) => {
          const dateStr = formatDateLocal(d);
          // Manter entrada existente para preservar flags e descrição
          const existing = prev.entries.find(e => (e.date.includes('T') ? e.date.split('T')[0] : e.date) === dateStr);
          const dayKey = dayKeyByIndex[d.getDay()];
          const dayCfg = schedule[dayKey];
          const isWeekday = d.getDay() >= 1 && d.getDay() <= 5; // Mon-Fri

          const flagsFromData = {
            isHoliday: holidaysSet.has(dateStr),
            isSick: !holidaysSet.has(dateStr) && !!(leavesByDate.get(dateStr)?.isSick),
            isVacation: !holidaysSet.has(dateStr) && !!(leavesByDate.get(dateStr)?.isVacation),
          };



          const base: TimesheetEntry = existing ? {
            ...existing,
            // Feriado prevalece sobre licenças
            isHoliday: existing.isHoliday || flagsFromData.isHoliday,
            isSick: (existing.isSick || flagsFromData.isSick) && !flagsFromData.isHoliday,
            isVacation: (existing.isVacation || flagsFromData.isVacation) && !flagsFromData.isHoliday,
          } : {
            date: dateStr,
            startTime: '',
            endTime: '',
            breakMinutes: 0,
            description: '',
            isHoliday: flagsFromData.isHoliday,
            isSick: flagsFromData.isSick,
            isVacation: flagsFromData.isVacation,
            isException: false,
          };

          if ((base.isHoliday || base.isSick || base.isVacation) && !base.isException) {
            // Em feriado/férias/doença sem exceção, não preencher horas
            return base;
          }

          if (dayCfg) {
            const enabled = dayCfg.enabled ?? true;
            if (!enabled) {
              // Dia desativado: limpar horas (mas manter flags/descrição)
              return { ...base, startTime: '', endTime: '', breakMinutes: 0 };
            }

            const start = dayCfg.start || dayCfg.start_time || (useStandard ? standardStart : undefined) || base.startTime || '09:00';
            const end = dayCfg.end || dayCfg.end_time || (useStandard ? standardEnd : undefined) || base.endTime || '18:00';
            const breakM = (dayCfg.break_minutes ?? (useStandard ? standardBreak : undefined) ?? base.breakMinutes ?? 0) as number;



            return {
              ...base,
              startTime: start,
              endTime: end,
              breakMinutes: breakM,
            };
          }

          if (useStandard && isWeekday) {
            const finalStart = standardStart || base.startTime || '09:00';
            const finalEnd = standardEnd || base.endTime || '18:00';
            const finalBreak = (standardBreak ?? base.breakMinutes ?? 0) as number;



            return {
              ...base,
              startTime: finalStart,
              endTime: finalEnd,
              breakMinutes: finalBreak,
            };
          }

          // Dia sem configuração: limpar horas (mas manter flags/descrição)
          return {
            ...base,
            startTime: '',
            endTime: '',
            breakMinutes: 0,
          };
        });
        return { entries: filled };
      });

      toast({ title: 'Semana preenchida', description: 'Horas padrão aplicadas segundo o contrato.' });
      setAriaLiveMsg('Semana preenchida com horas padrão.');
      
      // Salvar automaticamente as entradas de férias e feriados detectadas
      await autoSaveVacationEntries();
      await autoSaveHolidayEntries();
    } catch (e) {
      log.error('Erro ao preencher semana normal:', e);
      toast({ title: 'Erro', description: 'Falha ao preencher a semana.', variant: 'destructive' });
    }
  };

  // Função para salvar automaticamente entradas de férias
  const autoSaveVacationEntries = async () => {
    if (!selectedContractId || !user?.id || !selectedContract) return;

    try {
      const vacationEntries = timesheet.entries.filter(entry => entry.isVacation);
      
      if (vacationEntries.length === 0) return;

      const savedEntries: PayrollTimeEntry[] = [];

      for (const entry of vacationEntries) {
        const dateStr = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
        
        // Verificar se já existe entrada para este dia
        const existing = await payrollService.getTimeEntries(
          user.id,
          selectedContractId,
          dateStr,
          dateStr
        );

        // Se não existe entrada ou a entrada existente não está marcada como férias, criar/atualizar
        if (existing.length === 0 || !existing[0].is_vacation) {
          // Usar horários padrão do contrato
          const contractTimes = getContractDefaultTimes();

          const payload = {
            date: dateStr,
            start_time: contractTimes.startTime,
            end_time: contractTimes.endTime,
            break_minutes: contractTimes.breakMinutes,
            description: 'Férias (marcação automática)',
            is_overtime: false,
            is_holiday: false,
            is_sick: false,
            is_vacation: true,
            is_exception: false,
          } as Omit<PayrollTimeEntry, 'id' | 'created_at' | 'updated_at'>;

          const saved = await payrollService.createTimeEntry(
            user.id,
            selectedContractId,
            payload as any
          );
          savedEntries.push(saved);
        }
      }

      if (savedEntries.length > 0) {
        toast({
          title: 'Férias Registadas',
          description: `${savedEntries.length} dia(s) de férias foram automaticamente registados.`,
          duration: 5000
        });
        
        log.info('autoSaveVacationEntries: entradas de férias salvas automaticamente', {
          count: savedEntries.length,
          contractId: maskId(selectedContractId),
          userId: maskId(user.id)
        });
      }
    } catch (error) {
      log.error('autoSaveVacationEntries: erro ao salvar entradas de férias automaticamente', error);
      // Não mostrar toast de erro para não interromper o fluxo do utilizador
    }
  };

  // Função para salvar automaticamente entradas de feriados
  const autoSaveHolidayEntries = async () => {
    if (!selectedContractId || !user?.id || !selectedContract) return;

    try {
      // Primeiro, atualizar o estado local para marcar as checkboxes
      const holidayDates = new Set<string>();
      
      // Buscar feriados para garantir que temos a lista atualizada
      const year = new Date(selectedWeek).getFullYear();
      console.log('🎄 autoSaveHolidayEntries: Carregando feriados para o ano', year);
      const holidays = await payrollService.getHolidays(user.id, year, selectedContractId, selectedContract?.workplace_location);
      console.log('🎄 autoSaveHolidayEntries: Feriados carregados:', holidays);
      holidays.forEach(holiday => {
        holidayDates.add(holiday.date);
      });
      console.log('🎄 autoSaveHolidayEntries: Datas de feriados:', Array.from(holidayDates));
      
      // Atualizar estado local das entradas para marcar feriados
      setTimesheet(prev => {
        const updatedEntries = prev.entries.map(entry => {
          const dateStr = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
          if (holidayDates.has(dateStr)) {
            console.log('🎄 Marcando entrada como feriado:', dateStr, entry);
            return {
              ...entry,
              isHoliday: true,
              // Limpar horários se não for exceção
              startTime: entry.isException ? entry.startTime : '',
              endTime: entry.isException ? entry.endTime : '',
              breakMinutes: entry.isException ? entry.breakMinutes : 0
            };
          }
          return entry;
        });
        console.log('🎄 Estado atualizado com entradas:', updatedEntries.filter(e => e.isHoliday));
        return { entries: updatedEntries };
      });
      
      // Depois, salvar na base de dados apenas as entradas que são feriados
      const holidayEntries = timesheet.entries.filter(entry => {
        const dateStr = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
        return holidayDates.has(dateStr);
      });
      
      if (holidayEntries.length === 0) return;

      const savedEntries: PayrollTimeEntry[] = [];

      for (const entry of holidayEntries) {
        const dateStr = entry.date.includes('T') ? entry.date.split('T')[0] : entry.date;
        
        // Verificar se já existe entrada para este dia
        const existing = await payrollService.getTimeEntries(
          user.id,
          selectedContractId,
          dateStr,
          dateStr
        );

        // Se não existe entrada ou a entrada existente não está marcada como feriado, criar/atualizar
        if (existing.length === 0 || !existing[0].is_holiday) {
          // Para feriados, usar horários padrão do contrato (não são trabalhados mas precisam de valores válidos na BD)
          const contractTimes = getContractDefaultTimes();
          const payload = {
            date: dateStr,
            start_time: contractTimes.startTime,
            end_time: contractTimes.endTime,
            break_minutes: contractTimes.breakMinutes,
            description: 'Feriado (marcação automática)',
            is_overtime: false,
            is_holiday: true,
            is_sick: false,
            is_vacation: false,
            is_exception: false,
          } as Omit<PayrollTimeEntry, 'id' | 'created_at' | 'updated_at'>;

          const saved = await payrollService.createTimeEntry(
            user.id,
            selectedContractId,
            payload as any
          );
          savedEntries.push(saved);
        }
      }

      if (savedEntries.length > 0) {
        toast({
          title: 'Feriados Registados',
          description: `${savedEntries.length} feriado(s) foram automaticamente registados.`,
          duration: 5000
        });
        
        log.info('autoSaveHolidayEntries: entradas de feriados salvas automaticamente', {
          count: savedEntries.length,
          contractId: maskId(selectedContractId),
          userId: maskId(user.id)
        });
      }
    } catch (error) {
      log.error('autoSaveHolidayEntries: erro ao salvar entradas de feriados automaticamente', error);
      // Não mostrar toast de erro para não interromper o fluxo do utilizador
    }
  };

  const clearWeekEntries = async () => {
    if (!selectedContractId || !user?.id) {
      setTimesheet({ entries: await createEmptyWeekEntries() });
      return;
    }
  
    const confirmed = window.confirm('Tem a certeza que pretende apagar todas as entradas desta semana?');
    if (!confirmed) return;
  
    try {
      setLoading(true);
      const start = new Date(selectedWeek);
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
  
      const entries = await payrollService.getTimeEntries(
        user.id,
        selectedContractId,
        selectedWeek,
        formatDateLocal(end)
      );
  
      for (const e of entries) {
        await payrollService.deleteTimeEntry(e.id, user.id, selectedContractId);
      }
  
      setExistingEntries([]);
      setTimesheet({ entries: await createEmptyWeekEntries() });
      toast({ title: 'Semana apagada', description: 'Todas as entradas desta semana foram removidas.' });
      setAriaLiveMsg('Entradas da semana foram limpas.');
    } catch (e) {
      log.error('Erro ao apagar semana:', e);
      toast({ title: 'Erro', description: 'Falha ao apagar as entradas da semana.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = ['data', 'inicio', 'fim', 'pausa_minutos', 'notas', 'feriado', 'doente', 'ferias', 'excecao'];
    const rows = timesheet.entries.map(entry => [
      entry.date,
      entry.startTime,
      entry.endTime,
      String(entry.breakMinutes ?? 0),
      entry.description ?? '',
      entry.isHoliday ? '1' : '0',
      entry.isSick ? '1' : '0',
      entry.isVacation ? '1' : '0',
      entry.isException ? '1' : '0'
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `timesheet_${selectedWeek}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const { total: weekTotal } = calculateWeekTotals();
  // selectedContract definido anteriormente; evitar redeclaração nesta secção
  // const selectedContract = contracts.find(c => c.id === selectedContractId) || activeContract;
  const standardWeeklyHours = selectedContract ? (selectedContract.weekly_hours || 40) : 40;
  const overtimeHours = Math.max(0, weekTotal - standardWeeklyHours);
  const WEEKLY_LIMIT_HOURS = 48;
  const isWeeklyLimitExceeded = weekTotal > WEEKLY_LIMIT_HOURS;



  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2 text-lg">Carregando timesheet...</span>
      </div>
    );
  }

  if (!selectedContract) {
    return (
      <div className="text-center p-8">
        <p className="text-gray-500">Selecione um contrato para ver a timesheet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <TimesheetHeader
        weekDays={weekDays}
        weekNumber={getWeekNumber(new Date(selectedWeek))}
        onImportCSV={handleImportCSV}
        onExportCSV={exportToCSV}
      />

      {/* Resumo da Semana */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Horas Regulares</Label>
              <div className="text-2xl font-bold text-green-600">
                {calculateWeekRegularTotal().toFixed(2)}h
              </div>
            </div>
            <div>
              <Label>Horas Extras</Label>
              <div className={`text-2xl font-bold ${
                calculateWeekOvertimeTotal() > 0 ? 'text-amber-600' : 'text-green-600'
              }`}>
                {calculateWeekOvertimeTotal().toFixed(2)}h
              </div>
            </div>
            <div>
              <Label>Total da Semana</Label>
              <div className="text-2xl font-bold text-blue-600">
                {weekTotal.toFixed(2)}h
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timesheet Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex flex-col items-start gap-2">
              <CardTitle>Entradas de Tempo</CardTitle>
              <div className="flex items-center gap-2 text-muted-foreground">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToPrevWeek}
                        aria-label={t('timesheet.nav.prev_with_shortcut')}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('timesheet.nav.prev_with_shortcut')}
                    </TooltipContent>
                  </Tooltip>
                  <CardDescription className="m-0">
                    {formattedWeekRange}
                  </CardDescription>
                  <span className="text-muted-foreground text-sm">•</span>
                  <Badge variant="secondary" aria-label={t('timesheet.week_short', { num: getWeekNumber(weekDays?.[0] ?? new Date()) })}>
                    {t('timesheet.week_short', { num: getWeekNumber(weekDays?.[0] ?? new Date()) })}
                  </Badge>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={goToNextWeek}
                        aria-label={t('timesheet.nav.next_with_shortcut')}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {t('timesheet.nav.next_with_shortcut')}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>
            <div className="flex gap-2">
              <Button 
                onClick={fillNormalWeek} 
                variant="default" 
                size="sm"
                disabled={!selectedContract?.schedule_json}
              >
                <Calendar className="mr-2 h-4 w-4" />
                Preencher Semana Normal
              </Button>
              <Button 
                onClick={clearWeekEntries} 
                variant="destructive" 
                size="sm"
                disabled={loading || existingEntries.length === 0}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Apagar Semana
              </Button>

            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto relative">
            {weekNavigationLoading && (
              <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
                <div className="bg-white rounded-lg shadow-lg p-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Carregando semana...</span>
                </div>
              </div>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Dia</TableHead>
                  <TableHead>Início</TableHead>
                  <TableHead>Fim</TableHead>
                  <TableHead>Pausa (min)</TableHead>
                  <TableHead>Horas</TableHead>
                  <TableHead>Exceção</TableHead>
                  <TableHead>Feriado</TableHead>
                  <TableHead>Férias</TableHead>
                  <TableHead>Doente</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[50px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {timesheet.entries.map((entry, index) => {
                  const dayHours = calculateDayHours(entry);
                  const dayIndex = weekDays.findIndex(d => 
                    formatDateLocal(d) === entry.date
                  );
                  
                  return (
                    <TableRow key={`${entry.date}-${index}`}>
                      <TableCell>
                        <Select
                          value={entry.date}
                          onValueChange={(value) => updateEntry(index, 'date', value)}
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {weekDays.map((day, i) => (
                              <SelectItem key={i} value={formatDateLocal(day)}>
                                {day.toLocaleDateString('pt-PT')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {dayIndex >= 0 ? dayNames[weekDays[dayIndex].getDay()] : 'N/A'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={entry.startTime || ''}
                          onChange={(e) => updateEntry(index, 'startTime', e.target.value)}
                          disabled={(entry.isHoliday || entry.isSick || entry.isVacation) && !entry.isException}
                          className="w-[120px]"
                          aria-label="Hora de início"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="time"
                          value={entry.endTime || ''}
                          onChange={(e) => updateEntry(index, 'endTime', e.target.value)}
                          disabled={(entry.isHoliday || entry.isSick || entry.isVacation) && !entry.isException}
                          className="w-[120px]"
                          aria-label="Hora de fim"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          min="0"
                          value={entry.breakMinutes}
                          onChange={(e) => updateEntry(index, 'breakMinutes', parseInt(e.target.value) || 0)}
                          disabled={(entry.isHoliday || entry.isSick || entry.isVacation) && !entry.isException}
                          className="w-[80px]"
                          aria-label="Minutos de pausa"
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          {(() => {
                            const hoursBreakdown = calculateDayHoursWithOT(entry);
                            const totalHours = Number.isFinite(Number(hoursBreakdown.totalHours)) ? Number(hoursBreakdown.totalHours) : 0;
                            if (!Number.isFinite(totalHours)) {
                              log.warn('[Timesheet] UI -> totalHours inválido', { entry, hoursBreakdown });
                            }
                            return (
                              <>
                                <Badge variant={totalHours > 8 ? 'destructive' : 'default'}>
                                  {totalHours.toFixed(2)}h
                                </Badge>
                                {hoursBreakdown.overtimeHours > 0 && (
                                  <div className="text-xs text-muted-foreground">
                                    <span className="text-green-600">{hoursBreakdown.regularHours.toFixed(2)}h</span>
                                    {' + '}
                                    <span className="text-amber-600">{hoursBreakdown.overtimeHours.toFixed(2)}h OT</span>
                                  </div>
                                )}
                              </>
                            );
                          })()}
                          {entry.isHoliday && (
                            <Badge variant="secondary" className="text-xs bg-red-100 text-red-800">
                              Feriado
                            </Badge>
                          )}
                          {entry.isVacation && (
                            <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-800">
                              Férias
                            </Badge>
                          )}
                          {entry.isSick && (
                            <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">
                              Doente
                            </Badge>
                          )}
                          {entry.isException && (
                            <Badge variant="outline" className="text-xs">
                              Exceção
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={entry.isException || false}
                          onChange={(e) => updateEntry(index, 'isException', e.target.checked)}
                          className="h-4 w-4"
                          aria-label="Marcar como exceção ao horário normal"
                          title="Permite editar horas mesmo em feriados/férias/doente"
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={entry.isHoliday}
                          disabled
                          onChange={(e) => updateEntry(index, 'isHoliday', e.target.checked)}
                          className="h-4 w-4"
                          aria-label="Indicador de feriado (sincronizado)"
                          title="Feriado sincronizado pelo calendário. Use 'Exceção' para editar horas num feriado."
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={entry.isVacation || false}
                          onChange={(e) => updateEntry(index, 'isVacation', e.target.checked)}
                          disabled={entry.isHoliday}
                          className="h-4 w-4"
                          aria-label="Marcar como férias"
                          title={entry.isHoliday ? "Não é possível marcar férias em feriado" : "Marcar como férias"}
                        />
                      </TableCell>
                      <TableCell>
                        <input
                          type="checkbox"
                          checked={entry.isSick}
                          onChange={(e) => updateEntry(index, 'isSick', e.target.checked)}
                          disabled={entry.isHoliday || entry.isVacation}
                          className="h-4 w-4"
                          aria-label="Marcar como doente"
                          title={entry.isHoliday || entry.isVacation ? "Não é possível marcar doente em feriado ou férias" : "Marcar como doente"}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={entry.description}
            onChange={(e) => updateEntry(index, 'description', e.target.value)}
                          placeholder="Descrição..."
                          className="w-[150px]"
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => clearDayEntry(index)}
                          title="Limpar dados da entrada"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Summary & Actions */}
      <Card>
        <CardContent className="pt-6">
          {/* Região aria-live apenas para leitores de ecrã */}
          <div className="sr-only" aria-live="polite">{ariaLiveMsg || ''}</div>
          {isWeeklyLimitExceeded && (
            <Alert role="alert" aria-live="assertive" className="mb-4 border-red-300">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription>
                Atenção: limite semanal de 48h excedido. Total atual: <span className="font-semibold">{weekTotal.toFixed(2)}h</span>.
              </AlertDescription>
            </Alert>
          )}
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              {blockedNotice && (
                <div className="text-sm text-muted-foreground">{blockedNotice}</div>
              )}
               <div className="flex items-center gap-4">
                 <div className="text-sm text-muted-foreground">
                   Total: <span className="font-medium">{weekTotal.toFixed(2)}h</span>
                 </div>
                 <div className="text-sm text-muted-foreground">
                   Padrão: <span className="font-medium">{standardWeeklyHours}h</span>
                 </div>
                 {overtimeHours > 0 && (
                   <div className="text-sm text-amber-600">
                     Horas Extras: <span className="font-medium">{overtimeHours.toFixed(2)}h</span>
                   </div>
                 )}
               </div>
              {existingEntries.length > 0 && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Esta semana já possui {existingEntries.length} entrada(s) salva(s). 
                    Salvar novamente irá substituir as entradas existentes.
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <Button onClick={handleSave} disabled={saving || !selectedContractId}>
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              {saving ? 'Salvando...' : 'Salvar Timesheet'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function normalizeHHmm(value: string | number | null | undefined): string {
  if (value == null) return '';
  let s = String(value).trim().toLowerCase();
  if (!s) return '';
  s = s.replace(/[h]/g, ':').replace(/\./g, ':').replace(/;/g, ':');
  if (/^\d{3,4}$/.test(s)) {
    if (s.length === 3) s = '0' + s;
    s = `${s.slice(0, 2)}:${s.slice(2)}`;
  }
  const m = s.match(/^(\d{1,2})(?::(\d{1,2}))?$/);
  if (!m) return '';
  let hh = parseInt(m[1], 10);
  let mm = m[2] != null ? parseInt(m[2], 10) : 0;
  if (isNaN(hh) || isNaN(mm)) return '';
  if (hh > 23) hh = hh % 24;
  if (mm > 59) mm = 59;
  return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`;
}