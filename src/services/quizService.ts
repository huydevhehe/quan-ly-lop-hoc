import { supabase } from '../lib/supabaseClient';
import { QuizQuestion, QuizSubmission } from '../types';

export interface QuizTopicItem {
  id: string;
  grade: number;
  name: string;
  isActive: boolean;
  questionCount: number;
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
