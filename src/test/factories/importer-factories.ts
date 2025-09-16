import { vi } from 'vitest';

// Interfaces para dados de importação
export interface ImportFileData {
  id: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  content?: string;
  encoding?: string;
}

export interface ImportMappingData {
  id: string;
  sourceColumn: string;
  targetField: string;
  dataType: 'string' | 'number' | 'date' | 'boolean';
  required: boolean;
  defaultValue?: any;
  transformation?: string;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    options?: string[];
  };
}

export interface ImportPreviewData {
  headers: string[];
  rows: any[][];
  totalRows: number;
  sampleSize: number;
  detectedTypes: Record<string, string>;
  errors: ImportErrorData[];
  warnings: ImportWarningData[];
}

export interface ImportErrorData {
  id: string;
  row: number;
  column: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  code: string;
  value?: any;
}

export interface ImportWarningData {
  id: string;
  row?: number;
  column?: string;
  message: string;
  code: string;
  suggestion?: string;
}

export interface ImportJobData {
  id: string;
  name: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  fileId: string;
  mappings: ImportMappingData[];
  options: {
    skipFirstRow: boolean;
    delimiter: string;
    encoding: string;
    dateFormat: string;
    numberFormat: string;
    batchSize: number;
    validateOnly: boolean;
  };
  progress: {
    total: number;
    processed: number;
    successful: number;
    failed: number;
    percentage: number;
  };
  result?: {
    importedRecords: number;
    skippedRecords: number;
    errorRecords: number;
    duration: number;
    errors: ImportErrorData[];
    warnings: ImportWarningData[];
  };
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  createdBy: string;
}

export interface ImportTemplateData {
  id: string;
  name: string;
  description: string;
  category: 'transactions' | 'payroll' | 'family' | 'personal' | 'custom';
  mappings: ImportMappingData[];
  options: ImportJobData['options'];
  isDefault: boolean;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  usageCount: number;
}

export interface ImportHistoryData {
  id: string;
  jobId: string;
  fileName: string;
  status: ImportJobData['status'];
  recordsProcessed: number;
  recordsSuccessful: number;
  recordsFailed: number;
  duration: number;
  createdAt: string;
  completedAt?: string;
}

// Factory para criar dados de ficheiro de importação
export const createImportFileData = (overrides: Partial<ImportFileData> = {}): ImportFileData => ({
  id: `file-${Math.random().toString(36).substr(2, 9)}`,
  name: 'transactions.csv',
  size: 1024 * 50, // 50KB
  type: 'text/csv',
  lastModified: Date.now(),
  content: 'Date,Description,Amount,Category\n2024-01-01,"Compra Supermercado","-25.50","Alimentação"\n2024-01-02,"Salário","2500.00","Rendimento"',
  encoding: 'utf-8',
  ...overrides,
});

// Factory para criar dados de mapeamento
export const createImportMappingData = (overrides: Partial<ImportMappingData> = {}): ImportMappingData => ({
  id: `mapping-${Math.random().toString(36).substr(2, 9)}`,
  sourceColumn: 'Date',
  targetField: 'transaction_date',
  dataType: 'date',
  required: true,
  transformation: 'parseDate',
  validation: {
    pattern: '^\\d{4}-\\d{2}-\\d{2}$',
  },
  ...overrides,
});

// Factory para criar dados de preview
export const createImportPreviewData = (overrides: Partial<ImportPreviewData> = {}): ImportPreviewData => ({
  headers: ['Date', 'Description', 'Amount', 'Category'],
  rows: [
    ['2024-01-01', 'Compra Supermercado', '-25.50', 'Alimentação'],
    ['2024-01-02', 'Salário', '2500.00', 'Rendimento'],
    ['2024-01-03', 'Combustível', '-45.00', 'Transporte'],
  ],
  totalRows: 100,
  sampleSize: 3,
  detectedTypes: {
    'Date': 'date',
    'Description': 'string',
    'Amount': 'number',
    'Category': 'string',
  },
  errors: [],
  warnings: [],
  ...overrides,
});

// Factory para criar dados de erro de importação
export const createImportErrorData = (overrides: Partial<ImportErrorData> = {}): ImportErrorData => ({
  id: `error-${Math.random().toString(36).substr(2, 9)}`,
  row: 5,
  column: 'Amount',
  message: 'Valor inválido: não é um número',
  severity: 'error',
  code: 'INVALID_NUMBER',
  value: 'abc',
  ...overrides,
});

// Factory para criar dados de aviso de importação
export const createImportWarningData = (overrides: Partial<ImportWarningData> = {}): ImportWarningData => ({
  id: `warning-${Math.random().toString(36).substr(2, 9)}`,
  row: 3,
  column: 'Category',
  message: 'Categoria não reconhecida',
  code: 'UNKNOWN_CATEGORY',
  suggestion: 'Considere mapear para "Outros"',
  ...overrides,
});

// Factory para criar dados de job de importação
export const createImportJobData = (overrides: Partial<ImportJobData> = {}): ImportJobData => ({
  id: `job-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Importação Transações Janeiro',
  status: 'pending',
  fileId: createImportFileData().id,
  mappings: [
    createImportMappingData(),
    createImportMappingData({ sourceColumn: 'Description', targetField: 'description', dataType: 'string' }),
    createImportMappingData({ sourceColumn: 'Amount', targetField: 'amount', dataType: 'number' }),
    createImportMappingData({ sourceColumn: 'Category', targetField: 'category', dataType: 'string' }),
  ],
  options: {
    skipFirstRow: true,
    delimiter: ',',
    encoding: 'utf-8',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'en-US',
    batchSize: 100,
    validateOnly: false,
  },
  progress: {
    total: 100,
    processed: 0,
    successful: 0,
    failed: 0,
    percentage: 0,
  },
  createdAt: '2024-01-15T10:00:00Z',
  createdBy: 'user-123',
  ...overrides,
});

// Factory para criar dados de template de importação
export const createImportTemplateData = (overrides: Partial<ImportTemplateData> = {}): ImportTemplateData => ({
  id: `template-${Math.random().toString(36).substr(2, 9)}`,
  name: 'Template Transações Bancárias',
  description: 'Template para importar transações de extratos bancários',
  category: 'transactions',
  mappings: [
    createImportMappingData(),
    createImportMappingData({ sourceColumn: 'Description', targetField: 'description', dataType: 'string' }),
    createImportMappingData({ sourceColumn: 'Amount', targetField: 'amount', dataType: 'number' }),
  ],
  options: {
    skipFirstRow: true,
    delimiter: ',',
    encoding: 'utf-8',
    dateFormat: 'YYYY-MM-DD',
    numberFormat: 'en-US',
    batchSize: 100,
    validateOnly: false,
  },
  isDefault: false,
  isPublic: true,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-15T10:00:00Z',
  createdBy: 'user-123',
  usageCount: 25,
  ...overrides,
});

// Factory para criar dados de histórico de importação
export const createImportHistoryData = (overrides: Partial<ImportHistoryData> = {}): ImportHistoryData => ({
  id: `history-${Math.random().toString(36).substr(2, 9)}`,
  jobId: createImportJobData().id,
  fileName: 'transactions.csv',
  status: 'completed',
  recordsProcessed: 100,
  recordsSuccessful: 95,
  recordsFailed: 5,
  duration: 2500, // 2.5 segundos
  createdAt: '2024-01-15T10:00:00Z',
  completedAt: '2024-01-15T10:02:30Z',
  ...overrides,
});

// Estados de importação pré-definidos
export const importStates = {
  // Job pendente
  pending: createImportJobData({ status: 'pending' }),
  
  // Job em processamento
  processing: createImportJobData({
    status: 'processing',
    startedAt: '2024-01-15T10:01:00Z',
    progress: {
      total: 100,
      processed: 45,
      successful: 42,
      failed: 3,
      percentage: 45,
    },
  }),
  
  // Job concluído com sucesso
  completed: createImportJobData({
    status: 'completed',
    startedAt: '2024-01-15T10:01:00Z',
    completedAt: '2024-01-15T10:03:00Z',
    progress: {
      total: 100,
      processed: 100,
      successful: 95,
      failed: 5,
      percentage: 100,
    },
    result: {
      importedRecords: 95,
      skippedRecords: 0,
      errorRecords: 5,
      duration: 120000, // 2 minutos
      errors: [createImportErrorData()],
      warnings: [createImportWarningData()],
    },
  }),
  
  // Job falhado
  failed: createImportJobData({
    status: 'failed',
    startedAt: '2024-01-15T10:01:00Z',
    completedAt: '2024-01-15T10:01:30Z',
    progress: {
      total: 100,
      processed: 10,
      successful: 0,
      failed: 10,
      percentage: 10,
    },
    result: {
      importedRecords: 0,
      skippedRecords: 0,
      errorRecords: 10,
      duration: 30000, // 30 segundos
      errors: [
        createImportErrorData({ message: 'Formato de ficheiro inválido' }),
        createImportErrorData({ message: 'Colunas obrigatórias em falta' }),
      ],
      warnings: [],
    },
  }),
};

// Tipos de erro comuns de importação
export const importErrors = {
  invalidFile: createImportErrorData({
    message: 'Formato de ficheiro não suportado',
    code: 'INVALID_FILE_FORMAT',
    column: '',
    row: 0,
  }),
  
  missingColumns: createImportErrorData({
    message: 'Colunas obrigatórias em falta',
    code: 'MISSING_REQUIRED_COLUMNS',
    column: '',
    row: 0,
  }),
  
  invalidDate: createImportErrorData({
    message: 'Formato de data inválido',
    code: 'INVALID_DATE_FORMAT',
    column: 'Date',
    value: '32/13/2024',
  }),
  
  invalidNumber: createImportErrorData({
    message: 'Valor numérico inválido',
    code: 'INVALID_NUMBER_FORMAT',
    column: 'Amount',
    value: 'abc',
  }),
  
  duplicateRecord: createImportErrorData({
    message: 'Registo duplicado',
    code: 'DUPLICATE_RECORD',
    severity: 'warning',
  }),
  
  fileSizeExceeded: createImportErrorData({
    message: 'Tamanho do ficheiro excede o limite',
    code: 'FILE_SIZE_EXCEEDED',
    column: '',
    row: 0,
  }),
};

// Mocks para serviços de importação
export const createMockImportService = () => ({
  uploadFile: vi.fn().mockResolvedValue({ data: createImportFileData(), error: null }),
  previewFile: vi.fn().mockResolvedValue({ data: createImportPreviewData(), error: null }),
  createJob: vi.fn().mockResolvedValue({ data: createImportJobData(), error: null }),
  startJob: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  getJobStatus: vi.fn().mockResolvedValue({ data: importStates.processing, error: null }),
  cancelJob: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  getJobHistory: vi.fn().mockResolvedValue({ data: [createImportHistoryData()], error: null }),
  getTemplates: vi.fn().mockResolvedValue({ data: [createImportTemplateData()], error: null }),
  saveTemplate: vi.fn().mockResolvedValue({ data: createImportTemplateData(), error: null }),
  deleteTemplate: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
  validateMapping: vi.fn().mockResolvedValue({ data: { valid: true, errors: [] }, error: null }),
  downloadErrors: vi.fn().mockResolvedValue({ data: 'error-report.csv', error: null }),
});

// Mock do hook useImport
export const createMockUseImport = (overrides: any = {}) => {
  return vi.fn().mockReturnValue({
    uploadFile: vi.fn().mockResolvedValue({ success: true }),
    previewFile: vi.fn().mockResolvedValue({ success: true }),
    createJob: vi.fn().mockResolvedValue({ success: true }),
    startJob: vi.fn().mockResolvedValue({ success: true }),
    cancelJob: vi.fn().mockResolvedValue({ success: true }),
    jobs: [importStates.pending, importStates.processing],
    templates: [createImportTemplateData()],
    history: [createImportHistoryData()],
    loading: false,
    error: null,
    ...overrides,
  });
};

// Cenários de importação comuns
export const importScenarios = {
  // Upload bem-sucedido
  successfulUpload: {
    file: createImportFileData(),
    response: { data: createImportFileData(), error: null },
  },
  
  // Upload falhado (ficheiro muito grande)
  failedUpload: {
    file: createImportFileData({ size: 1024 * 1024 * 50 }), // 50MB
    response: { data: null, error: importErrors.fileSizeExceeded },
  },
  
  // Preview com erros
  previewWithErrors: {
    file: createImportFileData(),
    preview: createImportPreviewData({
      errors: [importErrors.invalidDate, importErrors.invalidNumber],
      warnings: [createImportWarningData()],
    }),
  },
  
  // Job de importação bem-sucedido
  successfulImport: {
    job: importStates.completed,
    result: {
      success: true,
      importedRecords: 95,
      errorRecords: 5,
    },
  },
  
  // Job de importação falhado
  failedImport: {
    job: importStates.failed,
    result: {
      success: false,
      errors: [importErrors.invalidFile, importErrors.missingColumns],
    },
  },
};

// Utility para criar listas de dados
export const createImportJobsList = (count: number = 3): ImportJobData[] => {
  return Array.from({ length: count }, (_, index) => 
    createImportJobData({
      name: `Importação ${index + 1}`,
      status: ['pending', 'processing', 'completed', 'failed'][index % 4] as any,
    })
  );
};

export const createImportTemplatesList = (count: number = 5): ImportTemplateData[] => {
  const categories: ImportTemplateData['category'][] = ['transactions', 'payroll', 'family', 'personal', 'custom'];
  
  return Array.from({ length: count }, (_, index) => 
    createImportTemplateData({
      name: `Template ${index + 1}`,
      category: categories[index % categories.length],
      isDefault: index === 0,
    })
  );
};

export const createImportHistoryList = (count: number = 10): ImportHistoryData[] => {
  return Array.from({ length: count }, (_, index) => 
    createImportHistoryData({
      fileName: `import-${index + 1}.csv`,
      createdAt: new Date(Date.now() - (index * 24 * 60 * 60 * 1000)).toISOString(),
    })
  );
};

// Utility para resetar mocks de importação
export const resetImportMocks = () => {
  vi.clearAllMocks();
};

// Utility para simular progresso de importação
export const simulateImportProgress = (job: ImportJobData, steps: number = 10) => {
  const progressSteps = [];
  
  for (let i = 0; i <= steps; i++) {
    const percentage = Math.floor((i / steps) * 100);
    const processed = Math.floor((percentage / 100) * job.progress.total);
    const successful = Math.floor(processed * 0.95); // 95% success rate
    const failed = processed - successful;
    
    progressSteps.push({
      ...job,
      status: i === steps ? 'completed' : 'processing',
      progress: {
        ...job.progress,
        processed,
        successful,
        failed,
        percentage,
      },
    });
  }
  
  return progressSteps;
};

// Utility para criar ficheiros CSV de teste
export const createTestCSV = (headers: string[], rows: string[][]): string => {
  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  return csvContent;
};

// Utility para criar File objects para testes
export const createTestFile = (content: string, filename: string = 'test.csv', type: string = 'text/csv'): File => {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type, lastModified: Date.now() });
};