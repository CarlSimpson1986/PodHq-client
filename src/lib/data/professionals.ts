import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { GymName } from "@/lib/gym";

// Reads the same professionals table podHq's /professionals admin page
// (admin-only) writes to (0066_professionals.sql) — "Find a Professional"
// directory, 2026-08-27, modelled on Solo60's "Professional" tab. Only
// active rows are ever shown to members; inactive stays hidden without
// deleting the profile.
export interface ProfessionalSummary {
  id: number;
  name: string;
  photoUrl: string | null;
  specialties: string[];
  gyms: GymName[];
  pricePerHourGbp: number;
}

export interface ProfessionalDetail extends ProfessionalSummary {
  bio: string;
  qualifications: string;
}

const SUMMARY_COLUMNS = "id, name, photo_url, specialties, gyms, price_per_hour_gbp";

export async function getActiveProfessionals(): Promise<ProfessionalSummary[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("professionals")
    .select(SUMMARY_COLUMNS)
    .eq("active", true)
    .order("display_order", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    photoUrl: row.photo_url,
    specialties: row.specialties ?? [],
    gyms: row.gyms ?? [],
    pricePerHourGbp: Number(row.price_per_hour_gbp),
  }));
}

export async function getProfessional(id: number): Promise<ProfessionalDetail | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("professionals")
    .select(`${SUMMARY_COLUMNS}, bio, qualifications`)
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;

  return {
    id: data.id,
    name: data.name,
    photoUrl: data.photo_url,
    specialties: data.specialties ?? [],
    gyms: data.gyms ?? [],
    pricePerHourGbp: Number(data.price_per_hour_gbp),
    bio: data.bio,
    qualifications: data.qualifications,
  };
}

export async function createProfessionalInquiry(input: { professionalId: number; memberId: number; message: string }): Promise<void> {
  const admin = createAdminClient();
  const { error } = await admin.from("professional_inquiries").insert({
    professional_id: input.professionalId,
    member_id: input.memberId,
    message: input.message,
  });
  if (error) throw error;
}
