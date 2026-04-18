import type { ReactElement, ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

type ProviderOpts = {
  queryClient?: QueryClient;
  initialRoute?: string;
  wrapper?: (children: ReactNode) => ReactElement;
};

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = makeQueryClient(),
    initialRoute = '/',
    wrapper,
    ...renderOptions
  }: ProviderOpts & Omit<RenderOptions, 'wrapper'> = {}
) {
  const Wrapper = ({ children }: { children: ReactNode }) => {
    const tree = (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>{children}</MemoryRouter>
      </QueryClientProvider>
    );

    return wrapper ? wrapper(tree) : tree;
  };

  return { queryClient, ...render(ui, { wrapper: Wrapper, ...renderOptions }) };
}
