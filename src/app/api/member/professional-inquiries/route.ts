import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { checkRateLimit } from "@/lib/rate-limit";
import { getProfessional, createProfessionalInquiry } from "@/lib/data/professionals";
import { professionalInquirySchema } from "@/lib/validation/professional-inquiry";
import { getStaffRecipients } from "@/lib/notifications/staff-recipients";
import { notifyFireAndForget } from "@/lib/notifications/core";
import { professionalInquiryEmail } from "@/lib/notifications/templates";

export async function POST(request: Request) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    return NextResponse.json({ status: "error", message: "Not signed in." }, { status: 401 });
  }

  const rateLimit = await checkRateLimit(user.id, "/api/member/professional-inquiries");
  if (!rateLimit.allowed) {
    return NextResponse.json({ status: "error", message: "Too many requests. Slow down." }, { status: 429 });
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return NextResponse.json({ status: "error", message: "No member profile found." }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = professionalInquirySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ status: "error", message: "Invalid request." }, { status: 400 });
  }

  try {
    const professional = await getProfessional(parsed.data.professionalId);
    if (!professional) {
      return NextResponse.json({ status: "error", message: "That professional isn't available." }, { status: 404 });
    }

    await createProfessionalInquiry({
      professionalId: professional.id,
      memberId: member.id,
      message: parsed.data.message,
    });

    // Awaited, not truly fire-and-forget — same reasoning as help-chat's
    // own staff notification: the request only waits on this call
    // completing, not on the email actually sending (notifyFireAndForget
    // swallows its own failures).
    const staffEmails = await getStaffRecipients(member.gym);
    const { subject, html } = professionalInquiryEmail({
      memberName: member.name,
      gym: member.gym,
      professionalName: professional.name,
      message: parsed.data.message,
    });
    for (const to of staffEmails) {
      await notifyFireAndForget({ eventType: "professional_inquiry", to, subject, html, gym: member.gym, memberId: member.id });
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("[professional-inquiries] failed", { error: error instanceof Error ? error.message : error });
    return NextResponse.json({ status: "error", message: "Something went wrong." }, { status: 500 });
  }
}
