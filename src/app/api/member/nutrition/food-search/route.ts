import { NextResponse, type NextRequest } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { searchFood } from "@/lib/nutrition/food-search";
import { foodSearchQuerySchema } from "@/lib/validation/nutrition";
import { checkRateLimit } from "@/lib/rate-limit";

// Tighter than the app's generic 100/min default — defense in depth
// alongside the client's own debounce, protecting Open Food Facts'
// shared 10/min search budget (see food-search.ts).
const FOOD_SEARCH_LIMIT_PER_MINUTE = 20;

export async function GET(request: NextRequest) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/nutrition/food-search", FOOD_SEARCH_LIMIT_PER_MINUTE);
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const parsed = foodSearchQuerySchema.safeParse({ q: request.nextUrl.searchParams.get("q") });
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Search term must be at least 3 characters." }, { status: 400 });
  }

  try {
    const results = await searchFood(parsed.data.q);
    return NextResponse.json({ status: "ok", results });
  } catch (error) {
    console.error("[nutrition-food-search] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
