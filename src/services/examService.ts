import { supabase } from '../lib/supabaseClient';

export interface ActiveTopic {
  id: string;
  name: string;
}

export interface ExamQuestion {
  id: string;
  content: string;
  options: string[];
  imageUrl?: string;
}

export interface ExamSessionResult {
  sessionId: string;
  questions: ExamQuestion[];
}

/**
 * Lấy danh sách các chủ đề đang được kích hoạt (is_active = true) theo khối lớp
 */
export async function listActiveTopics(grade: number): Promise<ActiveTopic[]> {
  const { data, error } = await supabase
    .from('quiz_topics')
    .select('id, name')
    .eq('grade', grade)
    .eq('is_active', true);

  if (error) {
    throw new Error(`Lỗi khi lấy chủ đề thi: ${error.message}`);
  }

  return (data || []).map((t: any) => ({
    id: t.id,
    name: t.name,
  }));
}

/**
 * Bắt đầu phiên thi trắc nghiệm của học sinh.
 * Ưu tiên gọi Edge Function start-exam-session (xáo trộn và giấu đáp án server-side).
 * TUYỆT ĐỐI CHỈ ĐỌC TỪ VIEW quiz_questions_public khi fallback để không lộ đáp án đúng!
 */
export async function startExamSession(
  studentName: string,
  classId: string | null,
  isFreeSlot: boolean,
  topicIds: string[]
): Promise<ExamSessionResult> {
  if (topicIds.length === 0) {
    throw new Error('Vui lòng chọn ít nhất một chủ đề thi');
  }

  // 1. Gọi Edge Function start-exam-session nếu khả dụng
  if (supabase.functions && typeof supabase.functions.invoke === 'function') {
    try {
      const { data, error } = await supabase.functions.invoke('start-exam-session', {
        body: { studentName, classId, isFreeSlot, topicIds },
      });
      if (!error && data && data.sessionId) {
        return data as ExamSessionResult;
      }
    } catch {
      // Fallback xuống gọi direct view
    }
  }

  // 2. Fallback: Lấy câu hỏi an toàn từ view quiz_questions_public (không chứa cột correct_index)
  const { data: questionsData, error: qError } = await supabase
    .from('quiz_questions_public')
    .select('id, content, options, image_url')
    .in('topic_id', topicIds);

  if (qError) {
    throw new Error(`Không thể lấy câu hỏi thi: ${qError.message}`);
  }

  const questions: ExamQuestion[] = (questionsData || []).map((q: any) => ({
    id: q.id,
    content: q.content,
    options: Array.isArray(q.options) ? q.options : [],
    imageUrl: q.image_url || undefined,
  }));

  const questionOrder = questions.map((q) => q.id);

  const { data: sessionData, error: sError } = await supabase
    .from('quiz_sessions')
    .insert({
      student_name: studentName.trim(),
      class_id: classId || null,
      is_free_slot: isFreeSlot,
      topic_ids: topicIds,
      question_order: questionOrder,
    })
    .select('id')
    .single();

  if (sError || !sessionData) {
    throw new Error(`Không thể tạo phiên thi: ${sError?.message}`);
  }

  return {
    sessionId: sessionData.id,
    questions,
  };
}

/**
 * Nộp bài thi trắc nghiệm qua Edge function submit-exam-session (chấm điểm bảo mật phía server).
 */
export async function submitExamSession(
  sessionId: string,
  answers: Array<{ questionId: string; selectedOptionIndex: number }>,
  durationSeconds: number
): Promise<{ score: number; correctCount: number; totalQuestions: number }> {
  if (durationSeconds <= 0) {
    throw new Error('Thời gian làm bài không hợp lệ');
  }

  const { data, error } = await supabase.functions.invoke('submit-exam-session', {
    body: { sessionId, answers, durationSeconds },
  });

  if (error || !data) {
    throw new Error(`Không thể nộp bài thi qua Edge Function: ${error?.message || 'Lỗi server'}`);
  }

  return data;
}

/**
 * Nộp bài thi trắc nghiệm (Tương thích ngược & fallback).
 * Dùng upsert với onConflict: session_id để chống việc double-click tạo 2 dòng kết quả thi trùng.
 */
export async function submitExamResult(
  sessionId: string,
  correctCount: number,
  totalQuestions: number,
  durationSeconds: number,
  answers?: Array<{ questionId: string; selectedOptionIndex: number }>
): Promise<void> {
  if (durationSeconds <= 0) {
    throw new Error('Thời gian làm bài không hợp lệ');
  }

  // Nếu có danh sách đáp án, ưu tiên gọi Edge function submit-exam-session
  if (answers && answers.length > 0 && supabase.functions && typeof supabase.functions.invoke === 'function') {
    try {
      const { data, error } = await supabase.functions.invoke('submit-exam-session', {
        body: { sessionId, answers, durationSeconds },
      });
      if (!error && data) {
        return;
      }
    } catch {
      // Fallback sang upsert trực tiếp
    }
  }

  const score = totalQuestions > 0 ? (correctCount / totalQuestions) * 10 : 0;
  const roundedScore = Math.round(score * 10) / 10;

  const { error } = await supabase
    .from('quiz_results')
    .upsert(
      {
        session_id: sessionId,
        score: roundedScore,
        correct_count: correctCount,
        duration_seconds: durationSeconds,
      },
      { onConflict: 'session_id' }
    );

  if (error) {
    throw new Error(`Không thể nộp kết quả bài thi: ${error.message}`);
  }
}
