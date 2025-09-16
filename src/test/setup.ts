import { vi, beforeEach, afterEach } from 'vitest';
import '@testing-library/jest-dom';

// Mock global do console para evitar logs desnecessários nos testes
const originalConsole = { ...console };

beforeEach(() => {
  // Silenciar warnings e logs durante os testes
  console.warn = vi.fn();
  console.log = vi.fn();
  console.info = vi.fn();
});

afterEach(() => {
  // Restaurar console original
  Object.assign(console, originalConsole);
  
  // Limpar todos os mocks
  vi.clearAllMocks();
});

// Mock global do window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock global do ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock global do IntersectionObserver
global.IntersectionObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock do window.location
Object.defineProperty(window, 'location', {
  value: {
    href: 'http://localhost:3000',
    origin: 'http://localhost:3000',
    protocol: 'http:',
    host: 'localhost:3000',
    hostname: 'localhost',
    port: '3000',
    pathname: '/',
    search: '',
    hash: '',
    assign: vi.fn(),
    replace: vi.fn(),
    reload: vi.fn(),
  },
  writable: true,
});

// Mock do localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

// Mock do sessionStorage
const sessionStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};

Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
  writable: true,
});

// Mock global do fetch
global.fetch = vi.fn();

// Configuração para timeouts de testes
vi.setConfig({
  testTimeout: 10000,
  hookTimeout: 10000,
});

// Utility para aguardar próximo tick
export const nextTick = () => new Promise(resolve => setTimeout(resolve, 0));

// Utility para aguardar múltiplos ticks
export const waitFor = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Configuração de ambiente de teste
process.env.NODE_ENV = 'test';
process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';