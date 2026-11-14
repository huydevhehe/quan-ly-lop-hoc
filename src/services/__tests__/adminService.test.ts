import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      functions: {
        invoke: vi.fn(),
      },
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import { adminService } from '../adminService';
import { studentPermissionsService } from '../studentPermissionsService';

describe('adminService & studentPermissionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createStaffAccount tra loi khi email da ton tai', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: null,
      error: { message: 'Email đã được dùng bởi một tài khoản khác' },
    });

    const result = await adminService.createStaffAccount(
      'gv1@qllh.local',
      'matkhau123',
      'Cô Giáo B'
    );
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('Email đã được dùng');
    }
  });

  it('createStaffAccount thanh cong tra ve userId', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { userId: 'new-user-123' },
      error: null,
    });

    const result = await adminService.createStaffAccount(
      'gv2@qllh.local',
      'matkhau123',
      'Thầy C'
    );
    expect('userId' in result).toBe(true);
    if ('userId' in result) {
      expect(result.userId).toBe('new-user-123');
    }
  });

  it('assignTeacherToClass cap nhat created_by cua lop', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ update: updateMock });

    await expect(
      adminService.assignTeacherToClass('class-1', 'teacher-1')
    ).resolves.not.toThrow();
    expect(updateMock).toHaveBeenCalledWith({ created_by: 'teacher-1' });
    expect(eqMock).toHaveBeenCalledWith('id', 'class-1');
  });

  it('studentPermissionsService getPermissions tra ve gia tri mac dinh', async () => {
    const singleMock = vi.fn().mockResolvedValue({
      data: {
        can_view_classroom: true,
        can_view_quiz: false,
        can_view_resources: true,
        can_view_games: true,
        can_view_utilities: false,
      },
      error: null,
    });
    const limitMock = vi.fn().mockReturnValue({ single: singleMock });
    const orderMock = vi.fn().mockReturnValue({ limit: limitMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const perms = await studentPermissionsService.getPermissions();
    expect(perms.canViewQuiz).toBe(false);
    expect(perms.canViewClassroom).toBe(true);
    expect(perms.canViewUtilities).toBe(false);
  });
});
