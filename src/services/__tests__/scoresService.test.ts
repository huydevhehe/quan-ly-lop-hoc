import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import { getClassScores, saveScore } from '../scoresService';

describe('scoresService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveScore bao loi khi diem ngoai khoang 0-10', async () => {
    await expect(saveScore('s1', 'hk1', 15, 5)).rejects.toThrow(
      'Điểm số phải nằm trong khoảng từ 0 đến 10'
    );
    await expect(saveScore('s1', 'hk1', -1, 5)).rejects.toThrow(
      'Điểm số phải nằm trong khoảng từ 0 đến 10'
    );
    await expect(saveScore('s1', 'hk1', 8, 12)).rejects.toThrow(
      'Điểm số phải nằm trong khoảng từ 0 đến 10'
    );
  });

  it('saveScore upsert dung du lieu vao bang scores', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ upsert: upsertMock });

    await saveScore('s1', 'hk1', 8.5, 9.0);

    expect(upsertMock).toHaveBeenCalledWith(
      {
        student_id: 's1',
        semester: 'hk1',
        theory_score: 8.5,
        practice_score: 9.0,
      },
      { onConflict: 'student_id,semester' }
    );
  });

  it('getClassScores tra ve danh sach diem va classification doc tu generated column', async () => {
    const mockData = [
      {
        student_id: 's1',
        theory_score: 9.0,
        practice_score: 10.0,
        total_score: 9.5,
        classification: 'T',
        students: { class_id: 'class-1' },
      },
    ];

    const eqSemesterMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const eqClassMock = vi.fn().mockReturnValue({ eq: eqSemesterMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqClassMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const scores = await getClassScores('class-1', 'hk1');
    expect(scores.length).toBe(1);
    expect(scores[0].studentId).toBe('s1');
    expect(scores[0].totalScore).toBe(9.5);
    expect(scores[0].classification).toBe('T');
  });
});
