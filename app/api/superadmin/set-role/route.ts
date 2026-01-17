import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: Request) {
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
        { error: "Only superadmin can update roles" },
        { status: 403 }
      );
    }

    const { user_id, role } = await req.json();

    if (!user_id || !role) {
      return NextResponse.json(
        { error: "user_id and role required" },
        { status: 400 }
      );
    }

    // ✅ superadmin can promote/demote user <-> admin only
    if (role !== "admin" && role !== "user") {
      return NextResponse.json(
        { error: "Superadmin can set only user/admin role" },
        { status: 400 }
      );
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
      app_metadata: { role },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: "Role updated successfully ✅" });
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
