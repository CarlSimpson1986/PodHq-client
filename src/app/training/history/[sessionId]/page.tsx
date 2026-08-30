import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId, hasPremium } from "@/lib/data/member";
import { getCompletedSessionDetail } from "@/lib/coach/exercise-performance";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { MemberBottomNav } from "@/components/member-bottom-nav";
import { MoreMenu } from "@/components/more-menu";
import { SessionDetailView } from "@/components/session-detail-view";

// Session-history detail (2026-08-30) — a specific past session, reached
// by tapping a row on /training/history. getCompletedSessionDetail
// bakes the ownership check into its own query (member_id + sessionId
// both required to match), so a sessionId belonging to a different
// member 404s exactly the same as one that doesn't exist at all — never
// leaks which case it was.
export default async function TrainingHistorySessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const session = await createSessionClient();
  const {
    data: { user },
  } = await session.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const member = await getMemberByAuthUserId(user.id);
  if (!member) {
    return <NoMemberProfile />;
  }

  if (!(await hasPremium(member))) {
    redirect("/dashboard");
  }

  const { sessionId } = await params;
  const sessionIdNum = Number(sessionId);
  if (!Number.isInteger(sessionIdNum) || sessionIdNum <= 0) {
    notFound();
  }

  const detail = await getCompletedSessionDetail(member.id, sessionIdNum);
  if (!detail) {
    notFound();
  }

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title="Session" subtitle="Past workout detail" rightSlot={<MoreMenu />} />
      <div className="flex-1 space-y-6 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-6">
          <Link href="/training/history" prefetch={false} className="text-xs font-medium text-muted-foreground underline">
            ← Back to History
          </Link>

          <div className="card-light p-5">
            <SessionDetailView session={detail} />
          </div>
        </div>
      </div>
      <MemberBottomNav />
    </main>
  );
}
