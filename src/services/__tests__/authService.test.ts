import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabaseClient trước khi import authService
vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      auth: {
        signInWithPassword: vi.fn(),
        signInAnonymously: vi.fn(),
        signOut: vi.fn(),
        getSession: vi.fn(),
      },
      from: vi.fn(),
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import { signInStaff, signInStudentWithRoomCode, signOut, getCurrentSession } from '../authService';

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('signInStaff tra loi khi sai mat khau', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: { user: null, session: null },
      error: { message: 'Invalid login credentials' },
    });

    const result = await signInStaff('gv1@qllh.local', 'sai-mat-khau');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('Sai email hoặc mật khẩu');
    }
  });

  it('signInStudentWithRoomCode tra loi khi ma phong khong ton tai', async () => {
    (supabase.auth.signInAnonymously as any).mockResolvedValue({
      data: { user: { id: 'anon-uid-123' } },
      error: null,
    });

    // Mock query classes trả về null/rỗng
    const singleMock = vi.fn().mockResolvedValue({ data: null, error: null });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await signInStudentWithRoomCode('MA-KHONG-TON-TAI', 'Nguyen Van A');
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toBe('Mã phòng không đúng');
    }
    expect(supabase.auth.signOut).toHaveBeenCalled();
  });

  it('signInStaff thanh cong tra ve UserAccount', async () => {
    (supabase.auth.signInWithPassword as any).mockResolvedValue({
      data: { user: { id: 'gv-uid-1' }, session: {} },
      error: null,
    });

    const singleMock = vi.fn().mockResolvedValue({
      data: {
        id: 'gv-uid-1',
        email: 'gv1@qllh.local',
        full_name: 'Thầy Giáo A',
        role: 'teacher',
        avatar: '',
      },
      error: null,
    });
    const eqMock = vi.fn().mockReturnValue({ single: singleMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const result = await signInStaff('gv1@qllh.local', 'mat-khau-dung');
    expect('profile' in result).toBe(true);
    if ('profile' in result) {
      expect(result.profile.role).toBe('teacher');
      expect(result.profile.displayName).toBe('Thầy Giáo A');
    }
  });

  it('signInStudentWithRoomCode thanh cong tra ve classId', async () => {
    (supabase.auth.signInAnonymously as any).mockResolvedValue({
      data: { user: { id: 'anon-uid-456' } },
      error: null,
    });

    const singleClassMock = vi.fn().mockResolvedValue({
      data: { id: 'class-uuid-999' },
      error: null,
    });
    const eqMock = vi.fn().mockReturnValue({ single: singleClassMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    const insertMock = vi.fn().mockResolvedValue({ data: null, error: null });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'classes') {
        return { select: selectMock };
      }
      if (table === 'room_sessions') {
        return { insert: insertMock };
      }
      return {};
    });

    const result = await signInStudentWithRoomCode('ROOM5A', 'Nguyen Van A');
    expect('classId' in result).toBe(true);
    if ('classId' in result) {
      expect(result.classId).toBe('class-uuid-999');
    }
    expect(insertMock).toHaveBeenCalledWith({
      auth_uid: 'anon-uid-456',
      class_id: 'class-uuid-999',
    });
  });
});
