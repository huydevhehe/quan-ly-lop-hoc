import { describe, it, expect, vi } from 'vitest';

describe('supabaseClient', () => {
  it('nem loi ro rang khi thieu bien moi truong Supabase', async () => {
    vi.resetModules();
    vi.stubEnv('VITE_SUPABASE_URL', '');
    vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');

    await expect(async () => {
      await import('../supabaseClient');
    }).rejects.toThrow('Thiếu cấu hình Supabase — kiểm tra file .env');

    vi.unstubAllEnvs();
  });
});
