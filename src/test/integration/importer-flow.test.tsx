import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { customRender, setupIntegrationTest, typeIntoInput, submitForm, waitForLoadingToFinish } from '../utils/test-utils';
import { 
  createImportFileData, 
  createImportJobData, 
  createImportMappingData,
  createMockImporterService,
  IMPORT_STATES,
  IMPORT_ERROR_TYPES
} from '../factories/importer-factories';
import { createMockUser } from '../utils/test-utils';
import ImporterPage from '@/features/importer/components/ImporterPage';
import FileUploadPage from '@/features/importer/components/FileUploadPage';
import MappingPage from '@/features/importer/components/MappingPage';
import ImportProgressPage from '@/features/importer/components/ImportProgressPage';

// Mock do serviço de importação
const mockImporterService = createMockImporterService();

// Mock do router
const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  refresh: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
  usePathname: () => '/importer',
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

// Mock do hook de importação
let mockImporterData = {
  files: [],
  jobs: [],
  currentJob: null,
  loading: false,
  error: null,
  uploadFile: vi.fn(),
  createMapping: vi.fn(),
  startImport: vi.fn(),
  getImportProgress: vi.fn(),
  cancelImport: vi.fn(),
  deleteFile: vi.fn(),
  getImportHistory: vi.fn(),
};

vi.mock('@/features/importer/hooks/useImporter', () => ({
  useImporter: () => mockImporterData,
}));

// Mock do File API
const createMockFile = (name: string, content: string, type: string = 'text/csv') => {
  const file = new File([content], name, { type });
  Object.defineProperty(file, 'size', { value: content.length });
  return file;
};

// Mock do FileReader
class MockFileReader {
  result: string | null = null;
  onload: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  
  readAsText(file: File) {
    setTimeout(() => {
      this.result = 'Nome,Email,Salário\nJoão Silva,joao@email.com,2500\nMaria Santos,maria@email.com,3000';
      if (this.onload) {
        this.onload({ target: { result: this.result } });
      }
    }, 100);
  }
}

global.FileReader = MockFileReader as any;

describe('Fluxo de Importação de Dados - Integração', () => {
  const testEnv = setupIntegrationTest();
  const user = userEvent.setup();

  beforeEach(() => {
    // Reset dos dados de importação
    mockImporterData = {
      files: [],
      jobs: [],
      currentJob: null,
      loading: false,
      error: null,
      uploadFile: vi.fn(),
      createMapping: vi.fn(),
      startImport: vi.fn(),
      getImportProgress: vi.fn(),
      cancelImport: vi.fn(),
      deleteFile: vi.fn(),
      getImportHistory: vi.fn(),
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

  describe('Upload de Ficheiros', () => {
    it('deve fazer upload de ficheiro CSV', async () => {
      const csvContent = 'Nome,Email,Salário\nJoão Silva,joao@email.com,2500\nMaria Santos,maria@email.com,3000';
      const file = createMockFile('funcionarios.csv', csvContent);
      const uploadedFile = createImportFileData({
        name: 'funcionarios.csv',
        size: csvContent.length,
        type: 'text/csv',
      });
      
      // Mock do upload bem-sucedido
      mockImporterData.uploadFile = vi.fn().mockResolvedValue({
        success: true,
        data: uploadedFile,
      });

      customRender(<FileUploadPage />);

      // Verificar se a página está carregada
      expect(screen.getByText(/upload de ficheiro/i)).toBeInTheDocument();

      // Simular drag and drop
      const dropZone = screen.getByTestId('file-drop-zone');
      
      // Criar evento de drop
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [file],
          types: ['Files'],
        },
      });

      // Fazer drop do ficheiro
      dropZone.dispatchEvent(dropEvent);

      // Aguardar processamento
      await waitFor(() => {
        expect(mockImporterData.uploadFile).toHaveBeenCalledWith(file);
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/ficheiro carregado com sucesso/i)).toBeInTheDocument();
      });

      // Verificar informações do ficheiro
      expect(screen.getByText('funcionarios.csv')).toBeInTheDocument();
      expect(screen.getByText(/2.*registos/i)).toBeInTheDocument();
    });

    it('deve validar tipo de ficheiro', async () => {
      const invalidFile = createMockFile('documento.pdf', 'conteúdo pdf', 'application/pdf');
      
      customRender(<FileUploadPage />);

      // Tentar fazer upload de ficheiro inválido
      const fileInput = screen.getByLabelText(/selecionar ficheiro/i);
      
      // Simular seleção de ficheiro
      Object.defineProperty(fileInput, 'files', {
        value: [invalidFile],
        writable: false,
      });
      
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Verificar mensagem de erro
      await waitFor(() => {
        expect(screen.getByText(/tipo de ficheiro não suportado/i)).toBeInTheDocument();
      });

      // Verificar que o upload não foi chamado
      expect(mockImporterData.uploadFile).not.toHaveBeenCalled();
    });

    it('deve validar tamanho do ficheiro', async () => {
      const largeContent = 'A'.repeat(10 * 1024 * 1024); // 10MB
      const largeFile = createMockFile('ficheiro_grande.csv', largeContent);
      
      customRender(<FileUploadPage />);

      // Tentar fazer upload de ficheiro muito grande
      const dropZone = screen.getByTestId('file-drop-zone');
      
      const dropEvent = new Event('drop', { bubbles: true });
      Object.defineProperty(dropEvent, 'dataTransfer', {
        value: {
          files: [largeFile],
          types: ['Files'],
        },
      });

      dropZone.dispatchEvent(dropEvent);

      // Verificar mensagem de erro
      await waitFor(() => {
        expect(screen.getByText(/ficheiro muito grande/i)).toBeInTheDocument();
      });

      // Verificar que o upload não foi chamado
      expect(mockImporterData.uploadFile).not.toHaveBeenCalled();
    });

    it('deve mostrar progresso durante upload', async () => {
      const file = createMockFile('dados.csv', 'Nome,Valor\nTeste,123');
      
      // Mock do upload com progresso
      let uploadProgress = 0;
      mockImporterData.uploadFile = vi.fn().mockImplementation(() => {
        return new Promise((resolve) => {
          const interval = setInterval(() => {
            uploadProgress += 25;
            if (uploadProgress >= 100) {
              clearInterval(interval);
              resolve({
                success: true,
                data: createImportFileData({ name: 'dados.csv' }),
              });
            }
          }, 100);
        });
      });

      customRender(<FileUploadPage />);

      // Fazer upload
      const fileInput = screen.getByLabelText(/selecionar ficheiro/i);
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Verificar barra de progresso
      await waitFor(() => {
        expect(screen.getByRole('progressbar')).toBeInTheDocument();
      });

      // Aguardar conclusão
      await waitFor(() => {
        expect(screen.getByText(/ficheiro carregado com sucesso/i)).toBeInTheDocument();
      }, { timeout: 2000 });
    });
  });

  describe('Mapeamento de Campos', () => {
    it('deve criar mapeamento de campos', async () => {
      const file = createImportFileData({
        name: 'funcionarios.csv',
        headers: ['Nome', 'Email', 'Salário'],
      });
      const mapping = createImportMappingData({
        fileId: file.id,
        mappings: {
          'Nome': 'name',
          'Email': 'email',
          'Salário': 'salary',
        },
      });
      
      // Mock dos dados existentes
      mockImporterData.files = [file];
      mockImporterData.createMapping = vi.fn().mockResolvedValue({
        success: true,
        data: mapping,
      });

      customRender(<MappingPage fileId={file.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se os cabeçalhos são mostrados
      expect(screen.getByText('Nome')).toBeInTheDocument();
      expect(screen.getByText('Email')).toBeInTheDocument();
      expect(screen.getByText('Salário')).toBeInTheDocument();

      // Mapear campos
      const nameSelect = screen.getByTestId('mapping-Nome');
      const emailSelect = screen.getByTestId('mapping-Email');
      const salarySelect = screen.getByTestId('mapping-Salário');
      
      await user.selectOptions(nameSelect, 'name');
      await user.selectOptions(emailSelect, 'email');
      await user.selectOptions(salarySelect, 'salary');

      // Submeter mapeamento
      const submitButton = screen.getByRole('button', { name: /criar mapeamento/i });
      await user.click(submitButton);

      // Verificar se o mapeamento foi criado
      await waitFor(() => {
        expect(mockImporterData.createMapping).toHaveBeenCalledWith({
          fileId: file.id,
          mappings: {
            'Nome': 'name',
            'Email': 'email',
            'Salário': 'salary',
          },
        });
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/mapeamento criado com sucesso/i)).toBeInTheDocument();
      });
    });

    it('deve validar mapeamentos obrigatórios', async () => {
      const file = createImportFileData({
        name: 'funcionarios.csv',
        headers: ['Nome', 'Email', 'Salário'],
      });
      
      mockImporterData.files = [file];

      customRender(<MappingPage fileId={file.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Tentar submeter sem mapear campos obrigatórios
      const submitButton = screen.getByRole('button', { name: /criar mapeamento/i });
      await user.click(submitButton);

      // Verificar mensagens de validação
      await waitFor(() => {
        expect(screen.getByText(/campo nome é obrigatório/i)).toBeInTheDocument();
      });

      // Verificar que o mapeamento não foi criado
      expect(mockImporterData.createMapping).not.toHaveBeenCalled();
    });

    it('deve mostrar pré-visualização dos dados', async () => {
      const file = createImportFileData({
        name: 'funcionarios.csv',
        headers: ['Nome', 'Email', 'Salário'],
        preview: [
          { 'Nome': 'João Silva', 'Email': 'joao@email.com', 'Salário': '2500' },
          { 'Nome': 'Maria Santos', 'Email': 'maria@email.com', 'Salário': '3000' },
        ],
      });
      
      mockImporterData.files = [file];

      customRender(<MappingPage fileId={file.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar pré-visualização
      expect(screen.getByText('João Silva')).toBeInTheDocument();
      expect(screen.getByText('joao@email.com')).toBeInTheDocument();
      expect(screen.getByText('2500')).toBeInTheDocument();
      expect(screen.getByText('Maria Santos')).toBeInTheDocument();
      expect(screen.getByText('maria@email.com')).toBeInTheDocument();
      expect(screen.getByText('3000')).toBeInTheDocument();
    });

    it('deve detectar mapeamentos automáticos', async () => {
      const file = createImportFileData({
        name: 'funcionarios.csv',
        headers: ['name', 'email', 'salary'], // Headers que correspondem aos campos
      });
      
      mockImporterData.files = [file];

      customRender(<MappingPage fileId={file.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se os mapeamentos automáticos foram aplicados
      const nameSelect = screen.getByTestId('mapping-name');
      const emailSelect = screen.getByTestId('mapping-email');
      const salarySelect = screen.getByTestId('mapping-salary');
      
      expect(nameSelect).toHaveValue('name');
      expect(emailSelect).toHaveValue('email');
      expect(salarySelect).toHaveValue('salary');

      // Verificar mensagem de detecção automática
      expect(screen.getByText(/mapeamentos detectados automaticamente/i)).toBeInTheDocument();
    });
  });

  describe('Processamento de Importação', () => {
    it('deve iniciar importação com sucesso', async () => {
      const file = createImportFileData({ name: 'funcionarios.csv' });
      const mapping = createImportMappingData({ fileId: file.id });
      const job = createImportJobData({
        fileId: file.id,
        mappingId: mapping.id,
        status: IMPORT_STATES.PENDING,
      });
      
      // Mock dos dados existentes
      mockImporterData.files = [file];
      mockImporterData.startImport = vi.fn().mockResolvedValue({
        success: true,
        data: job,
      });

      customRender(<MappingPage fileId={file.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de iniciar importação
      const startImportButton = screen.getByRole('button', { name: /iniciar importação/i });
      await user.click(startImportButton);

      // Verificar se a importação foi iniciada
      await waitFor(() => {
        expect(mockImporterData.startImport).toHaveBeenCalledWith({
          fileId: file.id,
          mappingId: mapping.id,
        });
      });

      // Verificar redirecionamento para página de progresso
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(`/importer/progress/${job.id}`);
      });
    });

    it('deve mostrar progresso da importação', async () => {
      const job = createImportJobData({
        status: IMPORT_STATES.PROCESSING,
        progress: 45,
        processedRecords: 45,
        totalRecords: 100,
      });
      
      // Mock dos dados de progresso
      mockImporterData.currentJob = job;
      mockImporterData.getImportProgress = vi.fn().mockResolvedValue({
        success: true,
        data: job,
      });

      customRender(<ImportProgressPage jobId={job.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar informações de progresso
      expect(screen.getByText(/45%/)).toBeInTheDocument();
      expect(screen.getByText(/45.*de.*100.*registos/i)).toBeInTheDocument();
      expect(screen.getByText(/processando/i)).toBeInTheDocument();

      // Verificar barra de progresso
      const progressBar = screen.getByRole('progressbar');
      expect(progressBar).toHaveAttribute('aria-valuenow', '45');
    });

    it('deve mostrar importação concluída', async () => {
      const job = createImportJobData({
        status: IMPORT_STATES.COMPLETED,
        progress: 100,
        processedRecords: 100,
        totalRecords: 100,
        successfulRecords: 98,
        failedRecords: 2,
      });
      
      mockImporterData.currentJob = job;

      customRender(<ImportProgressPage jobId={job.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar estado de conclusão
      expect(screen.getByText(/importação concluída/i)).toBeInTheDocument();
      expect(screen.getByText(/98.*registos importados com sucesso/i)).toBeInTheDocument();
      expect(screen.getByText(/2.*registos falharam/i)).toBeInTheDocument();

      // Verificar botões de ação
      expect(screen.getByRole('button', { name: /ver relatório/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /nova importação/i })).toBeInTheDocument();
    });

    it('deve mostrar erros de importação', async () => {
      const job = createImportJobData({
        status: IMPORT_STATES.FAILED,
        error: {
          type: IMPORT_ERROR_TYPES.VALIDATION_ERROR,
          message: 'Dados inválidos na linha 5',
          details: {
            line: 5,
            field: 'email',
            value: 'email_inválido',
          },
        },
      });
      
      mockImporterData.currentJob = job;

      customRender(<ImportProgressPage jobId={job.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar estado de erro
      expect(screen.getByText(/importação falhada/i)).toBeInTheDocument();
      expect(screen.getByText(/dados inválidos na linha 5/i)).toBeInTheDocument();
      expect(screen.getByText(/linha.*5/i)).toBeInTheDocument();
      expect(screen.getByText(/campo.*email/i)).toBeInTheDocument();

      // Verificar botões de ação
      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /corrigir ficheiro/i })).toBeInTheDocument();
    });

    it('deve cancelar importação em progresso', async () => {
      const job = createImportJobData({
        status: IMPORT_STATES.PROCESSING,
        progress: 30,
      });
      
      mockImporterData.currentJob = job;
      mockImporterData.cancelImport = vi.fn().mockResolvedValue({ success: true });

      customRender(<ImportProgressPage jobId={job.id} />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de cancelar
      const cancelButton = screen.getByRole('button', { name: /cancelar/i });
      await user.click(cancelButton);

      // Confirmar cancelamento
      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(confirmButton);

      // Verificar se o cancelamento foi chamado
      await waitFor(() => {
        expect(mockImporterData.cancelImport).toHaveBeenCalledWith(job.id);
      });

      // Verificar mensagem de cancelamento
      await waitFor(() => {
        expect(screen.getByText(/importação cancelada/i)).toBeInTheDocument();
      });
    });
  });

  describe('Histórico de Importações', () => {
    it('deve mostrar lista de importações anteriores', async () => {
      const jobs = [
        createImportJobData({
          fileName: 'funcionarios_jan.csv',
          status: IMPORT_STATES.COMPLETED,
          createdAt: '2024-01-15T10:00:00Z',
          successfulRecords: 50,
        }),
        createImportJobData({
          fileName: 'funcionarios_fev.csv',
          status: IMPORT_STATES.FAILED,
          createdAt: '2024-02-15T10:00:00Z',
        }),
        createImportJobData({
          fileName: 'funcionarios_mar.csv',
          status: IMPORT_STATES.PROCESSING,
          createdAt: '2024-03-15T10:00:00Z',
        }),
      ];
      
      mockImporterData.jobs = jobs;
      mockImporterData.getImportHistory = vi.fn().mockResolvedValue({
        success: true,
        data: jobs,
      });

      customRender(<ImporterPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se as importações são mostradas
      expect(screen.getByText('funcionarios_jan.csv')).toBeInTheDocument();
      expect(screen.getByText('funcionarios_fev.csv')).toBeInTheDocument();
      expect(screen.getByText('funcionarios_mar.csv')).toBeInTheDocument();

      // Verificar estados
      expect(screen.getByText(/concluída/i)).toBeInTheDocument();
      expect(screen.getByText(/falhada/i)).toBeInTheDocument();
      expect(screen.getByText(/processando/i)).toBeInTheDocument();

      // Verificar informações adicionais
      expect(screen.getByText(/50.*registos/i)).toBeInTheDocument();
    });

    it('deve filtrar importações por estado', async () => {
      const jobs = [
        createImportJobData({ status: IMPORT_STATES.COMPLETED }),
        createImportJobData({ status: IMPORT_STATES.FAILED }),
        createImportJobData({ status: IMPORT_STATES.PROCESSING }),
      ];
      
      mockImporterData.jobs = jobs;

      customRender(<ImporterPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Filtrar por estado "Concluída"
      const statusFilter = screen.getByLabelText(/filtrar por estado/i);
      await user.selectOptions(statusFilter, IMPORT_STATES.COMPLETED);

      // Verificar se apenas importações concluídas são mostradas
      await waitFor(() => {
        const completedJobs = screen.getAllByText(/concluída/i);
        expect(completedJobs).toHaveLength(1);
        expect(screen.queryByText(/falhada/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/processando/i)).not.toBeInTheDocument();
      });
    });

    it('deve eliminar ficheiro de importação', async () => {
      const file = createImportFileData({ name: 'funcionarios_antigos.csv' });
      
      mockImporterData.files = [file];
      mockImporterData.deleteFile = vi.fn().mockResolvedValue({ success: true });

      customRender(<ImporterPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Clicar no botão de eliminar
      const deleteButton = screen.getByTestId(`delete-file-${file.id}`);
      await user.click(deleteButton);

      // Confirmar eliminação
      const confirmButton = screen.getByRole('button', { name: /confirmar/i });
      await user.click(confirmButton);

      // Verificar se a eliminação foi chamada
      await waitFor(() => {
        expect(mockImporterData.deleteFile).toHaveBeenCalledWith(file.id);
      });

      // Verificar mensagem de sucesso
      await waitFor(() => {
        expect(screen.getByText(/ficheiro eliminado com sucesso/i)).toBeInTheDocument();
      });
    });
  });

  describe('Integração entre Funcionalidades', () => {
    it('deve completar fluxo completo de importação', async () => {
      const csvContent = 'Nome,Email,Salário\nJoão Silva,joao@email.com,2500';
      const file = createMockFile('funcionarios.csv', csvContent);
      const uploadedFile = createImportFileData({ name: 'funcionarios.csv' });
      const mapping = createImportMappingData({ fileId: uploadedFile.id });
      const job = createImportJobData({ 
        fileId: uploadedFile.id,
        mappingId: mapping.id,
        status: IMPORT_STATES.COMPLETED,
      });
      
      // Mock de todo o fluxo
      mockImporterData.uploadFile = vi.fn().mockResolvedValue({
        success: true,
        data: uploadedFile,
      });
      mockImporterData.createMapping = vi.fn().mockResolvedValue({
        success: true,
        data: mapping,
      });
      mockImporterData.startImport = vi.fn().mockResolvedValue({
        success: true,
        data: job,
      });

      // 1. Upload do ficheiro
      customRender(<FileUploadPage />);
      
      const fileInput = screen.getByLabelText(/selecionar ficheiro/i);
      Object.defineProperty(fileInput, 'files', {
        value: [file],
        writable: false,
      });
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      await waitFor(() => {
        expect(mockImporterData.uploadFile).toHaveBeenCalled();
      });

      // 2. Navegar para mapeamento
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(`/importer/mapping/${uploadedFile.id}`);
      });

      // Simular navegação para página de mapeamento
      customRender(<MappingPage fileId={uploadedFile.id} />);
      
      // 3. Criar mapeamento e iniciar importação
      const submitButton = screen.getByRole('button', { name: /iniciar importação/i });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockImporterData.createMapping).toHaveBeenCalled();
        expect(mockImporterData.startImport).toHaveBeenCalled();
      });

      // 4. Verificar redirecionamento para progresso
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(`/importer/progress/${job.id}`);
      });
    });

    it('deve sincronizar dados entre componentes', async () => {
      const file = createImportFileData({ name: 'dados.csv' });
      const job = createImportJobData({ fileId: file.id });
      
      // Mock dos dados sincronizados
      mockImporterData.files = [file];
      mockImporterData.jobs = [job];
      mockImporterData.getImportHistory = vi.fn().mockResolvedValue({
        success: true,
        data: [job],
      });

      customRender(<ImporterPage />);

      // Aguardar carregamento
      await waitForLoadingToFinish();

      // Verificar se os dados são sincronizados
      expect(mockImporterData.getImportHistory).toHaveBeenCalled();
      expect(screen.getByText('dados.csv')).toBeInTheDocument();
    });

    it('deve gerir estados de erro globalmente', async () => {
      const errorMessage = 'Erro de conexão com o servidor';
      
      // Mock de erro global
      mockImporterData.error = errorMessage;
      mockImporterData.loading = false;

      customRender(<ImporterPage />);

      // Verificar se o erro é mostrado
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
    });
  });
});