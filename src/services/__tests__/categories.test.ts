import { describe, it, expect, vi } from 'vitest';

vi.mock('../../lib/supabaseClient', () => ({
  supabase: {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: [], error: null }),
  }
}));

import { getSystemCategories } from '../categories';

describe('categories service', () => {
  it('getSystemCategories filtra por is_system = true', async () => {
    const { supabase } = await import('../../lib/supabaseClient');
    await getSystemCategories();
    expect(supabase.from).toHaveBeenCalledWith('categories');
    expect(supabase.eq).toHaveBeenCalledWith('is_system', true);
  });
});
