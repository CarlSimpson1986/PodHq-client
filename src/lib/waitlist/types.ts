export type WaitlistStatus = "waiting" | "offered" | "accepted" | "declined" | "expired";

export interface WaitlistEntry {
  id: number;
  member_id: number;
  gym: string;
  resource_id: number;
  slot_start: string;
  status: WaitlistStatus;
  offered_at: string | null;
  offer_expires_at: string | null;
  created_at: string;
}
