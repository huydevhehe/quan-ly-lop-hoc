import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      storage: {
        from: vi.fn(),
      },
    },
  };
});

import { supabase } from '../../lib/supabaseClient';
import { uploadQuestionImage } from '../quizImageService';

describe('quizImageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uploadQuestionImage tra loi khi file qua 5MB', async () => {
    const bigFile = new File([new Uint8Array(6 * 1024 * 1024)], 'anh.png', {
      type: 'image/png',
    });
    const result = await uploadQuestionImage(bigFile);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('5MB');
    }
  });

  it('uploadQuestionImage tra loi khi file sai dinh dang (khong phai jpg/png)', async () => {
    const gifFile = new File([new Uint8Array(100)], 'anh.gif', {
      type: 'image/gif',
    });
    const result = await uploadQuestionImage(gifFile);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.error).toContain('JPG hoặc PNG');
    }
  });

  it('uploadQuestionImage thanh cong tra ve url', async () => {
    const validFile = new File([new Uint8Array(100)], 'anh.jpg', {
      type: 'image/jpeg',
    });

    const uploadMock = vi.fn().mockResolvedValue({ data: { path: 'uuid.jpg' }, error: null });
    const getPublicUrlMock = vi.fn().mockReturnValue({
      data: { publicUrl: 'https://supabase.co/storage/v1/object/public/quiz-images/uuid.jpg' },
    });

    (supabase.storage.from as any).mockReturnValue({
      upload: uploadMock,
      getPublicUrl: getPublicUrlMock,
    });

    const result = await uploadQuestionImage(validFile);
    expect('url' in result).toBe(true);
    if ('url' in result) {
      expect(result.url).toContain('quiz-images');
    }
  });
});
