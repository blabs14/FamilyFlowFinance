import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AvatarUploader } from '../AvatarUploader';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('../../../contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'u1' } }),
}));
vi.mock('../../../lib/supabaseClient', () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ data: { path: 'u1/avatar.jpg' }, error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/avatar.jpg' } }),
      }),
    },
  },
}));

vi.mock('react-easy-crop', () => ({
  default: ({ onCropComplete }: any) => {
    onCropComplete({ x: 0, y: 0, width: 256, height: 256 }, { x: 0, y: 0, width: 256, height: 256 });
    return <div data-testid="cropper" />;
  },
}));

describe('AvatarUploader', () => {
  const wrap = (ui: React.ReactElement) =>
    render(<QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>);

  it('renders the avatar button', () => {
    wrap(<AvatarUploader onUploaded={vi.fn()} />);
    expect(screen.getByRole('button', { name: /foto/i })).toBeInTheDocument();
  });

  it('shows file size error when file > 2MB', async () => {
    wrap(<AvatarUploader onUploaded={vi.fn()} />);
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['x'], 'big.jpg', { type: 'image/jpeg' });
    Object.defineProperty(bigFile, 'size', { value: 3 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [bigFile] } });
    await waitFor(() => expect(screen.getAllByText(/2 MB/i).length).toBeGreaterThanOrEqual(1));
  });
});
