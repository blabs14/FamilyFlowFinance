import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import FamilyInviteForm from '@/components/FamilyInviteForm';
import { setupUser } from '../../utils/testHelpers';

const inviteMemberMock = vi.fn();
const toastMock = vi.fn();

vi.mock('@/features/family/FamilyContext', () => ({
  useFamily: () => ({
    inviteMember: inviteMemberMock,
  }),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({
    toast: toastMock,
  }),
}));

describe('FamilyInviteForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the email input and role selector', () => {
    render(<FamilyInviteForm />);

    expect(screen.getByLabelText(/email do membro da família/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/papel na família/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /enviar convite/i })).toBeInTheDocument();
  });

  it('defaults the role to member', () => {
    render(<FamilyInviteForm />);

    expect(screen.getByLabelText(/papel na família/i)).toHaveValue('member');
  });

  it('shows a validation error when submitting an empty form', async () => {
    const user = setupUser();
    render(<FamilyInviteForm />);
    screen.getByRole('button', { name: /enviar convite/i }).closest('form')?.setAttribute('novalidate', 'true');

    await user.click(screen.getByRole('button', { name: /enviar convite/i }));

    expect(await screen.findByText('Email é obrigatório')).toBeInTheDocument();
    expect(inviteMemberMock).not.toHaveBeenCalled();
  });

  it('shows a validation error for an invalid email', async () => {
    const user = setupUser();
    render(<FamilyInviteForm />);
    screen.getByRole('button', { name: /enviar convite/i }).closest('form')?.setAttribute('novalidate', 'true');

    await user.type(screen.getByLabelText(/email do membro da família/i), 'invalido');
    await user.click(screen.getByRole('button', { name: /enviar convite/i }));

    expect(await screen.findByText('Email inválido')).toBeInTheDocument();
    expect(inviteMemberMock).not.toHaveBeenCalled();
  });

  it('calls inviteMember with email and selected role on valid submit', async () => {
    const user = setupUser();
    inviteMemberMock.mockResolvedValue(undefined);
    render(<FamilyInviteForm />);

    await user.type(screen.getByLabelText(/email do membro da família/i), 'ana@example.com');
    await user.selectOptions(screen.getByLabelText(/papel na família/i), 'admin');
    await user.click(screen.getByRole('button', { name: /enviar convite/i }));

    await waitFor(() => {
      expect(inviteMemberMock).toHaveBeenCalledWith('ana@example.com', 'admin');
    });
    expect(toastMock).toHaveBeenCalledWith({
      title: 'Convite enviado',
      description: 'Convite enviado para ana@example.com com sucesso.',
    });
  });

  it('allows selecting each available role option', async () => {
    const user = setupUser();
    render(<FamilyInviteForm />);
    const roleSelect = screen.getByLabelText(/papel na família/i);

    await user.selectOptions(roleSelect, 'member');
    expect(roleSelect).toHaveValue('member');

    await user.selectOptions(roleSelect, 'admin');
    expect(roleSelect).toHaveValue('admin');

    await user.selectOptions(roleSelect, 'viewer');
    expect(roleSelect).toHaveValue('viewer');
  });
});
