import * as XLSX from 'xlsx';
import { supabase } from '../lib/supabaseClient';
import { QuizQuestion, QuizSubmission } from '../types';

export interface QuizTopicItem {
  id: string;
  grade: number;
  name: string;
  isActive: boolean;
  isForced: boolean;
  questionCount: number;
}

export interface ParsedQuestionRow {
  content: string;
  options: string[];
  correctIndex: number;
}

export type ParseQuestionsResult =
  | { rows: ParsedQuestionRow[] }
  | { error: string; lineNumber?: number };

/**
 * Validate và định dạng dữ liệu câu hỏi từ các dòng JSON parse từ Excel
 */
export function validateAndFormatQuestionRows(rawRows: any[]): ParseQuestionsResult {
  if (!rawRows || rawRows.length === 0) {
    return { error: 'File Excel không có dữ liệu câu hỏi.' };
  }

  const rows: ParsedQuestionRow[] = [];

  for (let i = 0; i < rawRows.length; i++) {
    const r = rawRows[i];
    const lineNumber = i + 1;

    const content = (r['Câu hỏi'] ?? r['cauHoi'] ?? r['Content'] ?? '').toString().trim();
    const optA = (r['A'] ?? r['a'] ?? '').toString().trim();
    const optB = (r['B'] ?? r['b'] ?? '').toString().trim();
    const optC = (r['C'] ?? r['c'] ?? '').toString().trim();
    const optD = (r['D'] ?? r['d'] ?? '').toString().trim();
    const correctRaw = (r['Đáp án đúng'] ?? r['dapAnDung'] ?? r['Correct'] ?? '').toString().trim().toUpperCase();

    if (!content) {
      return { error: `Dòng ${lineNumber} thiếu nội dung câu hỏi`, lineNumber };
    }

    if (!optA || !optB || !optC || !optD) {
      return { error: `Dòng ${lineNumber} thiếu một trong 4 đáp án (A, B, C, D)`, lineNumber };
    }

    const validLetters = ['A', 'B', 'C', 'D'];
    const correctIndex = validLetters.indexOf(correctRaw);
    if (correctIndex === -1) {
      return { error: `Dòng ${lineNumber} đáp án đúng không hợp lệ (phải là A, B, C hoặc D)`, lineNumber };
    }

    rows.push({
      content,
      options: [optA, optB, optC, optD],
      correctIndex,
    });
  }

  return { rows };
}

/**
 * Đọc file Excel câu hỏi và validate nội dung
 */
export async function parseQuestionsExcelFile(file: File): Promise<ParseQuestionsResult> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) {
      return { error: 'File Excel rỗng, không có trang tính nào.' };
    }

    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json<any>(worksheet);

    return validateAndFormatQuestionRows(rawRows);
  } catch (err: any) {
    return { error: `Không thể đọc file Excel: ${err.message || 'Lỗi định dạng'}` };
  }
}

/**
 * Nhập câu hỏi hàng loạt vào một chủ đề (All-or-nothing: 1 lệnh insert nhiều dòng)
 */
export async function bulkInsertQuestions(
  topicId: string,
  rows: ParsedQuestionRow[]
): Promise<void> {
  if (!rows || rows.length === 0) return;

  const records = rows.map((r) => ({
    topic_id: topicId,
    content: r.content,
    options: r.options,
    correct_index: r.correctIndex,
  }));

  const { error } = await supabase.from('quiz_questions').insert(records);
  if (error) {
    throw new Error(`Lỗi khi nhập câu hỏi hàng loạt: ${error.message}`);
  }
}

/**
 * Tạo file Excel mẫu chuẩn cho việc nhập câu hỏi trắc nghiệm
 */
export function generateSampleExcelTemplate(): Blob {
  const sampleData = [
    {
      'Câu hỏi': 'Thủ đô của Việt Nam là gì?',
      A: 'Hà Nội',
      B: 'TP. Hồ Chí Minh',
      C: 'Đà Nẵng',
      D: 'Huế',
      'Đáp án đúng': 'A',
    },
    {
      'Câu hỏi': '1 + 1 bằng bao nhiêu?',
      A: '1',
      B: '2',
      C: '3',
      D: '4',
      'Đáp án đúng': 'B',
    },
  ];

  const worksheet = XLSX.utils.json_to_sheet(sampleData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'MauCauHoi');

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  return new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}


/**
 * Lấy danh sách các chủ đề kèm số lượng câu hỏi thực tế trong từng chủ đề
 */
export async function listTopics(): Promise<QuizTopicItem[]> {
  const { data, error } = await supabase
    .from('quiz_topics')
    .select(`
      id,
      grade,
      name,
      is_active,
      is_forced,
      quiz_questions (count)
    `)
    .order('grade', { ascending: true })
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Lỗi khi lấy danh sách chủ đề: ${error.message}`);
  }

  return (data || []).map((t: any) => {
    const qCount =
      Array.isArray(t.quiz_questions) && t.quiz_questions[0]?.count != null
        ? t.quiz_questions[0].count
        : 0;

    return {
      id: t.id,
      grade: t.grade || 1,
      name: t.name,
      isActive: t.is_active ?? false,
      isForced: t.is_forced ?? false,
      questionCount: qCount,
    };
  });
}

/**
 * Tạo mới chủ đề
 */
export async function createTopic(grade: number, name: string): Promise<string> {
  const { data, error } = await supabase
    .from('quiz_topics')
    .insert({
      grade,
      name: name.trim(),
      is_active: false,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Không thể tạo chủ đề: ${error?.message}`);
  }

  return data.id;
}

/**
 * Bật / tắt trạng thái kích hoạt của chủ đề (cho phép học sinh thấy khi thi)
 */
export async function setTopicActive(topicId: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('quiz_topics')
    .update({ is_active: isActive })
    .eq('id', topicId);

  if (error) {
    throw new Error(`Không thể cập nhật trạng thái chủ đề: ${error.message}`);
  }
}

/**
 * Khóa (hoặc bỏ khóa) 1 chủ đề cho học sinh của khối đó.
 * Khi 1 chủ đề được khóa (is_forced = true), học sinh của khối đó CHỈ được làm
 * đúng chủ đề này, các chủ đề active khác bị ẩn khỏi lựa chọn.
 * Ràng buộc tối đa 1 chủ đề bị khóa mỗi khối được DB tự enforce qua unique
 * partial index (xem migration 0015) - ở tầng UI cần tự tắt các chủ đề khác
 * cùng khối trước khi gọi hàm này với forced = true.
 */
export async function setTopicForced(topicId: string, forced: boolean): Promise<void> {
  const { error } = await supabase
    .from('quiz_topics')
    .update({ is_forced: forced })
    .eq('id', topicId);

  if (error) {
    throw new Error(`Không thể cập nhật trạng thái khóa chủ đề: ${error.message}`);
  }
}

/**
 * Lấy toàn bộ câu hỏi trong ngân hàng (mọi chủ đề, dành cho Giáo viên quản lý, có correctIndex)
 */
export async function listAllQuestions(): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, topic_id, content, options, correct_index, image_url, quiz_topics (name, grade)')
    .order('id', { ascending: false });

  if (error) {
    throw new Error(`Lỗi khi lấy ngân hàng câu hỏi: ${error.message}`);
  }

  return (data || []).map((q: any) => {
    const topicInfo = Array.isArray(q.quiz_topics) ? q.quiz_topics[0] : q.quiz_topics;
    return {
      id: q.id,
      grade: topicInfo?.grade || 1,
      subject: 'Tin học',
      topic: q.topic_id,
      topicName: topicInfo?.name || 'Chưa rõ chủ đề',
      question: q.content,
      options: Array.isArray(q.options) ? q.options : [],
      correctIndex: q.correct_index,
      imageUrl: q.image_url || undefined,
      explanation: '',
    };
  });
}

/**
 * Lấy danh sách câu hỏi theo chủ đề (dành cho Giáo viên, có correctIndex)
 */
export async function listQuestionsByTopic(topicId: string): Promise<QuizQuestion[]> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .select('id, topic_id, content, options, correct_index, image_url')
    .eq('topic_id', topicId);

  if (error) {
    throw new Error(`Lỗi khi lấy danh sách câu hỏi: ${error.message}`);
  }

  return (data || []).map((q: any) => ({
    id: q.id,
    grade: 1,
    subject: '',
    topic: q.topic_id,
    question: q.content,
    options: Array.isArray(q.options) ? q.options : [],
    correctIndex: q.correct_index,
    imageUrl: q.image_url || undefined,
    explanation: '',
  }));
}

/**
 * Tạo câu hỏi mới trong chủ đề
 */
export async function createQuestion(input: Omit<QuizQuestion, 'id'>): Promise<string> {
  const { data, error } = await supabase
    .from('quiz_questions')
    .insert({
      topic_id: input.topic,
      content: input.question.trim(),
      options: input.options,
      correct_index: input.correctIndex,
      image_url: input.imageUrl || null,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(`Không thể tạo câu hỏi: ${error?.message}`);
  }

  return data.id;
}

/**
 * Xóa câu hỏi
 */
export async function deleteQuestion(id: string): Promise<void> {
  const { error } = await supabase.from('quiz_questions').delete().eq('id', id);

  if (error) {
    throw new Error(`Không thể xóa câu hỏi: ${error.message}`);
  }
}

/**
 * Lấy danh sách kết quả bài thi của học sinh (xem trong QuizBank)
 */
export async function listExamResults(classId?: string): Promise<QuizSubmission[]> {
  let query = supabase
    .from('quiz_results')
    .select(`
      id,
      score,
      correct_count,
      duration_seconds,
      submitted_at,
      session:quiz_sessions!inner (
        id,
        student_name,
        class_id,
        classes (name, grade)
      )
    `)
    .order('submitted_at', { ascending: false });

  if (classId) {
    query = query.eq('session.class_id', classId);
  }

  const { data, error } = await query;
  if (error) {
    throw new Error(`Lỗi khi lấy kết quả thi: ${error.message}`);
  }

  return (data || []).map((r: any) => {
    const session = r.session || {};
    const cls = session.classes || {};

    return {
      id: r.id,
      studentName: session.student_name || 'Học sinh',
      className: cls.name || 'Tự do',
      grade: cls.grade || 1,
      score: r.score !== null ? Number(r.score) : 0,
      totalQuestions: 10,
      correctAnswers: r.correct_count || 0,
      submittedAt: r.submitted_at || new Date().toISOString(),
      durationSeconds: r.duration_seconds || 0,
    };
  });
}
