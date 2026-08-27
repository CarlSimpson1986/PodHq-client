import { redirect, notFound } from "next/navigation";
import { createSessionClient } from "@/lib/supabase/server";
import { getMemberByAuthUserId } from "@/lib/data/member";
import { getProfessional } from "@/lib/data/professionals";
import { NoMemberProfile } from "@/components/no-member-profile";
import { PageHero } from "@/components/page-hero";
import { BottomNav } from "@/components/bottom-nav";
import { UsersIcon } from "@/components/icons";
import { ProfessionalInquiryForm } from "@/components/professional-inquiry-form";

function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

export default async function ProfessionalDetailPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { id } = await params;
  const professionalId = Number(id);
  if (!Number.isInteger(professionalId) || professionalId <= 0) {
    notFound();
  }

  const professional = await getProfessional(professionalId);
  if (!professional) {
    notFound();
  }

  return (
    <main className="flex min-h-full flex-1 flex-col pb-20">
      <PageHero title={professional.name} subtitle={`£${professional.pricePerHourGbp.toFixed(0)}/hr`} icon={UsersIcon} iconHref="/professionals" />
      <div className="flex-1 space-y-4 px-6 pb-10 pt-8">
        <div className="mx-auto w-full max-w-md space-y-4">
          <div className="card-light p-5 text-center">
            {professional.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- external hosted URLs Carl pastes in, not app-owned assets
              <img src={professional.photoUrl} alt={professional.name} className="mx-auto h-20 w-20 rounded-full object-cover" />
            ) : (
              <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border border-card-light-border text-xl font-semibold">
                {initials(professional.name)}
              </div>
            )}
            {professional.qualifications && <p className="mt-3 text-sm text-card-light-muted">{professional.qualifications}</p>}
            {professional.bio && <p className="mt-2 text-sm">{professional.bio}</p>}
          </div>

          {professional.specialties.length > 0 && (
            <div className="card-light p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Specialties</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {professional.specialties.map((s) => (
                  <span key={s} className="rounded-full bg-card-light-border px-2.5 py-1 text-xs font-medium text-card-light-foreground">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          )}

          {professional.gyms.length > 0 && (
            <div className="card-light p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-card-light-muted">Gyms</p>
              <p className="mt-1 text-sm">{professional.gyms.join(", ")}</p>
            </div>
          )}

          <ProfessionalInquiryForm professionalId={professional.id} professionalName={professional.name} />
        </div>
      </div>
      <BottomNav />
    </main>
  );
}
