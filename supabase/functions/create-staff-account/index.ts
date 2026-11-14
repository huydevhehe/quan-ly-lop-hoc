import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // CORS Headers
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Thiếu token xác thực" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

    // 1. Xác thực caller bằng token
    const clientUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await clientUser.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Token không hợp lệ" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Kiểm tra quyền Admin trong bảng profiles
    const { data: profile, error: profError } = await clientUser
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profError || profile?.role !== "admin") {
      return new Response(
        JSON.stringify({ error: "Chỉ quản trị viên mới có quyền tạo tài khoản giáo viên" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Đọc dữ liệu body
    const body = await req.json();
    const { email, password, fullName, role = "teacher" } = body;

    if (!email || !password || !fullName) {
      return new Response(
        JSON.stringify({ error: "Vui lòng nhập đầy đủ email, mật khẩu và họ tên" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Dùng service_role client để tạo người dùng trong auth.users
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    const { data: newUserData, error: createError } =
      await adminClient.auth.admin.createUser({
        email: email.trim(),
        password: password,
        email_confirm: true,
        user_metadata: { full_name: fullName.trim() },
      });

    if (createError || !newUserData.user) {
      const msg =
        createError?.message.includes("already registered") ||
        createError?.message.includes("already been registered")
          ? "Email đã được dùng bởi một tài khoản khác"
          : createError?.message || "Không thể tạo tài khoản";

      return new Response(JSON.stringify({ error: msg }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 5. Tạo bản ghi profiles tương ứng
    const { error: insertProfError } = await adminClient.from("profiles").upsert({
      id: newUserData.user.id,
      email: email.trim(),
      full_name: fullName.trim(),
      role: role,
    });

    if (insertProfError) {
      return new Response(
        JSON.stringify({ error: `Lỗi tạo hồ sơ: ${insertProfError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ userId: newUserData.user.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Lỗi máy chủ" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
