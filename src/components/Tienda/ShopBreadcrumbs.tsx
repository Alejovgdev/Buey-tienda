import Link from 'next/link';
import { breadcrumbJsonLd, type BreadcrumbItem } from '@/lib/structured-data';
import JsonLd from '@/components/Seo/JsonLd';

export default function ShopBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length < 2) return null;
  return (
    <>
      <JsonLd id="breadcrumb-jsonld" data={breadcrumbJsonLd(items)} />
      <nav aria-label="Ruta de navegación" className="mb-6 text-sm text-white/60">
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {items.map((item, index) => (
            <li key={item.path} className="inline-flex items-center gap-2">
              {index > 0 && <span aria-hidden="true">›</span>}
              {index === items.length - 1
                ? <span aria-current="page">{item.name}</span>
                : <Link href={item.path} className="transition-colors hover:text-amber-400">{item.name}</Link>}
            </li>
          ))}
        </ol>
      </nav>
    </>
  );
}
