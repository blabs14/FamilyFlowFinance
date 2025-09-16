import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customRender, setupIntegrationTest, typeIntoInput, submitForm, waitForLoadingToFinish } from '../utils/test-utils';
import { createFamilyData, createFamilyMemberData, createMockFamilyService } from '../factories/family-factories';
import { createMockUser, createMockContract } from '../utils/test-utils';
import FamilyDashboard from '../../features/family/FamilyDashboard';
import FamilyMembers from '../../features/family/FamilyMembers';
import FamilyAccounts from '../../features/family/FamilyAccounts';
import FamilySettings from '../../features/family/FamilySettings';

// Mock do serviço de família
const mockFamilyService = createMockFamilyService();

// Mock do router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/family',
  useSearchParams: () => new URLSearchParams(),
}));

// Mock do contexto de autenticação
let mockAuthContext = {
  user: createMockUser(),
  session: null,
  loading: false,
  error: null,
  isAuthenticated: true,
};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => mockAuthContext,
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock do hook de família
let mockFamilyData = {
  family: null,
  members: [],
  loading: false,
  error: null,
  createFamily: vi.fn(),
  addMember: vi.fn(),
  updateMember: vi.fn(),
  removeMember: vi.fn(),
  getFamilyMembers: vi.fn(),
};

vi.mock('@/features/family/hooks/useFamily', () => ({
  useFamily: () => mockFamilyData,
}));

// Mock do hook de contratos
let mockContractsData = {
  contracts: [],
  activeContract: null,
  loading: false,
  error: null,
  createContract: vi.fn(),
  updateContract: vi.fn(),
  deleteContract: vi.fn(),
  setActiveContract: vi.fn(),
};

vi.mock('@/features/family/hooks/useContracts', () => ({
  useContracts: () => mockContractsData,
}));

describe('Fluxo de Gestão Familiar - Integração', () => {
  const testEnv = setupIntegrationTest();
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset dos dados de família
    mockFamilyData = {
      family: null,
      members: [],
      loading: false,
      error: null,
      createFamily: vi.fn(),
      addMember: vi.fn(),
      updateMember: vi.fn(),
      removeMember: vi.fn(),
      getFamilyMembers: vi.fn(),
    };

    // Reset dos dados de contratos
    mockContractsData = {
      contracts: [],
      activeContract: null,
      loading: false,
      error: null,
      createContract: vi.fn(),
      updateContract: vi.fn(),
      deleteContract: vi.fn(),
      setActiveContract: vi.fn(),
    };

    // Reset do contexto de autenticação
    mockAuthContext = {
      user: createMockUser(),
      session: null,
      loading: false,
      error: null,
      isAuthenticated: true,
    };

    // Reset dos mocks
    vi.clearAllMocks();
  });

  describe('Gestão de Família', () => {
    it('deve criar uma nova família', async () => {
      const familyData = createFamilyData();
      
      // Mock da criação bem-sucedida
      mockFamilyData.createFamily = vi.fn().mockResolvedValue({
        success: true,
        data: familyData,
      });

      customRender(<FamilyDashboard />);

      // Verificar se a página está carregada
      expect(screen.getByText(/saldo total/i)).toBeInTheDocument();

      // Clicar no botão para criar família
      const createFamilyButton = screen.getByRole('button', { name: /criar família/i });
      await user.click(createFamilyButton);

      // Preencher o formulário
      const familyNameInput = screen.getByLabelText(/nome da família/i);
      const descriptionInput = screen.getByLabelText(/descrição/i);
      
      await typeIntoInput(familyNameInput, familyData.name);
      await typeIntoInput(descriptionInput, familyData.description || '');

      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /criar/i });
      await user.click(submitButton);

      // Verificar se a criação foi chamada
      await waitFor(() => {
        expect(mockFamilyData.createFamily).toHaveBeenCalledWith({
          name: familyData.name,
          description: familyData.description,
          ownerId: mockAuthContext.user.id,
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/família criada com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve mostrar lista de membros da família', async () => {
      const family = createFamilyData();
      const members = [
        createFamilyMemberData({ name: 'João Silva', role: 'pai' }),
        createFamilyMemberData({ name: 'Maria Silva', role: 'mãe' }),
        createFamilyMemberData({ name: 'Pedro Silva', role: 'filho' }),
      ];

      // Mock dos dados carregados
      mockFamilyData.family = family;
      mockFamilyData.members = members;
      mockFamilyData.loading = false;

      customRender(<FamilyDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se a família é mostrada
      expect(screen.getByText(family.name)).toBeInTheDocument();

      // Verificar se todos os membros são mostrados
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('Maria Silva')).toBeInTheDocument();
      expect(screen.getByText('Pedro Silva')).toBeInTheDocument();

      // Verificar papéis
      expect(screen.getByText(/pai/i)).toBeInTheDocument();
      expect(screen.getByText(/mãe/i)).toBeInTheDocument();
      expect(screen.getByText(/filho/i)).toBeInTheDocument();
    });

    it('deve mostrar estado vazio quando não há família', async () => {
      // Mock sem família
      mockFamilyData.family = null;
      mockFamilyData.members = [];
      mockFamilyData.loading = false;

      customRender(<FamilyDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar mensagem de estado vazio
      expect(screen.getByText(/ainda não tem uma família configurada/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /criar família/i })).toBeInTheDocument();
    });
  });

  describe('Gestão de Membros', () => {
    it('deve adicionar novo membro à família', async () => {
      const family = createFamilyData();
      const newMember = createFamilyMemberData({ name: 'Ana Silva', role: 'filha' });
      
      // Mock da família existente
      mockFamilyData.family = family;
      mockFamilyData.members = [];
      mockFamilyData.addMember = vi.fn().mockResolvedValue({
        success: true,
        data: newMember,
      });

      customRender(<FamilyMembers />);

      // Verificar se a página está carregada
      expect(screen.getByText(/adicionar membro/i)).toBeInTheDocument();

      // Preencher o formulário
      const nameInput = screen.getByLabelText(/nome/i);
      const emailInput = screen.getByLabelText(/email/i);
      const roleSelect = screen.getByLabelText(/papel na família/i);
      const birthDateInput = screen.getByLabelText(/data de nascimento/i);
      
      await typeIntoInput(nameInput, newMember.name);
      await typeIntoInput(emailInput, newMember.email || '');
      await user.selectOptions(roleSelect, newMember.role);
      await typeIntoInput(birthDateInput, '1995-05-15');

      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /adicionar/i });
      await user.click(submitButton);

      // Verificar se a adição foi chamada
      await waitFor(() => {
        expect(mockFamilyData.addMember).toHaveBeenCalledWith({
          name: newMember.name,
          email: newMember.email,
          role: newMember.role,
          birthDate: '1995-05-15',
          familyId: family.id,
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/membro adicionado com sucesso/i)).toBeInTheDocument();
      });

      // Verificar redirecionamento
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/family');
      });
    });

    it('deve validar campos obrigatórios ao adicionar membro', async () => {
      customRender(<FamilyMembers />);

      // Tentar submeter sem preencher campos
      const submitButton = screen.getByRole('button', { name: /adicionar/i });
      await user.click(submitButton);

      // Verificar mensagens de validação
      await waitFor(() => {
        expect(screen.getByText(/nome é obrigatório/i)).toBeInTheDocument();
        expect(screen.getByText(/papel na família é obrigatório/i)).toBeInTheDocument();
      });

      // Verificar que a adição não foi chamada
      expect(mockFamilyData.addMember).not.toHaveBeenCalled();
    });

    it('deve editar informações de um membro', async () => {
      const family = createFamilyData();
      const member = createFamilyMemberData({ name: 'João Silva', role: 'pai' });
      const updatedMember = { ...member, name: 'João Santos Silva', email: 'joao.santos@email.com' };
      
      // Mock dos dados existentes
      mockFamilyData.family = family;
      mockFamilyData.members = [member];
      mockFamilyData.updateMember = vi.fn().mockResolvedValue({
        success: true,
        data: updatedMember,
      });

      customRender(<FamilyMembers />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se os dados do membro são mostrados
      expect(screen.getByDisplayValue(member.name)).toBeInTheDocument();

      // Clicar no botão de editar
      const editButton = screen.getByRole('button', { name: /editar/i });
      await user.click(editButton);

      // Modificar os campos
      const nameInput = screen.getByLabelText(/nome/i);
      const emailInput = screen.getByLabelText(/email/i);
      
      await user.clear(nameInput);
      await typeIntoInput(nameInput, updatedMember.name);
      await typeIntoInput(emailInput, updatedMember.email || '');

      // Submeter as alterações
      const saveButton = screen.getByRole('button', { name: /guardar/i });
      await user.click(saveButton);

      // Verificar se a atualização foi chamada
      await waitFor(() => {
        expect(mockFamilyData.updateMember).toHaveBeenCalledWith(member.id, {
          name: updatedMember.name,
          email: updatedMember.email,
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/membro atualizado com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve remover membro da família', async () => {
      const family = createFamilyData();
      const member = createFamilyMemberData({ name: 'Pedro Silva', role: 'filho' });
      
      // Mock dos dados existentes
      mockFamilyData.family = family;
      mockFamilyData.members = [member];
      mockFamilyData.removeMember = vi.fn().mockResolvedValue({ success: true });

      customRender(<FamilyMembers />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de remover
      const removeButton = screen.getByRole('button', { name: /remover/i });
      await user.click(removeButton);

      // Confirmar remoção no modal
      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(confirmButton);

      // Verificar se a remoção foi chamada
      await waitFor(() => {
        expect(mockFamilyData.removeMember).toHaveBeenCalledWith(member.id);
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/membro removido com sucesso/i)).toBeInTheDocument();
      });

      // Verificar redirecionamento
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/family');
      });
    });
  });

  describe('Gestão de Contratos', () => {
    it('deve criar contrato para membro da família', async () => {
      const family = createFamilyData();
      const member = createFamilyMemberData({ name: 'João Silva', role: 'pai' });
      const contract = createMockContract({ memberId: member.id });
      
      // Mock dos dados existentes
      mockFamilyData.family = family;
      mockFamilyData.members = [member];
      mockContractsData.createContract = vi.fn().mockResolvedValue({
        success: true,
        data: contract,
      });

      customRender(<FamilyMembers />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão para criar contrato
      const createContractButton = screen.getByRole('button', { name: /criar contrato/i });
      await user.click(createContractButton);

      // Preencher o formulário de contrato
      const companyInput = screen.getByLabelText(/empresa/i);
      const positionInput = screen.getByLabelText(/cargo/i);
      const salaryInput = screen.getByLabelText(/salário/i);
      const startDateInput = screen.getByLabelText(/data de início/i);
      
      await typeIntoInput(companyInput, contract.company);
      await typeIntoInput(positionInput, contract.position);
      await typeIntoInput(salaryInput, contract.baseSalary.toString());
      await typeIntoInput(startDateInput, '2024-01-01');

      // Submeter o formulário
      const submitButton = screen.getByRole('button', { name: /criar contrato/i });
      await user.click(submitButton);

      // Verificar se a criação foi chamada
      await waitFor(() => {
        expect(mockContractsData.createContract).toHaveBeenCalledWith({
          memberId: member.id,
          company: contract.company,
          position: contract.position,
          baseSalary: contract.baseSalary,
          startDate: '2024-01-01',
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/contrato criado com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve mostrar lista de contratos do membro', async () => {
      const family = createFamilyData();
      const member = createFamilyMemberData({ name: 'Maria Silva', role: 'mãe' });
      const contracts = [
        createMockContract({ 
          memberId: member.id, 
          company: 'Empresa A', 
          position: 'Gestora',
          isActive: true 
        }),
        createMockContract({ 
          memberId: member.id, 
          company: 'Empresa B', 
          position: 'Analista',
          isActive: false 
        }),
      ];
      
      // Mock dos dados existentes
      mockFamilyData.family = family;
      mockFamilyData.members = [member];
      mockContractsData.contracts = contracts;

      customRender(<FamilyMembers />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se os contratos são mostrados
      expect(screen.getByText('Empresa A')).toBeInTheDocument();
      expect(screen.getByText('Empresa B')).toBeInTheDocument();
      expect(screen.getByText('Gestora')).toBeInTheDocument();
      expect(screen.getByText('Analista')).toBeInTheDocument();

      // Verificar indicação de contrato ativo
      expect(screen.getByText(/ativo/i)).toBeInTheDocument();
      expect(screen.getByText(/inativo/i)).toBeInTheDocument();
    });

    it('deve definir contrato como ativo', async () => {
      const family = createFamilyData();
      const member = createFamilyMemberData({ name: 'João Silva', role: 'pai' });
      const contract = createMockContract({ 
        memberId: member.id, 
        company: 'Nova Empresa',
        isActive: false 
      });
      
      // Mock dos dados existentes
      mockFamilyData.family = family;
      mockFamilyData.members = [member];
      mockContractsData.contracts = [contract];
      mockContractsData.setActiveContract = vi.fn().mockResolvedValue({ success: true });

      customRender(<FamilyMembers />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão para ativar contrato
      const activateButton = screen.getByRole('button', { name: /ativar contrato/i });
      await user.click(activateButton);

      // Verificar se a ativação foi chamada
      await waitFor(() => {
        expect(mockContractsData.setActiveContract).toHaveBeenCalledWith(contract.id);
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/contrato ativado com sucesso/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integração entre Funcionalidades', () => {
    it('deve mostrar estatísticas da família no dashboard', async () => {
      const family = createFamilyData();
      const members = [
        createFamilyMemberData({ name: 'João Silva', role: 'pai' }),
        createFamilyMemberData({ name: 'Maria Silva', role: 'mãe' }),
        createFamilyMemberData({ name: 'Pedro Silva', role: 'filho' }),
      ];
      const contracts = [
        createMockContract({ memberId: members[0].id, isActive: true }),
        createMockContract({ memberId: members[1].id, isActive: true }),
      ];
      
      // Mock dos dados carregados
      mockFamilyData.family = family;
      mockFamilyData.members = members;
      mockContractsData.contracts = contracts;

      customRender(<FamilyDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar estatísticas
      expect(screen.getByText(/3.*membros/i)).toBeInTheDocument();
      expect(screen.getByText(/2.*contratos ativos/i)).toBeInTheDocument();
      expect(screen.getByText(/1.*membro sem contrato/i)).toBeInTheDocument();
    });

    it('deve navegar entre páginas de gestão familiar', async () => {
      const family = createFamilyData();
      const member = createFamilyMemberData({ name: 'João Silva', role: 'pai' });
      
      // Mock dos dados existentes
      mockFamilyData.family = family;
      mockFamilyData.members = [member];

      customRender(<FamilyDashboard />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no membro para ver detalhes
      const memberCard = screen.getByText('João Silva').closest('div') || 
                        screen.getByTestId(`member-${member.id}`);
      await user.click(memberCard);

      // Verificar navegação para detalhes
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(`/family/member/${member.id}`);
      });
    });

    it('deve sincronizar dados após operações CRUD', async () => {
      const family = createFamilyData();
      const newMember = createFamilyMemberData({ name: 'Ana Silva', role: 'filha' });
      
      // Mock da família existente
      mockFamilyData.family = family;
      mockFamilyData.members = [];
      mockFamilyData.addMember = vi.fn().mockResolvedValue({
        success: true,
        data: newMember,
      });
      mockFamilyData.getFamilyMembers = vi.fn().mockResolvedValue([newMember]);

      customRender(<FamilyMembers />);

      // Adicionar novo membro
      const nameInput = screen.getByLabelText(/nome/i);
      const roleSelect = screen.getByLabelText(/papel na família/i);
      
      await typeIntoInput(nameInput, newMember.name);
      await user.selectOptions(roleSelect, newMember.role);

      const submitButton = screen.getByRole('button', { name: /adicionar/i });
      await user.click(submitButton);

      // Verificar se os dados foram sincronizados
      await waitFor(() => {
        expect(mockFamilyData.addMember).toHaveBeenCalled();
        expect(mockFamilyData.getFamilyMembers).toHaveBeenCalled();
      });
    });
  });
});