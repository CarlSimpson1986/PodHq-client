import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { setPasswordSchema } from "@/lib/validation/auth";
import { logAuthEvent } from "@/lib/audit";

export async function POST(request: Request) {
  const supabase = await createSessionClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  const parsed = setPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { status: "error", message: parsed.error.issues[0]?.message ?? "Invalid password." },
      { status: 400 }
    );
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    return NextResponse.json({ status: "error", message: "Could not set password." }, { status: 400 });
  }

  // Doubles as the hard-lockout reset marker — see checkLoginLockout, which
  // now treats this event the same as a fresh login_success.
  await logAuthEvent({ email: user.email, userId: user.id, eventType: "password_reset_completed" });

  return NextResponse.json({ status: "ok" });
}
