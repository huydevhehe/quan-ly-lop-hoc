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
  listTopics,
  createTopic,
  setTopicActive,
  listQuestionsByTopic,
  createQuestion,
  deleteQuestion,
  listExamResults,
} from '../quizService';

describe('quizService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('listTopics tra ve questionCount dung so cau that su co', async () => {
    const mockTopics = [
      {
        id: 't1',
        grade: 5,
        name: 'Tin học 5',
        is_active: true,
        quiz_questions: [{ count: 3 }],
      },
    ];

    const orderNameMock = vi.fn().mockResolvedValue({ data: mockTopics, error: null });
    const orderGradeMock = vi.fn().mockReturnValue({ order: orderNameMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderGradeMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const topics = await listTopics();
    expect(topics.length).toBe(1);
    expect(topics[0].id).toBe('t1');
    expect(topics[0].questionCount).toBe(3);
  });

  it('createTopic them chu de moi va tra ve id', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 't2' }, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    const id = await createTopic(4, 'Toán 4');
    expect(id).toBe('t2');
  });

  it('listQuestionsByTopic map dung correct_index sang correctIndex', async () => {
    const mockQuestions = [
      {
        id: 'q1',
        topic_id: 't1',
        content: '1 + 1 = ?',
        options: ['1', '2', '3', '4'],
        correct_index: 1,
        image_url: null,
      },
    ];

    const eqMock = vi.fn().mockResolvedValue({ data: mockQuestions, error: null });
    const selectMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });

    const questions = await listQuestionsByTopic('t1');
    expect(questions.length).toBe(1);
    expect(questions[0].question).toBe('1 + 1 = ?');
    expect(questions[0].correctIndex).toBe(1);
  });

  it('createQuestion luu cau hoi vao bang quiz_questions', async () => {
    const singleMock = vi.fn().mockResolvedValue({ data: { id: 'q2' }, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    (supabase.from as any).mockReturnValue({ insert: insertMock });

    const id = await createQuestion({
      grade: 5,
      subject: 'Tin học',
      topic: 't1',
      question: 'Phím tắt sao chép là gì?',
      options: ['Ctrl+C', 'Ctrl+V'],
      correctIndex: 0,
      explanation: '',
    });
    expect(id).toBe('q2');
  });

  it('deleteQuestion xoa cau hoi theo id', async () => {
    const eqMock = vi.fn().mockResolvedValue({ error: null });
    const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
    (supabase.from as any).mockReturnValue({ delete: deleteMock });

    await expect(deleteQuestion('q1')).resolves.not.toThrow();
  });
});
