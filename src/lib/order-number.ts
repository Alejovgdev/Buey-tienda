import 'server-only';
import { supabaseAdmin } from './supabase-admin';

// Fase 4, Unidad 2. Generación atómica vía RPC (secuencia de Postgres) — nunca
// contar filas en JS antes del INSERT, sería una condición de carrera real.
export async function generateOrderNumber(): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc('generate_order_number');
  if (error || !data) {
    throw new Error('No se pudo generar el número de pedido');
  }
  return data;
}
