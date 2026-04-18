import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';

import { renderWithProviders } from './renderWithProviders';

function Probe() {
  const { data } = useQuery({ queryKey: ['probe'], queryFn: async () => 'hello' });
  const location = useLocation();

  return <div data-testid="probe">{data ?? 'loading'}-{location.pathname}</div>;
}

describe('renderWithProviders', () => {
  it('wires up react-query and router', async () => {
    renderWithProviders(<Probe />, { initialRoute: '/foo' });

    expect(await screen.findByTestId('probe')).toHaveTextContent('hello-/foo');
  });
});
