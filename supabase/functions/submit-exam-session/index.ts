import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const { sessionId, answers = [], durationSeconds = 0 } = body;

    if (!sessionId) {
      return new Response(JSON.stringify({ error: "Thiếu mã phiên thi (sessionId)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Đọc lại session và thông tin question_order bí mật đã lưu trên server
    const { data: session, error: sError } = await adminClient
      .from("quiz_sessions")
      .select("id, question_order")
      .eq("id", sessionId)
      .single();

    if (sError || !session) {
      return new Response(JSON.stringify({ error: "Phiên thi không tồn tại hoặc đã hết hạn" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const questionOrder: Array<{ questionId: string; correctShuffledIndex: number }> =
      Array.isArray(session.question_order) ? session.question_order : [];

    const totalQuestions = questionOrder.length;
    let correctCount = 0;

    // Map các câu trả lời của học sinh
    const answerMap = new Map<string, number>();
    for (const ans of answers) {
      if (ans && ans.questionId) {
        answerMap.set(ans.questionId, ans.selectedOptionIndex);
      }
    }

    // 2. Chấm điểm server-side
    for (const q of questionOrder) {
      const selectedIndex = answerMap.get(q.questionId);
      if (selectedIndex !== undefined && selectedIndex === q.correctShuffledIndex) {
        correctCount++;
      }
    }

    const score = totalQuestions > 0 ? Number(((correctCount / totalQuestions) * 10).toFixed(1)) : 0;

    // 3. Upsert vào bảng quiz_results (tránh nộp đè hoặc spam)
    const { error: rError } = await adminClient
      .from("quiz_results")
      .upsert(
        {
          session_id: sessionId,
          score,
          correct_count: correctCount,
          duration_seconds: durationSeconds,
          submitted_at: new Date().toISOString(),
        },
        { onConflict: "session_id" }
      );

    if (rError) {
      return new Response(
        JSON.stringify({ error: `Không thể lưu kết quả thi: ${rError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        score,
        correctCount,
        totalQuestions,
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
