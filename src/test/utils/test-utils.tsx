import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AuthProvider } from '@/contexts/AuthContext';
import { ActiveContractProvider } from '@/features/payroll/contexts/ActiveContractContext';
import { FamilyProvider } from '@/features/family/FamilyProvider';
import { Toaster } from '@/components/ui/toaster';

// Mock do react-i18next
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: {
      changeLanguage: () => new Promise(() => {}),
    },
  }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock do Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-id', email: 'test@example.com' } },
        error: null,
      }),
      onAuthStateChange: vi.fn().mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      }),
    },
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      }),
    }),
  },
}));

interface AllTheProvidersProps {
  children: React.ReactNode;
}

const AllTheProviders = ({ children }: AllTheProvidersProps) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <FamilyProvider>
            <ActiveContractProvider>
              {children}
              <Toaster />
            </ActiveContractProvider>
          </FamilyProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => render(ui, { wrapper: AllTheProviders, ...options });

export * from '@testing-library/react';
export { customRender };

// Utility para criar mock de usuário autenticado
export const createMockUser = (overrides = {}) => ({
  id: 'test-user-id',
  email: 'test@example.com',
  name: 'Test User',
  ...overrides,
});

// Utility para criar mock de contrato ativo
export const createMockContract = (overrides = {}) => ({
  id: 'test-contract-id',
  company_name: 'Test Company',
  employee_name: 'Test Employee',
  position: 'Developer',
  salary: 5000,
  start_date: '2024-01-01',
  ...overrides,
});

// Utility para aguardar loading states
export const waitForLoadingToFinish = async () => {
  const { waitForElementToBeRemoved } = await import('@testing-library/react');
  try {
    await waitForElementToBeRemoved(
      () => document.querySelector('[data-testid="loading"]'),
      { timeout: 3000 }
    );
  } catch {
    // Loading já terminou ou não existe
  }
};

// Mock para toast notifications
export const mockToast = {
  toast: vi.fn(),
  dismiss: vi.fn(),
  toasts: [],
};

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => mockToast,
}));

// Additional test utilities for integration testing

// Utility to wait for async operations
export const waitForAsync = (ms: number = 0) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Utility to wait for element to appear
export const waitForElement = async (getByTestId: any, testId: string, timeout: number = 5000) => {
  const { waitFor } = await import('@testing-library/react');
  return waitFor(() => getByTestId(testId), { timeout });
};

// Utility to wait for element to disappear
export const waitForElementToDisappear = async (queryByTestId: any, testId: string, timeout: number = 5000) => {
  const { waitFor } = await import('@testing-library/react');
  return waitFor(() => expect(queryByTestId(testId)).not.toBeInTheDocument(), { timeout });
};

// Utility to simulate user typing
export const typeIntoInput = async (input: HTMLElement, text: string) => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  await user.clear(input);
  await user.type(input, text);
};

// Utility to simulate form submission
export const submitForm = async (form: HTMLElement) => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  await user.click(form.querySelector('button[type="submit"]') as HTMLElement);
};

// Utility to simulate file upload
export const uploadFile = async (input: HTMLElement, file: File) => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  await user.upload(input, file);
};

// Utility to create test files
export const createTestFile = (content: string, filename: string = 'test.csv', type: string = 'text/csv'): File => {
  const blob = new Blob([content], { type });
  return new File([blob], filename, { type, lastModified: Date.now() });
};

// Utility to mock API responses
export const mockApiResponse = <T>(data: T, delay: number = 0) => {
  return new Promise<T>((resolve) => {
    setTimeout(() => resolve(data), delay);
  });
};

// Utility to mock API errors
export const mockApiError = (message: string, status: number = 500, delay: number = 0) => {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), delay);
  });
};

// Utility to simulate network delay
export const simulateNetworkDelay = (ms: number = 1000) => 
  new Promise(resolve => setTimeout(resolve, ms));

// Utility to create mock fetch responses
export const createMockFetchResponse = <T>(data: T, status: number = 200, ok: boolean = true) => {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response);
};

// Utility to mock localStorage
export const mockLocalStorage = () => {
  const store: Record<string, string> = {};
  
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      Object.keys(store).forEach(key => delete store[key]);
    }),
    length: Object.keys(store).length,
    key: vi.fn((index: number) => Object.keys(store)[index] || null),
  };
};

// Utility to mock sessionStorage
export const mockSessionStorage = () => mockLocalStorage();

// Utility to create mock navigation
export const createMockRouter = (initialPath: string = '/') => {
  const router = {
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    pathname: initialPath,
    query: {},
    asPath: initialPath,
    route: initialPath,
    events: {
      on: vi.fn(),
      off: vi.fn(),
      emit: vi.fn(),
    },
  };
  
  return router;
};

// Utility to wait for navigation
export const waitForNavigation = async (router: any, expectedPath: string, timeout: number = 5000) => {
  const { waitFor } = await import('@testing-library/react');
  return waitFor(() => {
    expect(router.push).toHaveBeenCalledWith(expectedPath);
  }, { timeout });
};

// Utility to simulate window resize
export const simulateResize = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
  
  Object.defineProperty(window, 'innerHeight', {
    writable: true,
    configurable: true,
    value: height,
  });
  
  window.dispatchEvent(new Event('resize'));
};

// Utility to simulate scroll
export const simulateScroll = (element: Element, scrollTop: number) => {
  Object.defineProperty(element, 'scrollTop', {
    writable: true,
    configurable: true,
    value: scrollTop,
  });
  
  element.dispatchEvent(new Event('scroll'));
};

// Utility to create mock intersection observer entries
export const createMockIntersectionObserverEntry = (isIntersecting: boolean = true) => ({
  isIntersecting,
  intersectionRatio: isIntersecting ? 1 : 0,
  target: document.createElement('div'),
  boundingClientRect: {} as DOMRectReadOnly,
  intersectionRect: {} as DOMRectReadOnly,
  rootBounds: {} as DOMRectReadOnly,
  time: Date.now(),
});

// Utility to test accessibility
export const testAccessibility = async (container: HTMLElement) => {
  const { axe } = await import('@axe-core/react');
  const results = await axe(container);
  expect(results).toHaveNoViolations();
};

// Utility to test keyboard navigation
export const testKeyboardNavigation = async (element: HTMLElement, key: string) => {
  const { userEvent } = await import('@testing-library/user-event');
  const user = userEvent.setup();
  element.focus();
  await user.keyboard(`{${key}}`);
};

// Utility to test focus management
export const testFocusManagement = (element: HTMLElement) => {
  expect(element).toHaveFocus();
};

// Utility to create mock date
export const mockDate = (date: string | Date) => {
  const mockDate = new Date(date);
  vi.setSystemTime(mockDate);
  return mockDate;
};

// Utility to restore real date
export const restoreDate = () => {
  vi.useRealTimers();
};

// Utility to create mock timers
export const mockTimers = () => {
  vi.useFakeTimers();
};

// Utility to advance timers
export const advanceTimers = (ms: number) => {
  vi.advanceTimersByTime(ms);
};

// Utility to run all timers
export const runAllTimers = () => {
  vi.runAllTimers();
};

// Utility to create mock geolocation
export const mockGeolocation = (coords: { latitude: number; longitude: number }) => {
  const mockGeolocation = {
    getCurrentPosition: vi.fn((success) => {
      success({
        coords: {
          latitude: coords.latitude,
          longitude: coords.longitude,
          accuracy: 1,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    }),
    watchPosition: vi.fn(),
    clearWatch: vi.fn(),
  };
  
  Object.defineProperty(navigator, 'geolocation', {
    value: mockGeolocation,
    configurable: true,
  });
  
  return mockGeolocation;
};

// Utility to create mock clipboard
export const mockClipboard = () => {
  const mockClipboard = {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  };
  
  Object.defineProperty(navigator, 'clipboard', {
    value: mockClipboard,
    configurable: true,
  });
  
  return mockClipboard;
};

// Utility to create mock notification
export const mockNotification = () => {
  const mockNotification = vi.fn().mockImplementation(() => ({
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  
  Object.defineProperty(window, 'Notification', {
    value: mockNotification,
    configurable: true,
  });
  
  Object.defineProperty(Notification, 'permission', {
    value: 'granted',
    configurable: true,
  });
  
  Object.defineProperty(Notification, 'requestPermission', {
    value: vi.fn().mockResolvedValue('granted'),
    configurable: true,
  });
  
  return mockNotification;
};

// Utility to reset all mocks
export const resetAllMocks = () => {
  vi.clearAllMocks();
  vi.clearAllTimers();
  restoreDate();
};

// Utility to create test environment
export const createTestEnvironment = () => {
  const localStorage = mockLocalStorage();
  const sessionStorage = mockSessionStorage();
  const router = createMockRouter();
  const clipboard = mockClipboard();
  const notification = mockNotification();
  
  return {
    localStorage,
    sessionStorage,
    router,
    clipboard,
    notification,
    cleanup: () => {
      resetAllMocks();
    },
  };
};

// Utility for integration test setup
export const setupIntegrationTest = () => {
  const env = createTestEnvironment();
  
  beforeEach(() => {
    // Reset all mocks before each test
    resetAllMocks();
  });
  
  afterEach(() => {
    // Cleanup after each test
    env.cleanup();
  });
  
  return env;
};

// Utility to create mock WebSocket
export const mockWebSocket = () => {
  const mockWS = {
    send: vi.fn(),
    close: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    readyState: WebSocket.OPEN,
    CONNECTING: WebSocket.CONNECTING,
    OPEN: WebSocket.OPEN,
    CLOSING: WebSocket.CLOSING,
    CLOSED: WebSocket.CLOSED,
  };
  
  global.WebSocket = vi.fn().mockImplementation(() => mockWS);
  
  return mockWS;
};

// Utility to simulate WebSocket events
export const simulateWebSocketEvent = (ws: any, event: string, data?: any) => {
  const listeners = ws.addEventListener.mock.calls
    .filter(([eventType]: [string]) => eventType === event)
    .map(([, listener]: [string, Function]) => listener);
  
  listeners.forEach((listener: Function) => {
    listener({ data: JSON.stringify(data) });
  });
};

// Utility to create mock performance observer
export const mockPerformanceObserver = () => {
  const mockObserver = {
    observe: vi.fn(),
    disconnect: vi.fn(),
    takeRecords: vi.fn().mockReturnValue([]),
  };
  
  global.PerformanceObserver = vi.fn().mockImplementation(() => mockObserver);
  
  return mockObserver;
};