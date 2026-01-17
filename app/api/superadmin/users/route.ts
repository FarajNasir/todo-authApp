import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization");

    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const token = authHeader.replace("Bearer ", "");

    // ✅ verify caller token
    const { data: userData, error: userError } =
      await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const callerRole = userData.user.app_metadata?.role;

    if (callerRole !== "superadmin") {
      return NextResponse.json(
        { error: "Only superadmin can view all users" },
        { status: 403 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.admin.listUsers();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    const users = data.users.map((u) => ({
      id: u.id,
      email: u.email,
      role: (u.app_metadata as any)?.role || "user",
    }));

    return NextResponse.json({ users });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
