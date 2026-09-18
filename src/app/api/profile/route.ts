import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getVerifiedUser } from "@/lib/supabase/queries";

// GET /api/profile — get current user email
export async function GET() {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({ email: user.email });
}

// PATCH /api/profile — update password
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const user = await getVerifiedUser(supabase);

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  if (body.password) {
    const { error } = await supabase.auth.updateUser({
      password: body.password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  return NextResponse.json({ success: true });
}
