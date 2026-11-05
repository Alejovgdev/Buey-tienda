import { NextResponse } from 'next/server';
import { cartReviewRequestSchema } from '@/lib/checkout-schema';
import { getCheckoutAvailability } from '@/lib/checkout-availability';

export const dynamic = 'force-dynamic';
export const preferredRegion = 'cdg1';

export async function POST(request: Request) {
  const parsed = cartReviewRequestSchema.safeParse(await request.json().catch(() => null));
  const headers = { 'Cache-Control': 'no-store' };
  if (!parsed.success) {
    return NextResponse.json({ error: 'DATOS_INVALIDOS', message: 'Revisa los productos y cantidades de tu carrito.' }, { status: 400, headers });
  }
  const result = await getCheckoutAvailability(parsed.data.items);
  return result.ok
    ? NextResponse.json(result.review, { headers })
    : NextResponse.json(result.error, { status: result.status, headers });
}
