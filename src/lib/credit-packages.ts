export interface CreditPackage {
  id: string;
  // catalog_items' numeric PK — needed for promo code lookups
  // (promo_code_items references this, not the text slug). See podHq's
  // 0044_promo_codes.sql.
  catalogItemId: number;
  name: string;
  label: string;
  credits: number;
  // Which credit balance this pack grants — most gyms only ever use
  // "pod". Not a closed union (see podHq's CatalogItem, the source of
  // truth this is mapped from).
  creditType: string;
  priceGBP: number;
  oneTimePerMember: boolean;
  // Whether a PAYG purchase of this pack can become a cross-gym network
  // credit for a member with an active membership (2026-08-26) — true for
  // a plain gym-session pack, false for anything tied to a specific
  // trainer/gym (PT packs) or already its own separate credit type
  // (Recovery Room). See podHq's 0065_catalog_network_eligible.sql.
  networkEligible: boolean;
}
