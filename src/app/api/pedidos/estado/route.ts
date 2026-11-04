import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { OrderStatusResponse } from '@/types/checkout';

// Fase 4, Unidad 4. `orders` no tiene politica publica (solo service_role),
// asi que el polling de la pagina de confirmacion pasa por aqui. Nunca se
// devuelve PII (nombre, email, telefono, direccion) - order_number es
// enumerable, asi que la respuesta se limita a lo estrictamente necesario
// para pintar el estado.
export const dynamic = 'force-dynamic';

// Region fijada en codigo ademas de en vercel.json: aunque la respuesta no
// devuelve PII, la consulta si lee la fila del pedido. La Politica de
// Privacidad afirma que Vercel trata los datos dentro del EEE. cdg1 = Paris.
export const preferredRegion = 'cdg1';

export async function GET(request: Request) {
  const orderNumber = new URL(request.url).searchParams.get('order');

  if (!orderNumber) {
    return NextResponse.json({ error: 'PEDIDO_NO_ENCONTRADO' }, { status: 404 });
  }

  const { data: order, error } = await supabaseAdmin
    .from('orders')
    .select('order_number, status')
    .eq('order_number', orderNumber)
    .maybeSingle();

  if (error || !order) {
    return NextResponse.json({ error: 'PEDIDO_NO_ENCONTRADO' }, { status: 404 });
  }

  const response: OrderStatusResponse = {
    orderNumber: order.order_number,
    status: order.status,
  };

  return NextResponse.json(response);
}
