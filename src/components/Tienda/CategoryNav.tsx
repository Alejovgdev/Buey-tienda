import Link from 'next/link';
import type { CategorySummary } from '@/types/shop';

interface CategoryNavProps {
  categories: CategorySummary[];
  activeSlug?: string;
}

export default function CategoryNav({ categories, activeSlug }: CategoryNavProps) {
  if (categories.length === 0) return null;

  return (
    <nav className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      <Link
        href="/tienda"
        className={`shrink-0 rounded-full border px-5 py-2 text-sm font-semibold uppercase tracking-wide transition-colors duration-200 ${
          !activeSlug
            ? 'border-amber-500 bg-amber-500 text-[#1a1410]'
            : 'border-white/15 text-white/70 hover:border-amber-500/60 hover:text-amber-400'
        }`}
      >
        Todo
      </Link>
      {categories.map((category) => {
        const isActive = category.slug === activeSlug;
        return (
          <Link
            key={category.id}
            href={`/tienda/${category.slug}`}
            className={`shrink-0 rounded-full border px-5 py-2 text-sm font-semibold uppercase tracking-wide transition-colors duration-200 ${
              isActive
                ? 'border-amber-500 bg-amber-500 text-[#1a1410]'
                : 'border-white/15 text-white/70 hover:border-amber-500/60 hover:text-amber-400'
            }`}
          >
            {category.name}
          </Link>
        );
      })}
    </nav>
  );
}
