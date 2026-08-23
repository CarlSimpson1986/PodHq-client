import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { lookupBarcode } from "@/lib/nutrition/food-search";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request, { params }: { params: Promise<{ barcode: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/nutrition/barcode");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const { barcode } = await params;
  if (!/^\d{6,14}$/.test(barcode)) {
    return NextResponse.json({ status: "error", message: "Invalid barcode." }, { status: 400 });
  }

  try {
    const result = await lookupBarcode(barcode);
    if (!result) {
      return NextResponse.json({ status: "error", message: "Product not found." }, { status: 404 });
    }
    return NextResponse.json({ status: "ok", result });
  } catch (error) {
    console.error("[nutrition-barcode] failed", { error: (error as Error).message });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
