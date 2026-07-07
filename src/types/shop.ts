export type ProductCardData = {
  slug: string;
  name: string;
  imageUrl: string | null;
  imageAlt: string | null;
  minPrice: number | null;
  hasMultiplePrices: boolean;
  soldOut: boolean;
};

export type CategorySummary = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
};

export type CategoryWithProducts = CategorySummary & {
  products: ProductCardData[];
};

export type ProductVariantData = {
  id: string;
  name: string;
  price: number;
  stock: number;
};

export type ProductImageData = {
  url: string;
  altText: string | null;
  isMain: boolean;
};

export type ProductDetailData = {
  slug: string;
  name: string;
  description: string | null;
  allergens: string[];
  allergensNotes: string | null;
  images: ProductImageData[];
  variants: ProductVariantData[];
};

export type ShopSettingsData = {
  acceptingOrders: boolean;
  noticeMessage: string | null;
  checkoutDisabledMessage: string | null;
};
