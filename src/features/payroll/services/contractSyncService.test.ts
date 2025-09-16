import { describe, it, expect, vi, beforeEach } from 'vitest';
import { contractSyncService } from './contractSyncService';
import { supabase } from '@/lib/supabaseClient';
import { holidayAutoService } from './holidayAutoService';
import { payrollService } from './payrollService';
import { logger } from '@/shared/lib/logger';

// Mock das dependências
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        }))
      })),
      insert: vi.fn(() => ({
        error: null
      }))
    }))
  }
}));

vi.mock('./holidayAutoService', () => ({
  holidayAutoService: {
    syncHolidaysForContract: vi.fn()
  }
}));

vi.mock('@/shared/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}));

vi.mock('./payrollService', () => ({
  payrollService: {
    getContract: vi.fn()
  }
}));

describe('contractSyncService', () => {
  const mockContractId = '550e8400-e29b-41d4-a716-446655440000';
  const mockUserId = '550e8400-e29b-41d4-a716-446655440001';
  const mockContract = {
    id: mockContractId,
    user_id: mockUserId,
    name: 'Contrato Teste',
    base_salary_cents: 100000,
    workplace_location: 'Lisboa'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('syncAllContractParameters', () => {
    it('deve sincronizar todos os parâmetros com sucesso', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockContract, error: null })
          }))
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);
      (payrollService.getContract as any).mockResolvedValue(mockContract);
      (holidayAutoService.syncHolidaysForContract as any).mockResolvedValue(undefined);

      // Act
      await contractSyncService.syncAllContractParameters(mockContractId, mockUserId);

      // Assert
      expect(payrollService.getContract).toHaveBeenCalledWith(mockContractId, mockUserId);
      expect(holidayAutoService.syncHolidaysForContract).toHaveBeenCalledWith(mockContractId);
      expect(supabase.from).toHaveBeenCalledWith('payroll_ot_policies');
      expect(supabase.from).toHaveBeenCalledWith('payroll_deduction_configs');
      expect(supabase.from).toHaveBeenCalledWith('payroll_meal_allowance_configs');
      expect(supabase.from).toHaveBeenCalledWith('payroll_deduction_conditions');
      expect(logger.info).toHaveBeenCalledWith(
        'Sincronização completa de parâmetros do contrato concluída',
        { contractId: mockContractId, userId: mockUserId }
      );
    });

    it('deve falhar se o contrato não for encontrado', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        }))
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);
      (payrollService.getContract as any).mockResolvedValue(null);

      // Act & Assert
      await expect(
        contractSyncService.syncAllContractParameters(mockContractId, mockUserId)
      ).rejects.toThrow(`Contrato ${mockContractId} não encontrado`);
    });

    it('deve continuar mesmo se a sincronização de feriados falhar', async () => {
      // Arrange
      const mockContractWithoutLocation = { 
        ...mockContract, 
        workplace_location: null 
      };
      const mockSupabaseChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: mockContractWithoutLocation, error: null })
          }))
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);
      (payrollService.getContract as any).mockResolvedValue(mockContractWithoutLocation);

      // Act
      await contractSyncService.syncAllContractParameters(mockContractId, mockUserId);

      // Assert
      expect(holidayAutoService.syncHolidaysForContract).not.toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith(
        'Sincronização completa de parâmetros do contrato concluída',
        { contractId: mockContractId, userId: mockUserId }
      );
    });
  });

  describe('createDefaultOTPolicy', () => {
    it('deve criar política de horas extras padrão', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      // Act
      await contractSyncService.createDefaultOTPolicy(mockContractId, mockUserId);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('payroll_ot_policies');
      expect(mockSupabaseChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          contract_id: mockContractId,
          name: 'Política Padrão',
          threshold_hours: 8,
          multiplier: 1.5
        })
      );
    });

    it('não deve criar se já existir uma política', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: { id: 'existing-policy' }, error: null })
          }))
        })),
        insert: vi.fn()
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      // Act
      await contractSyncService.createDefaultOTPolicy(mockContractId, mockUserId);

      // Assert
      expect(mockSupabaseChain.insert).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        'Política de horas extras já existe para o contrato',
        { contractId: mockContractId }
      );
    });
  });

  describe('createDefaultDeductionConfig', () => {
    it('deve criar configurações de descontos padrão', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      // Act
      await contractSyncService.createDefaultDeductionConfig(mockContractId, mockUserId);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('payroll_deduction_configs');
      expect(mockSupabaseChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          contract_id: mockContractId,
          irs_percentage: 0,
          social_security_percentage: 11
        })
      );
    });
  });

  describe('createDefaultMealAllowanceConfig', () => {
    it('deve criar configuração de subsídio de alimentação padrão', async () => {
      // Arrange
      const mockSupabaseChain = {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn().mockResolvedValue({ data: null, error: null })
          }))
        })),
        insert: vi.fn().mockResolvedValue({ error: null })
      };
      
      (supabase.from as any).mockReturnValue(mockSupabaseChain);

      // Act
      await contractSyncService.createDefaultMealAllowanceConfig(mockContractId, mockUserId);

      // Assert
      expect(supabase.from).toHaveBeenCalledWith('payroll_meal_allowance_configs');
      expect(mockSupabaseChain.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: mockUserId,
          contract_id: mockContractId,
          daily_amount_cents: 760 // €7.60
        })
      );
    });
  });
});