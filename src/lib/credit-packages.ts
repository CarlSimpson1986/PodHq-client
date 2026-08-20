export interface CreditPackage {
  id: string;
  // catalog_items' numeric PK — needed for coupon lookups (coupon_items
  // references this, not the text slug). See podHq's 0044_coupons.sql.
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
