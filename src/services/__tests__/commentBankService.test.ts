import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import { getAllCommentBanks, setCommentBank } from '../commentBankService';

describe('commentBankService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getAllCommentBanks tra ve dung map theo khoi', async () => {
    const eqMock = vi.fn().mockResolvedValue({
      data: [
        { grade: 1, comments: ['cau 1', 'cau 2'], file_name: 'mau.xlsx' },
        { grade: 2, comments: ['cau a'], file_name: null },
      ],
      error: null,
    });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await getAllCommentBanks('T');
    expect(result['1'].comments).toEqual(['cau 1', 'cau 2']);
    expect(result['1'].fileName).toBe('mau.xlsx');
    expect(result['2'].fileName).toBeUndefined();
  });

  it('setCommentBank goi upsert dung tham so', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ upsert: upsertMock });

    await setCommentBank('H', 3, ['nx 1'], 'file.xlsx');

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'H', grade: 3, comments: ['nx 1'], file_name: 'file.xlsx' }),
      { onConflict: 'type,grade' }
    );
  });
});
