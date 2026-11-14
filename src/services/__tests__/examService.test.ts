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
import {
  listActiveTopics,
  startExamSession,
  submitExamResult,
  submitExamSession,
} from '../examService';

describe('examService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('submitExamResult lan 2 upsert ghi de khong tao them dong moi', async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    (supabase.from as any).mockReturnValue({ upsert: upsertMock });

    await submitExamResult('session-123', 8, 10, 120);

    expect(upsertMock).toHaveBeenCalledWith(
      {
        session_id: 'session-123',
        correct_count: 8,
        score: 8.0,
        duration_seconds: 120,
      },
      { onConflict: 'session_id' }
    );
  });

  it('submitExamResult nem loi neu duration_seconds <= 0', async () => {
    await expect(submitExamResult('session-123', 8, 10, 0)).rejects.toThrow(
      'Thời gian làm bài không hợp lệ'
    );
    await expect(submitExamResult('session-123', 8, 10, -5)).rejects.toThrow(
      'Thời gian làm bài không hợp lệ'
    );
  });

  it('listActiveTopics chi lay cac chu de co is_active = true', async () => {
    const mockTopics = [{ id: 't1', name: 'Tin học 5' }];
    const eqActiveMock = vi.fn().mockResolvedValue({ data: mockTopics, error: null });
    const eqGradeMock = vi.fn().mockReturnValue({ eq: eqActiveMock });
    const selectMock = vi.fn().mockReturnValue({ eq: eqGradeMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const topics = await listActiveTopics(5);
    expect(topics.length).toBe(1);
    expect(topics[0].name).toBe('Tin học 5');
    expect(eqActiveMock).toHaveBeenCalledWith('is_active', true);
  });

  it('startExamSession lay cau hoi tu view quiz_questions_public va tao session', async () => {
    const mockPublicQuestions = [
      {
        id: 'q1',
        topic_id: 't1',
        content: 'Cau hoi 1',
        options: ['A', 'B', 'C', 'D'],
        image_url: null,
      },
    ];

    const inMock = vi.fn().mockResolvedValue({ data: mockPublicQuestions, error: null });
    const selectPublicMock = vi.fn().mockReturnValue({ in: inMock });

    const singleSessionMock = vi.fn().mockResolvedValue({
      data: { id: 'new-session-id' },
      error: null,
    });
    const selectSessionMock = vi.fn().mockReturnValue({ single: singleSessionMock });
    const insertSessionMock = vi.fn().mockReturnValue({ select: selectSessionMock });

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'quiz_questions_public') {
        return { select: selectPublicMock };
      }
      if (table === 'quiz_sessions') {
        return { insert: insertSessionMock };
      }
      return {};
    });

    const result = await startExamSession('Em An', 'class-1', false, ['t1']);
    expect(result.sessionId).toBe('new-session-id');
    expect(result.questions.length).toBe(1);
    expect(result.questions[0].content).toBe('Cau hoi 1');
  });

  it('submitExamSession goi supabase.functions.invoke submit-exam-session', async () => {
    (supabase.functions.invoke as any).mockResolvedValue({
      data: { score: 9.0, correctCount: 9, totalQuestions: 10 },
      error: null,
    });

    const res = await submitExamSession(
      'session-xyz',
      [{ questionId: 'q1', selectedOptionIndex: 2 }],
      60
    );

    expect(supabase.functions.invoke).toHaveBeenCalledWith('submit-exam-session', {
      body: {
        sessionId: 'session-xyz',
        answers: [{ questionId: 'q1', selectedOptionIndex: 2 }],
        durationSeconds: 60,
      },
    });
    expect(res.score).toBe(9.0);
    expect(res.correctCount).toBe(9);
  });
});

