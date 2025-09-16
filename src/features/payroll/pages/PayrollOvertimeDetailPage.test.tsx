import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import PayrollOvertimeDetailPage from './PayrollOvertimeDetailPage';
import { payrollService } from '../services/payrollService';
import type { TimesheetEntry, PayrollOTPolicy, PayrollHoliday, PayrollContract } from '../types';
import { ActiveContractProvider } from '../contexts/ActiveContractContext';
import { AuthProvider } from '../../../contexts/AuthContext';

// Mock all the services
vi.mock('../services/payrollService', () => ({
  payrollService: {
    getTimeEntries: vi.fn(),
    getActiveContract: vi.fn(),
    getActiveOTPolicy: vi.fn(),
    getHolidays: vi.fn()
  }
}));
vi.mock('../services/overtimeExtraction.service');
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('userId=user1'),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/payroll/overtime-detail'
}));
vi.mock('../../../contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: () => ({ user: { id: 'user1' } })
}));
vi.mock('../contexts/ActiveContractContext', () => {
  const mockContext = {
    activeContract: { id: 'contract1', name: 'Test Contract' },
    contracts: [],
    loading: false,
    setActiveContract: vi.fn(),
    refreshContracts: vi.fn()
  };
  
  return {
    ActiveContractContext: {
      Provider: ({ children }: { children: React.ReactNode }) => children,
      Consumer: ({ children }: { children: any }) => children(mockContext)
    },
    ActiveContractProvider: ({ children }: { children: React.ReactNode }) => children
  };
});
vi.mock('../hooks/useActiveContract', () => ({
  useActiveContract: () => ({
    activeContract: { id: 'contract1', name: 'Test Contract' },
    contracts: [],
    loading: false,
    setActiveContract: vi.fn(),
    refreshContracts: vi.fn()
  })
}));

// Mock file download
Object.defineProperty(window, 'URL', {
  value: {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn()
  }
});

const originalCreateElement = document.createElement.bind(document);
vi.spyOn(document, 'createElement').mockImplementation((tagName: any) => {
  const el = originalCreateElement(tagName as any) as any;
  if (tagName === 'a') {
    try {
      el.click = vi.fn();
    } catch {
      Object.defineProperty(el, 'click', { value: vi.fn() });
    }
  }
  return el;
});

const mockPayrollService = payrollService as any;

describe('PayrollOvertimeDetailPage', () => {
  let queryClient: QueryClient;
  let mockContract: PayrollContract;
  let mockOTPolicy: PayrollOTPolicy;
  let mockHolidays: PayrollHoliday[];
  let mockTimesheetEntries: TimesheetEntry[];

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false }
      }
    });

    mockContract = {
      id: 'contract1',
      user_id: 'user1',
      position: 'Software Engineer',
      salary_cents: 300000,
      hourly_rate_cents: 1500, // €15/hour
      start_date: '2024-01-01',
      end_date: null,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockOTPolicy = {
      id: 'ot1',
      user_id: 'user1',
      name: 'Standard Policy',
      threshold_hours: 8,
      multiplier: 1.5,
      night_start_time: '22:00',
      night_end_time: '06:00',
      night_multiplier: 2.0,
      weekend_multiplier: 2.0,
      holiday_multiplier: 2.5,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    mockHolidays = [
      {
        id: 'h1',
        user_id: 'user1',
        name: 'Natal',
        date: '2024-12-25',
        holiday_type: 'national',
        is_recurring: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'h2',
        user_id: 'user1',
        name: 'Ano Novo',
        date: '2024-01-01',
        holiday_type: 'national',
        is_recurring: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];

    mockTimesheetEntries = [
      // Regular weekday with overtime
      {
        date: '2024-01-15', // Monday
        startTime: '09:00',
        endTime: '19:00', // 10 hours = 2 hours overtime
        breakMinutes: 60,
        isHoliday: false,
        isVacation: false,
        isLeave: false
      },
      // Weekend work
      {
        date: '2024-01-13', // Saturday
        startTime: '10:00',
        endTime: '16:00', // 6 hours weekend work
        breakMinutes: 0,
        isHoliday: false,
        isVacation: false,
        isLeave: false
      },
      // Night shift
      {
        date: '2024-01-16', // Tuesday
        startTime: '20:00',
        endTime: '04:00', // 8 hours, all night
        breakMinutes: 60,
        isHoliday: false,
        isVacation: false,
        isLeave: false
      },
      // Holiday work
      {
        date: '2024-01-01', // New Year's Day
        startTime: '12:00',
        endTime: '16:00', // 4 hours holiday work
        breakMinutes: 0,
        isHoliday: true,
        isVacation: false,
        isLeave: false
      },
      // Regular 8-hour day (no overtime)
      {
        date: '2024-01-17', // Wednesday
        startTime: '09:00',
        endTime: '17:00',
        breakMinutes: 60,
        isHoliday: false,
        isVacation: false,
        isLeave: false
      }
    ];

    // Setup default mocks
    mockPayrollService.getActiveContract = vi.fn().mockResolvedValue(mockContract);
    mockPayrollService.getActiveOTPolicy = vi.fn().mockResolvedValue(mockOTPolicy);
    mockPayrollService.getHolidays = vi.fn().mockResolvedValue(mockHolidays);
    mockPayrollService.getTimeEntries = vi.fn().mockResolvedValue(mockTimesheetEntries.map(entry => ({
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      break_minutes: entry.breakMinutes,
      description: entry.description || ''
    })));
  });

  const renderComponent = () => {
    return render(
      <AuthProvider>
        <ActiveContractProvider>
          <QueryClientProvider client={queryClient}>
            <PayrollOvertimeDetailPage />
          </QueryClientProvider>
        </ActiveContractProvider>
      </AuthProvider>
    );
  };

  describe('Data Loading and Display', () => {
    it('should load and display overtime statistics correctly', async () => {
      renderComponent();

      await waitFor(() => {
        // Check total overtime hours (2 + 6 + 7 + 4 = 19 hours)
        expect(screen.getByText('19h')).toBeInTheDocument();
        
        // Check total overtime pay
        expect(screen.getByText(/€[0-9,]+\.[0-9]{2}/)).toBeInTheDocument();
        
        // Check breakdown by type
        expect(screen.getByText('2h')).toBeInTheDocument(); // Day overtime
        expect(screen.getByText('7h')).toBeInTheDocument(); // Night overtime
        expect(screen.getByText('6h')).toBeInTheDocument(); // Weekend overtime
        expect(screen.getByText('4h')).toBeInTheDocument(); // Holiday overtime
      });
    });

    it('should display timesheet entries with correct overtime indicators', async () => {
      renderComponent();

      await waitFor(() => {
        // Should show all timesheet entries
        expect(screen.getByText('15/01/2024')).toBeInTheDocument(); // Monday
        expect(screen.getByText('13/01/2024')).toBeInTheDocument(); // Saturday
        expect(screen.getByText('16/01/2024')).toBeInTheDocument(); // Tuesday night
        expect(screen.getByText('01/01/2024')).toBeInTheDocument(); // New Year
        expect(screen.getByText('17/01/2024')).toBeInTheDocument(); // Regular day
      });

      // Check overtime badges
      expect(screen.getByText('Horas Extras')).toBeInTheDocument();
      expect(screen.getByText('Fim de Semana')).toBeInTheDocument();
      expect(screen.getByText('Noturno')).toBeInTheDocument();
      expect(screen.getByText('Feriado')).toBeInTheDocument();
    });

    it('should show loading state initially', () => {
      renderComponent();
      
      expect(screen.getByText(/carregando/i)).toBeInTheDocument();
    });

    it('should handle empty timesheet gracefully', async () => {
      mockPayrollService.getTimeEntries = vi.fn().mockResolvedValue([]);
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/nenhuma entrada encontrada/i)).toBeInTheDocument();
        expect(screen.getByText('0h')).toBeInTheDocument(); // Total overtime hours
        expect(screen.getByText('€0.00')).toBeInTheDocument(); // Total overtime pay
      });
    });
  });

  describe('Filtering and Sorting', () => {
    it('should filter entries by overtime type', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/2024/)).toHaveLength(5); // All entries visible
      });

      // Filter by weekend overtime
      const weekendFilter = screen.getByRole('button', { name: /fim de semana/i });
      fireEvent.click(weekendFilter);

      await waitFor(() => {
        expect(screen.getByText('13/01/2024')).toBeInTheDocument(); // Saturday
        expect(screen.queryByText('15/01/2024')).not.toBeInTheDocument(); // Monday should be hidden
      });
    });

    it('should filter entries by date range', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getAllByText(/2024/)).toHaveLength(5);
      });

      // Set date range filter
      const startDateInput = screen.getByLabelText(/data início/i);
      const endDateInput = screen.getByLabelText(/data fim/i);
      
      fireEvent.change(startDateInput, { target: { value: '2024-01-15' } });
      fireEvent.change(endDateInput, { target: { value: '2024-01-17' } });

      await waitFor(() => {
        expect(screen.getByText('15/01/2024')).toBeInTheDocument();
        expect(screen.getByText('16/01/2024')).toBeInTheDocument();
        expect(screen.getByText('17/01/2024')).toBeInTheDocument();
        expect(screen.queryByText('13/01/2024')).not.toBeInTheDocument(); // Saturday should be hidden
        expect(screen.queryByText('01/01/2024')).not.toBeInTheDocument(); // New Year should be hidden
      });
    });

    it('should sort entries by date', async () => {
      renderComponent();

      await waitFor(() => {
        const dateElements = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/);
        expect(dateElements).toHaveLength(5);
      });

      // Click sort button
      const sortButton = screen.getByRole('button', { name: /ordenar/i });
      fireEvent.click(sortButton);

      // Verify sorting (implementation would depend on actual sort logic)
      await waitFor(() => {
        const dateElements = screen.getAllByText(/\d{2}\/\d{2}\/\d{4}/);
        expect(dateElements[0]).toHaveTextContent('01/01/2024'); // Should be first chronologically
      });
    });
  });

  describe('Export Functionality', () => {
    it('should export overtime data to CSV', async () => {
      const mockCreateElement = vi.fn();
      const mockAnchor = {
        href: '',
        download: '',
        click: vi.fn(),
        style: {}
      };
      
      mockCreateElement.mockReturnValue(mockAnchor);
      document.createElement = mockCreateElement;

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('19h')).toBeInTheDocument();
      });

      // Click export button
      const exportButton = screen.getByRole('button', { name: /exportar csv/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateElement).toHaveBeenCalledWith('a');
        expect(mockAnchor.click).toHaveBeenCalled();
        expect(mockAnchor.download).toContain('.csv');
      });
    });

    it('should include correct data in CSV export', async () => {
      let csvContent = '';
      const mockCreateObjectURL = vi.fn((blob) => {
        // Read the blob content
        const reader = new FileReader();
        reader.onload = () => {
          csvContent = reader.result as string;
        };
        reader.readAsText(blob);
        return 'blob:mock-url';
      });
      
      window.URL.createObjectURL = mockCreateObjectURL;

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText('19h')).toBeInTheDocument();
      });

      const exportButton = screen.getByRole('button', { name: /exportar csv/i });
      fireEvent.click(exportButton);

      await waitFor(() => {
        expect(mockCreateObjectURL).toHaveBeenCalled();
      });

      // Verify CSV headers and content structure
      expect(csvContent).toContain('Data,Início,Fim,Horas Trabalhadas,Tipo Horas Extras,Valor');
      expect(csvContent).toContain('15/01/2024');
      expect(csvContent).toContain('13/01/2024');
    });
  });

  describe('Error Handling', () => {
    it('should handle timesheet loading errors', async () => {
      mockPayrollService.getTimeEntries = vi.fn().mockRejectedValue(new Error('Failed to load timesheet'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/erro ao carregar dados/i)).toBeInTheDocument();
      });
    });

    it('should handle overtime policy loading errors', async () => {
      mockPayrollService.getActiveOTPolicy.mockRejectedValue(new Error('Failed to load policy'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/erro ao carregar política/i)).toBeInTheDocument();
      });
    });

    it('should handle contract loading errors', async () => {
      mockPayrollService.getActiveContract.mockRejectedValue(new Error('Failed to load contract'));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/erro ao carregar contrato/i)).toBeInTheDocument();
      });
    });

    it('should show validation warnings for problematic entries', async () => {
      const problematicEntries: TimesheetEntry[] = [
        {
          date: '2024-01-15',
          startTime: undefined, // Missing start time
          endTime: '17:00',
          breakMinutes: 60,
          isHoliday: false,
          isVacation: false,
          isLeave: false
        },
        {
          date: '2024-01-16',
          startTime: '09:00',
          endTime: '17:00',
          breakMinutes: 60,
          isHoliday: false,
          isVacation: true, // Vacation with hours
          isLeave: false
        }
      ];

      mockPayrollService.getTimeEntries = vi.fn().mockResolvedValue(problematicEntries.map(entry => ({
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      break_minutes: entry.breakMinutes,
      description: entry.description || ''
    })));
      
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/avisos de validação/i)).toBeInTheDocument();
        expect(screen.getByText(/horário de início em falta/i)).toBeInTheDocument();
        expect(screen.getByText(/dia de férias mas tem registo de horas/i)).toBeInTheDocument();
      });
    });
  });

  describe('Responsive Design', () => {
    it('should adapt layout for mobile screens', async () => {
      // Mock mobile viewport
      Object.defineProperty(window, 'innerWidth', {
        writable: true,
        configurable: true,
        value: 375
      });
      
      renderComponent();

      await waitFor(() => {
        // Check that mobile-specific classes are applied
        const container = screen.getByRole('main');
        expect(container).toHaveClass('px-4'); // Mobile padding
      });
    });

    it('should show condensed view on smaller screens', async () => {
      renderComponent();

      await waitFor(() => {
        // On mobile, some details might be hidden or condensed
        const detailsButton = screen.queryByRole('button', { name: /ver detalhes/i });
        expect(detailsButton).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels and roles', async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByRole('main')).toBeInTheDocument();
        expect(screen.getByRole('table')).toBeInTheDocument();
        expect(screen.getByLabelText(/total de horas extras/i)).toBeInTheDocument();
      });
    });

    it('should support keyboard navigation', async () => {
      renderComponent();

      await waitFor(() => {
        const exportButton = screen.getByRole('button', { name: /exportar csv/i });
        exportButton.focus();
        expect(document.activeElement).toBe(exportButton);
      });
    });

    it('should announce data updates to screen readers', async () => {
      renderComponent();

      await waitFor(() => {
        const liveRegion = screen.getByRole('status');
        expect(liveRegion).toHaveTextContent(/dados de horas extras carregados/i);
      });
    });
  });

  describe('Performance', () => {
    it('should handle large datasets efficiently', async () => {
      // Generate large dataset
      const largeDataset: TimesheetEntry[] = [];
      for (let i = 1; i <= 1000; i++) {
        largeDataset.push({
          date: `2024-01-${(i % 31 + 1).toString().padStart(2, '0')}`,
          startTime: '09:00',
          endTime: '19:00', // 10 hours each
          breakMinutes: 60,
          isHoliday: false,
          isVacation: false,
          isLeave: false
        });
      }

      mockPayrollService.getTimeEntries = vi.fn().mockResolvedValue(largeDataset.map(entry => ({
      date: entry.date,
      start_time: entry.startTime,
      end_time: entry.endTime,
      break_minutes: entry.breakMinutes,
      description: entry.description || ''
    })));
      
      const startTime = performance.now();
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText(/h$/)).toBeInTheDocument(); // Some hours display
      });
      const endTime = performance.now();

      // Should complete in reasonable time
      expect(endTime - startTime).toBeLessThan(2000);
    });

    it('should virtualize large tables', async () => {
      // This would test virtual scrolling implementation
      // For now, just verify that not all entries are rendered at once
      const largeDataset: TimesheetEntry[] = [];
      for (let i = 1; i <= 100; i++) {
        largeDataset.push({
          date: `2024-01-${(i % 31 + 1).toString().padStart(2, '0')}`,
          startTime: '09:00',
          endTime: '19:00',
          breakMinutes: 60,
          isHoliday: false,
          isVacation: false,
          isLeave: false
        });
      }

      mockPayrollService.getTimeEntries = vi.fn().mockResolvedValue(largeDataset.map(entry => ({
        date: entry.date,
        start_time: entry.startTime,
        end_time: entry.endTime,
        break_minutes: entry.breakMinutes,
        description: entry.description || ''
      })));
      
      renderComponent();

      await waitFor(() => {
        const tableRows = screen.getAllByRole('row');
        // Should not render all 100 rows at once (plus header)
        expect(tableRows.length).toBeLessThan(50);
      });
    });
  });
});