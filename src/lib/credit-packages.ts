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
}
