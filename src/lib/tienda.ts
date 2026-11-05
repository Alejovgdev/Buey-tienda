import { cache } from 'react';
import { supabase } from './supabase';
import type {
  CategorySummary,
  CategoryWithProducts,
  HomeProductData,
  ProductCardData,
  ProductDetailData,
} from '@/types/shop';

type ProductCardRow = {
  slug: string;
  name: string;
  product_variants: { price: number; stock: number }[];
  product_images: { url: string; alt_text: string | null; is_main: boolean }[];
};

function mapProductCard(row: ProductCardRow): ProductCardData {
  const variants = row.product_variants ?? [];
  const images = row.product_images ?? [];
  const mainImage = images[0] ?? null;
  const prices = variants.map((variant) => variant.price);

  return {
    slug: row.slug,
    name: row.name,
    imageUrl: mainImage?.url ?? null,
    imageAlt: mainImage?.alt_text ?? row.name,
    minPrice: prices.length > 0 ? Math.min(...prices) : null,
    hasMultiplePrices: variants.length > 1,
    soldOut: variants.length === 0 || variants.every((variant) => variant.stock <= 0),
  };
}

const PRODUCT_CARD_SELECT = `
  slug,
  name,
  product_variants ( price, stock ),
  product_images ( url, alt_text, is_main )
`;

export async function getHomeProducts(limit = 3): Promise<HomeProductData[]> {
  const { data, error } = await supabase
    .from('products')
    .select(`
      slug, name, allergens,
      categories!inner ( sort_order ),
      product_variants ( id, name, price, stock ),
      product_images ( url, alt_text, is_main )
    `)
    .eq('is_active', true)
    .eq('categories.is_active', true)
    .eq('product_variants.is_active', true)
    .order('categories(sort_order)')
    .order('sort_order')
    .order('id')
    .order('sort_order', { referencedTable: 'product_variants' })
    .order('is_main', { referencedTable: 'product_images', ascending: false })
    .order('sort_order', { referencedTable: 'product_images' })
    .limit(limit);

  if (error || !data) return [];

  return data.map((product) => ({
    slug: product.slug,
    name: product.name,
    allergens: product.allergens ?? [],
    variants: product.product_variants,
    images: product.product_images.map((image) => ({
      url: image.url,
      altText: image.alt_text,
      isMain: image.is_main,
    })),
  }));
}

export async function getActiveCategories(): Promise<CategorySummary[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, description')
    .eq('is_active', true)
    .order('sort_order');

  if (error || !data) return [];
  return data;
}

export const getCategoryBySlug = cache(async (slug: string): Promise<CategorySummary | null> => {
  const { data, error } = await supabase
    .from('categories')
    .select('id, slug, name, description')
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle();

  if (error || !data) return null;
  return data;
});

export async function getProductCardsByCategory(
  categoryId: string,
  limit?: number
): Promise<ProductCardData[]> {
  let query = supabase
    .from('products')
    .select(PRODUCT_CARD_SELECT)
    .eq('is_active', true)
    .eq('product_variants.is_active', true)
    .eq('category_id', categoryId)
    .order('sort_order')
    .order('sort_order', { referencedTable: 'product_variants' })
    .order('is_main', { referencedTable: 'product_images', ascending: false })
    .order('sort_order', { referencedTable: 'product_images' });

  if (limit) {
    query = query.limit(limit);
  }

  const { data, error } = await query;
  if (error || !data) return [];
  return (data as unknown as ProductCardRow[]).map(mapProductCard);
}

export async function getCategoriesWithProducts(
  productsPerCategory: number
): Promise<CategoryWithProducts[]> {
  const categories = await getActiveCategories();

  return Promise.all(
    categories.map(async (category) => ({
      ...category,
      products: await getProductCardsByCategory(category.id, productsPerCategory),
    }))
  );
}

type ProductDetailRow = {
  slug: string;
  name: string;
  description: string | null;
  allergens: string[] | null;
  allergens_notes: string | null;
  product_variants: { id: string; name: string; price: number; stock: number }[];
  product_images: { url: string; alt_text: string | null; is_main: boolean }[];
};

export const getProductDetailBySlug = cache(async (slug: string): Promise<ProductDetailData | null> => {
  const { data, error } = await supabase
    .from('products')
    .select(
      `
      slug,
      name,
      description,
      allergens,
      allergens_notes,
      product_variants ( id, name, price, stock ),
      product_images ( url, alt_text, is_main )
    `
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .eq('product_variants.is_active', true)
    .order('sort_order', { referencedTable: 'product_variants' })
    .order('is_main', { referencedTable: 'product_images', ascending: false })
    .order('sort_order', { referencedTable: 'product_images' })
    .maybeSingle();

  if (error || !data) return null;

  const row = data as unknown as ProductDetailRow;

  return {
    slug: row.slug,
    name: row.name,
    description: row.description,
    allergens: row.allergens ?? [],
    allergensNotes: row.allergens_notes,
    images: row.product_images.map((image) => ({
      url: image.url,
      altText: image.alt_text,
      isMain: image.is_main,
    })),
    variants: row.product_variants,
  };
});
