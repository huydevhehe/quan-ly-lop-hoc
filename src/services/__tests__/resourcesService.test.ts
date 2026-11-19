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
import {
  listResources,
  createResource,
  setResourceActive,
  deleteResource,
} from '../resourcesService';

describe('resourcesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('createResource bao loi khi url khong hop le', async () => {
    await expect(
      createResource({
        type: 'game',
        title: 'Game test',
        url: '',
        isActive: false,
      })
    ).rejects.toThrow('URL không hợp lệ');

    await expect(
      createResource({
        type: 'game',
        title: 'Game test',
        url: 'invalid-url',
        isActive: false,
      })
    ).rejects.toThrow('URL không hợp lệ');
  });

  it('createResource them moi resource thanh cong', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'r1' }, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });

    const maybeSingleMock = vi.fn().mockResolvedValue({ data: { school_id: 'school-1' }, error: null });
    const profileEqMock = vi.fn().mockReturnValue({ maybeSingle: maybeSingleMock });
    const profileSelectMock = vi.fn().mockReturnValue({ eq: profileEqMock });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'resources') return { insert: insertMock };
      if (table === 'profiles') return { select: profileSelectMock };
      return {};
    });

    const id = await createResource({
      type: 'game',
      title: 'Game toan hoc',
      url: 'https://game.example.com',
      isActive: true,
    });
    expect(id).toBe('r1');
  });

  it('listResources lay theo type va grade', async () => {
    const mockData = [
      {
        id: 'r1',
        type: 'video',
        grade: 5,
        title: 'Video 1',
        url: 'https://youtube.com/1',
        thumbnail_url: null,
        is_active: true,
      },
    ];

    const eqGradeMock = vi.fn().mockResolvedValue({ data: mockData, error: null });
    const eqTypeMock = vi.fn().mockReturnValue({ eq: eqGradeMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqTypeMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const list = await listResources('video', 5);
    expect(list.length).toBe(1);
    expect(list[0].title).toBe('Video 1');
    expect(list[0].type).toBe('video');
  });

  it('setResourceActive cap nhat trang thai', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ update: updateMock });

    await expect(setResourceActive('r1', true)).resolves.not.toThrow();
  });

  it('deleteResource xoa resource theo id', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ delete: deleteMock });

    await expect(deleteResource('r1')).resolves.not.toThrow();
  });
});
