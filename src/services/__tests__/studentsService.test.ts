import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import { listStudentsByClass, upsertStudents, deleteStudent } from '../studentsService';

describe('studentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('upsertStudents bao loi khi trung student_code trong cung lop', async () => {
    const maybeSingleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const limitMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const orderForMaxMock = vi.fn().mockReturnValue({ limit: limitMock });
    const eqForMaxMock = vi.fn().mockReturnValue({ order: orderForMaxMock });
    const selectForMaxMock = vi.fn().mockReturnValue({ eq: eqForMaxMock });

    const insertSelectMock = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'duplicate key value violates unique constraint "students_class_id_student_code_key"' },
    });
    const insertMock = vi.fn().mockReturnValue({ select: insertSelectMock });

    (supabase.from as any).mockReturnValue({ select: selectForMaxMock, insert: insertMock });

    await expect(
      upsertStudents('class-1', [
        { code: 'HS001', name: 'A', gender: 'Nam', dob: '2018-01-01' },
      ])
    ).rejects.toThrow('duplicate key value violates unique constraint');
  });

  it('listStudentsByClass tra ve danh sach hoc sinh map dung field', async () => {
    const mockStudents = [
      {
        id: 's1',
        class_id: 'class-1',
        student_code: 'HS001',
        full_name: 'Nguyen Van A',
        avatar: null,
        created_at: '2026-01-01',
      },
    ];

    const orderMock = vi.fn().mockResolvedValue({ data: mockStudents, error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const students = await listStudentsByClass('class-1');
    expect(students.length).toBe(1);
    expect(students[0].id).toBe('s1');
    expect(students[0].code).toBe('HS001');
    expect(students[0].name).toBe('Nguyen Van A');
  });

  it('listStudentsByClass tra mang rong neu khong co quyen hoac khong co hoc sinh', async () => {
    const orderMock = vi.fn().mockResolvedValue({ data: [], error: null });
    const eqMock = vi.fn().mockReturnValue({ order: orderMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const students = await listStudentsByClass('class-khac');
    expect(students).toEqual([]);
  });

  it('deleteStudent xoa hoc sinh theo id', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ delete: deleteMock });

    await expect(deleteStudent('s1')).resolves.not.toThrow();
    expect(eqMock).toHaveBeenCalledWith('id', 's1');
  });
});
