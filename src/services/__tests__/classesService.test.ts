import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }) },
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import { listMyClasses, createClass, updateClass, deleteClass } from '../classesService';

describe('classesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listMyClasses map dung du lieu lop hoc va so hoc sinh', async () => {
    const mockClassesData = [
      {
        id: 'c1',
        name: 'Lớp 5A',
        grade: 5,
        room_code: 'ROOM5A',
        school_year_id: 'sy1',
        is_open: true,
        created_by: 'gv1',
        created_at: '2026-01-01',
        students: [{ count: 25 }],
      },
    ];

    const orderMock = vi.fn().mockResolvedValue({ data: mockClassesData, error: null });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const classes = await listMyClasses();
    expect(classes.length).toBe(1);
    expect(classes[0].name).toBe('Lớp 5A');
    expect(classes[0].roomCode).toBe('ROOM5A');
    expect(classes[0].totalStudents).toBe(25);
  });

  it('createClass tao lop moi voi roomCode ngau nhien 6 ky tu neu chua co', async () => {
    const mockCreated = {
      id: 'c2',
      name: 'Lớp 4B',
      grade: 4,
      room_code: 'A1B2C3',
      school_year_id: 'sy1',
      is_open: true,
      created_by: 'gv1',
      created_at: '2026-01-01',
    };

    const singleMock = vi.fn().mockResolvedValue({ data: mockCreated, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    const newClass = await createClass({
      name: 'Lớp 4B',
      grade: 4,
      schoolYearId: 'sy1',
      schoolId: 'school-1',
    });

    expect(newClass.id).toBe('c2');
    expect(newClass.name).toBe('Lớp 4B');
    expect(insertMock).toHaveBeenCalled();
  });

  it('updateClass cap nhat lop hoc', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ update: updateMock });

    await expect(updateClass('c1', { name: 'Lớp 5A Đổi Tên', isOpen: false })).resolves.not.toThrow();
    expect(updateMock).toHaveBeenCalledWith({
      name: 'Lớp 5A Đổi Tên',
      is_open: false,
    });
    expect(eqMock).toHaveBeenCalledWith('id', 'c1');
  });

  it('deleteClass xoa lop hoc theo id', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ delete: deleteMock });

    await expect(deleteClass('c1')).resolves.not.toThrow();
    expect(eqMock).toHaveBeenCalledWith('id', 'c1');
  });
});
