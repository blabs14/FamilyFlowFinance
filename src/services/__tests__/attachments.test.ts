// src/services/__tests__/attachments.test.ts
// Unit 6 Task 10: TDD para transaction-aware attachments
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Use vi.hoisted so these refs are available inside the vi.mock factory
const { mockUpload, mockRemove, mockGetPublicUrl, mockStorageFrom,
        mockSingle, mockEq, mockSelect, mockInsert, mockDelete, mockOrder,
        mockDbFrom } = vi.hoisted(() => {
  const mockUpload = vi.fn();
  const mockRemove = vi.fn();
  const mockGetPublicUrl = vi.fn(() => ({ data: { publicUrl: 'https://bucket/receipts/path.pdf' } }));
  const mockStorageFrom = vi.fn(() => ({ upload: mockUpload, remove: mockRemove, getPublicUrl: mockGetPublicUrl }));

  const mockSingle = vi.fn();
  const mockEq = vi.fn().mockReturnThis();
  const mockSelect = vi.fn().mockReturnThis();
  const mockInsert = vi.fn().mockReturnThis();
  const mockDelete = vi.fn().mockReturnThis();
  const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });

  const mockDbChain = { select: mockSelect, insert: mockInsert, delete: mockDelete, eq: mockEq, order: mockOrder, single: mockSingle };
  const mockDbFrom = vi.fn(() => mockDbChain);

  return { mockUpload, mockRemove, mockGetPublicUrl, mockStorageFrom, mockSingle, mockEq, mockSelect, mockInsert, mockDelete, mockOrder, mockDbFrom };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    storage: { from: mockStorageFrom },
    from: mockDbFrom,
  },
}));

import {
  uploadTransactionAttachment,
  listTransactionAttachments,
  deleteTransactionAttachment,
} from '../attachments';

describe('attachments service — transaction-aware', () => {
  beforeEach(() => vi.clearAllMocks());

  it('uploadTransactionAttachment faz upload e regista row em transaction_attachments', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    mockUpload.mockResolvedValueOnce({ error: null });
    mockSingle.mockResolvedValueOnce({
      data: { id: 'att-1', transaction_id: 'tx-1', storage_path: 'tx-1/receipt.pdf' },
      error: null,
    });

    const file = new File(['test'], 'receipt.pdf', { type: 'application/pdf' });
    const result = await uploadTransactionAttachment('tx-1', 'user-1', file);

    expect(supabase.storage.from).toHaveBeenCalledWith('receipts');
    expect(supabase.from).toHaveBeenCalledWith('transaction_attachments');
    expect(result.data?.transaction_id).toBe('tx-1');
  });

  it('listTransactionAttachments ordena por uploaded_at DESC', async () => {
    mockOrder.mockResolvedValueOnce({ data: [], error: null });

    await listTransactionAttachments('tx-1');

    expect(mockOrder).toHaveBeenCalledWith('uploaded_at', { ascending: false });
  });

  it('deleteTransactionAttachment remove do Storage e da tabela', async () => {
    mockSingle.mockResolvedValueOnce({
      data: { storage_path: 'tx-1/receipt.pdf' },
      error: null,
    });
    mockRemove.mockResolvedValueOnce({ error: null });

    const result = await deleteTransactionAttachment('att-1');
    expect(result.error).toBeFalsy(); // undefined ou null — ambos significam sem erro
  });
});
