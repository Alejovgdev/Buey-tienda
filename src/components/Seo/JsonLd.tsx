import { serializeJsonLd, type JsonLdData } from '@/lib/structured-data';

export default function JsonLd({ id, data }: { id: string; data: JsonLdData | null }) {
  if (!data) return null;
  return <script id={id} type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}
