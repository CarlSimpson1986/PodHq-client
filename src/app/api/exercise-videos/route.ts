import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getExerciseVideoOverrideMap } from "@/lib/data/exercise-videos";
import { checkRateLimit } from "@/lib/rate-limit";

// Any signed-in member — not gym-scoped, these are shared franchise-wide
// technique videos (see podHq's exercise-videos admin page, which owns
// writing exercise_video_overrides).
export async function GET() {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/exercise-videos");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests." }, { status: 429 });
  }

  try {
    const overrides = await getExerciseVideoOverrideMap();
    return NextResponse.json({ status: "ok", overrides });
  } catch (error) {
    console.error("[api/exercise-videos] failed", { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ status: "error", message: "Could not load exercise videos." }, { status: 500 });
  }
}
