import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { loginSchema } from "@/lib/validation/auth";

const GENERIC_ERROR = "Invalid email or password.";

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: GENERIC_ERROR }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: GENERIC_ERROR }, { status: 400 });
  }

  const supabase = await createSessionClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error || !data.user) {
    return NextResponse.json({ status: "error", message: GENERIC_ERROR }, { status: 401 });
  }

  return NextResponse.json({ status: "ok" });
}
