import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import {
  getWeekAttendance,
  saveWeekAttendance,
  getWeekEvaluations,
  saveWeekEvaluation,
} from '../attendanceService';

describe('attendanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('saveWeekAttendance ghi de dung dong cu khi luu lai cung tuan', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ upsert: upsertMock });

    const records = [
      { studentId: 's1', status: 'unexcused' as const, note: 'Vang khong phep' },
    ];
    await saveWeekAttendance(5, records);

    expect(upsertMock).toHaveBeenCalledWith(
      [
        {
          student_id: 's1',
          week_number: 5,
          status: 'unexcused',
          note: 'Vang khong phep',
        },
      ],
      { onConflict: 'student_id,week_number' }
    );
  });

  it('getWeekAttendance join students va map ket qua thanh record theo student_id', async () => {
    const mockData = [
      {
        student_id: 's1',
        status: 'present',
        note: null,
        students: { class_id: 'class-1' },
      },
      {
        student_id: 's2',
        status: 'excused',
        note: 'Co phep',
        students: { class_id: 'class-1' },
      },
    ];

    const eqWeekMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const eqClassMock = vi.fn().mockReturnValue({ eq: eqWeekMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqClassMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await getWeekAttendance('class-1', 5);
    expect(Object.keys(result).length).toBe(2);
    expect(result['s1'].status).toBe('present');
    expect(result['s2'].status).toBe('excused');
    expect(result['s2'].note).toBe('Co phep');
  });

  it('getWeekEvaluations tra ve comment + rank theo student_id', async () => {
    const mockData = [
      {
        student_id: 's1',
        comment: 'Hoc tot',
        rank: 'Tốt',
        students: { class_id: 'class-1' },
      },
    ];

    const eqWeekMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const eqClassMock = vi.fn().mockReturnValue({ eq: eqWeekMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqClassMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await getWeekEvaluations('class-1', 5);
    expect(result['s1']).toEqual({ comment: 'Hoc tot', rank: 'Tốt' });
  });

  it('saveWeekEvaluation upsert dung dong comment + rank theo student_id va week_number', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ upsert: upsertMock });

    await saveWeekEvaluation('s1', 5, 'Can co gang hon', 'Khá');

    expect(upsertMock).toHaveBeenCalledWith(
      {
        student_id: 's1',
        week_number: 5,
        comment: 'Can co gang hon',
        rank: 'Khá',
      },
      { onConflict: 'student_id,week_number' }
    );
  });
});
