import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';
import { PayrollVacation, PayrollVacationFormData } from '../types';
import { payrollService } from '../services/payrollService';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { format, parseISO, differenceInDays, addDays, isWeekend } from 'date-fns';
import { withContext, maskId } from '@/shared/lib/logger';

interface PayrollVacationFormProps {
  vacation?: PayrollVacation;
  year: number;
  contractId?: string;
  existingVacations?: PayrollVacation[];
  onSave: (vacation: PayrollVacation) => void;
  onCancel: () => void;
}

export function PayrollVacationForm({ vacation, year, contractId, existingVacations = [], onSave, onCancel }: PayrollVacationFormProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const correlationId = useRef(globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState<PayrollVacationFormData>({
    start_date: vacation?.start_date || '',
    end_date: vacation?.end_date || '',
    description: vacation?.description || ''
  });
  const [isApproved, setIsApproved] = useState(vacation?.is_approved || false);
  // Unit 12a: affects_subsidy reduces vacation subsidy pro-rata
  const [affectsSubsidy, setAffectsSubsidy] = useState<boolean>((vacation as any)?.affects_subsidy ?? false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const log = withContext({ feature: 'payroll', component: 'PayrollVacationForm', correlationId: correlationId.current });

  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;
    
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    
    let workingDays = 0;
    let currentDate = start;
    
    while (currentDate <= end) {
      if (!isWeekend(currentDate)) {
        workingDays++;
      }
      currentDate = addDays(currentDate, 1);
    }
    
    return workingDays;
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.start_date) {
      newErrors.start_date = 'Data de início é obrigatória';
    }

    if (!formData.end_date) {
      newErrors.end_date = 'Data de fim é obrigatória';
    }
    
    if (formData.start_date && formData.end_date) {
      const startDate = parseISO(formData.start_date);
      const endDate = parseISO(formData.end_date);
      
      if (startDate > endDate) {
        newErrors.end_date = 'Data de fim deve ser posterior à data de início';
      }
      
      if (startDate.getFullYear() !== year || endDate.getFullYear() !== year) {
        newErrors.start_date = `As datas devem estar no ano ${year}`;
      }
      
      const workingDays = calculateWorkingDays(formData.start_date, formData.end_date);
      if (workingDays === 0) {
        newErrors.start_date = 'O período deve incluir pelo menos um dia útil';
      }
      
      // Verificar sobreposição com férias existentes
      const hasOverlap = existingVacations.some(existingVacation => {
        // Ignorar a própria férias se estivermos a editar
        if (vacation && existingVacation.id === vacation.id) {
          return false;
        }
        
        // Verificar se é o mesmo contrato (ambos devem ser iguais ou ambos null/undefined)
        const currentContractId = contractId || null;
        const existingContractId = existingVacation.contract_id || null;
        
        if (currentContractId !== existingContractId) {
          return false;
        }
        
        const existingStart = parseISO(existingVacation.start_date);
        const existingEnd = parseISO(existingVacation.end_date);
        
        // Verificar sobreposição (usando a mesma lógica da base de dados)
        return (
          (startDate >= existingStart && startDate <= existingEnd) ||
          (endDate >= existingStart && endDate <= existingEnd) ||
          (existingStart >= startDate && existingStart <= endDate) ||
          (existingEnd >= startDate && existingEnd <= endDate)
        );
      });
      
      if (hasOverlap) {
        newErrors.start_date = 'Este período sobrepõe-se com férias já existentes';
      }
    }
    
    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    log.debug('handleSubmit started');
    log.debug('Form data', { fields: Object.keys(formData || {}) });
    log.debug('User', { userId: maskId(user?.id) });
    log.debug('Contract', { contractId: maskId(contractId) });
    log.debug('Editing mode', { isEditing: !!vacation });

    if (!validateForm() || !user?.id) {
      log.warn('Form validation failed or missing user ID');
      return;
    }
    setLoading(true);
    try {
      const workingDays = calculateWorkingDays(formData.start_date, formData.end_date);
      log.debug('Calculated working days', { workingDays });
      
      const vacationData = {
        ...formData,
        days_count: workingDays,
        year,
        is_approved: isApproved,
        affects_subsidy: affectsSubsidy,
      };
      
      log.debug('Vacation data to save', { fields: Object.keys(vacationData) });
      
      let savedVacation: PayrollVacation;
      
      if (vacation) {
        log.debug('Calling updateVacation', { vacationId: maskId(vacation?.id) });
        savedVacation = await payrollService.updateVacation(vacation.id, vacationData, user.id, contractId);
      } else {
        log.debug('Calling createVacation');
        savedVacation = await payrollService.createVacation(user.id, contractId || '', vacationData);
      }
      
      log.info('Vacation saved successfully', { id: maskId(savedVacation?.id) });
      log.debug('Calling onSave callback');
      onSave(savedVacation);
      log.debug('onSave callback completed');
    } catch (error) {
      log.error('Error saving vacation', { error: error instanceof Error ? error.message : String(error) });
      log.error('Error details', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      // Toast de erro será exibido pelo componente pai (PayrollVacationsManager)
      throw error; // Re-throw para que o componente pai possa tratar
    } finally {
      log.debug('Setting loading to false');
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof PayrollVacationFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const workingDays = calculateWorkingDays(formData.start_date, formData.end_date);

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_date">Data de Início</Label>
          <Input
            id="start_date"
            type="date"
            value={formData.start_date}
            onChange={(e) => handleInputChange('start_date', e.target.value)}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            className={errors.start_date ? 'border-red-500' : ''}
          />
          {errors.start_date && (
            <p className="text-sm text-red-500">{errors.start_date}</p>
          )}
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="end_date">Data de Fim</Label>
          <Input
            id="end_date"
            type="date"
            value={formData.end_date}
            onChange={(e) => handleInputChange('end_date', e.target.value)}
            min={`${year}-01-01`}
            max={`${year}-12-31`}
            className={errors.end_date ? 'border-red-500' : ''}
          />
          {errors.end_date && (
            <p className="text-sm text-red-500">{errors.end_date}</p>
          )}
        </div>
      </div>
      
      {workingDays > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Este período inclui <strong>{workingDays} {workingDays === 1 ? 'dia útil' : 'dias úteis'}</strong>.
            Fins de semana não são contabilizados como dias de férias.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="description">Descrição (opcional)</Label>
        <Textarea
          id="description"
          placeholder="Ex: Férias de verão, viagem familiar..."
          value={formData.description}
          onChange={(e) => handleInputChange('description', e.target.value)}
          rows={3}
        />
      </div>
      
      <div className="flex items-center space-x-2">
        <Checkbox
          id="is_approved"
          checked={isApproved}
          onCheckedChange={(checked) => setIsApproved(checked as boolean)}
        />
        <Label htmlFor="is_approved" className="text-sm font-normal">
          Marcar como aprovado
        </Label>
      </div>

      {/* Unit 12a: affects_subsidy */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="affects-subsidy"
          checked={affectsSubsidy}
          onChange={e => setAffectsSubsidy(e.target.checked)}
          className="h-4 w-4"
        />
        <Label htmlFor="affects-subsidy" className="text-sm font-normal">
          Reduz subsídio de férias pro-rata
        </Label>
      </div>

      <div className="flex justify-end space-x-2 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          type="submit" 
          className="w-full"
          disabled={loading}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {vacation ? 'Atualizar' : 'Criar'} Férias
        </Button>
      </div>
    </form>
  );
}