import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockFrom } = vi.hoisted(() => {
  const mockFrom = vi.fn();
  return { mockFrom };
});

vi.mock('../../lib/supabaseClient', () => ({
  supabase: { from: mockFrom },
}));

import { getUserPreferences, updateUserPreferences } from '../userPreferences';

describe('getUserPreferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('selects from user_preferences for the given user_id', async () => {
    const fakePrefs = { user_id: 'u1', theme: 'dark', language: 'pt-PT' };
    const single = vi.fn().mockResolvedValue({ data: fakePrefs, error: null });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ select });

    const { data } = await getUserPreferences('u1');
    expect(mockFrom).toHaveBeenCalledWith('user_preferences');
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
    expect(data).toEqual(fakePrefs);
  });
});

describe('updateUserPreferences', () => {
  it('calls update on user_preferences with correct filters', async () => {
    const select = vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: {}, error: null }) });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mockFrom.mockReturnValue({ update });

    await updateUserPreferences('u1', { theme: 'light' });
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ theme: 'light', updated_at: expect.any(String) }));
    expect(eq).toHaveBeenCalledWith('user_id', 'u1');
  });
});
