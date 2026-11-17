import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../lib/supabaseClient', () => {
  return {
    supabase: {
      from: vi.fn(),
      rpc: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'u1' } } }),
      },
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
  validateAndFormatQuestionRows,
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
      },
    ];

    const orderNameMock = vi.fn().mockResolvedValue({ data: mockTopics, error: null });
    const orderGradeMock = vi.fn().mockReturnValue({ order: orderNameMock });
    const selectMock = vi.fn().mockReturnValue({ order: orderGradeMock });
    (supabase.from as any).mockReturnValue({ select: selectMock });
    (supabase.rpc as any).mockResolvedValue({
      data: [{ topic_id: 't1', question_count: 3 }],
      error: null,
    });

    const topics = await listTopics();
    expect(topics.length).toBe(1);
    expect(topics[0].id).toBe('t1');
    expect(topics[0].questionCount).toBe(3);
    expect(supabase.rpc).toHaveBeenCalledWith('count_questions_by_topic', { topic_ids: ['t1'] });
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

  it('parseQuestionsExcelFile bao loi dung so dong khi thieu dap an D', async () => {
    const invalidRows = [
      { 'Câu hỏi': 'Câu 1', A: '1', B: '2', C: '3', D: '4', 'Đáp án đúng': 'A' },
      { 'Câu hỏi': 'Câu 2', A: '1', B: '2', C: '3', D: '', 'Đáp án đúng': 'B' }, // thieu D
    ];

    const result = validateAndFormatQuestionRows(invalidRows);
    expect('error' in result).toBe(true);
    if ('error' in result) {
      expect(result.lineNumber).toBe(2);
    }
  });

  it('parseQuestionsExcelFile thanh cong khi du 4 dap an va dap an dung hop le', async () => {
    const validRows = [
      { 'Câu hỏi': 'Câu 1', A: '1', B: '2', C: '3', D: '4', 'Đáp án đúng': 'C' },
    ];

    const result = validateAndFormatQuestionRows(validRows);
    expect('rows' in result).toBe(true);
    if ('rows' in result) {
      expect(result.rows.length).toBe(1);
      expect(result.rows[0].correctIndex).toBe(2);
    }
  });
});

