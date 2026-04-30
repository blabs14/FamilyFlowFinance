import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn(),
    rpc: vi.fn(),
  }
}));

import { getGoalBalance } from '../goalAllocations';

describe('goalAllocations service (post-ledger)', () => {
  it('getGoalBalance queries goals_with_balance view', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    (supabase.from as any).mockReturnThis();
    (supabase.select as any).mockReturnThis();
    (supabase.eq as any).mockReturnThis();
    (supabase.single as any).mockResolvedValue({
      data: { valor_atual_cents: 5000 },
      error: null,
    });

    const result = await getGoalBalance('goal-123');
    expect(result.data).toEqual({ valor_atual_cents: 5000 });
    expect(supabase.from).toHaveBeenCalledWith('goals_with_balance');
  });
});
