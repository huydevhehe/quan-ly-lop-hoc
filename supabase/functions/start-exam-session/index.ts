import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const randomBuffer = new Uint32Array(1);
    crypto.getRandomValues(randomBuffer);
    const j = randomBuffer[0] % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    if (!supabaseUrl || !supabaseServiceKey) {
      return new Response(JSON.stringify({ error: "Cấu hình server chưa hoàn tất" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const body = await req.json();
    const { studentName, classId, isFreeSlot = false, topicIds = [], schoolName } = body;

    if (!studentName || !topicIds || topicIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Vui lòng nhập tên học sinh và chọn ít nhất một chủ đề" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Lấy toàn bộ câu hỏi của các chủ đề được chọn (Edge function dùng service_role đọc được correct_index)
    const { data: rawQuestions, error: qError } = await adminClient
      .from("quiz_questions")
      .select("id, content, options, correct_index, image_url")
      .in("topic_id", topicIds);

    if (qError || !rawQuestions || rawQuestions.length === 0) {
      return new Response(
        JSON.stringify({ error: "Không tìm thấy câu hỏi nào trong các chủ đề đã chọn" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Xáo trộn thứ tự các câu hỏi bằng Fisher-Yates (crypto.getRandomValues)
    const shuffledPool = shuffleArray(rawQuestions);
    // Giới hạn tối đa 10 câu hỏi cho 1 bài thi
    const selectedQuestions = shuffledPool.slice(0, 10);

    const questionOrder: Array<{ questionId: string; correctShuffledIndex: number }> = [];
    const clientQuestions: Array<{
      id: string;
      content: string;
      options: string[];
      imageUrl?: string;
    }> = [];

    // 2. Xáo trộn đáp án của từng câu hỏi và tạo map kiểm tra đáp án đúng
    for (const q of selectedQuestions) {
      const originalOptions: string[] = Array.isArray(q.options) ? q.options : [];
      const originalCorrectOption = originalOptions[q.correct_index];

      // Xáo trộn options
      const shuffledOptions = shuffleArray(originalOptions);
      const newCorrectIndex = shuffledOptions.indexOf(originalCorrectOption);

      questionOrder.push({
        questionId: q.id,
        correctShuffledIndex: newCorrectIndex >= 0 ? newCorrectIndex : 0,
      });

      // Trả về cho client: TUYỆT ĐỐI KHÔNG có correct_index
      clientQuestions.push({
        id: q.id,
        content: q.content,
        options: shuffledOptions,
        imageUrl: q.image_url || undefined,
      });
    }

    // 3. Lưu phiên thi vào database
    const { data: sessionData, error: sError } = await adminClient
      .from("quiz_sessions")
      .insert({
        student_name: studentName,
        class_id: classId || null,
        is_free_slot: isFreeSlot,
        school_name: schoolName || null,
        topic_ids: topicIds,
        question_order: questionOrder,
      })
      .select("id")
      .single();

    if (sError || !sessionData) {
      return new Response(
        JSON.stringify({ error: `Không thể tạo phiên thi: ${sError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        sessionId: sessionData.id,
        questions: clientQuestions,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: `Lỗi hệ thống: ${err.message}` }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
