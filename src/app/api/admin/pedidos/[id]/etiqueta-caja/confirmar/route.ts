import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { confirmBoxLabelSchema } from '@/lib/box-label/schema';
import { verifyBoxLabelDraft } from '@/lib/box-label/draft';
import type { Json, Tables } from '@/supabase/types';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const body = confirmBoxLabelSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Vista previa no válida' }, { status: 400 });
  let draft;
  try {
    draft = await verifyBoxLabelDraft(body.data.draftToken, id, session);
  } catch {
    return NextResponse.json({ error: 'La vista previa ha caducado o no pertenece a esta sesión. Vuelve a abrirla e imprime de nuevo.' }, { status: 403 });
  }

  // Se inserta EXACTAMENTE el contenido firmado antes de imprimir: ninguna
  // consulta a líneas, catálogo, trabajador actual o incidencias lo reconstruye.
  const { data, error } = await supabaseAdmin.from('order_box_labels').insert({
    order_id: id, draft_id: draft.draftId, snapshot: draft.snapshot as unknown as Json, confirmed_session_id: session.sid,
  }).select('confirmed_at').single<{ confirmed_at: string }>();
  if (!error && data) return NextResponse.json({ ok: true, confirmedAt: data.confirmed_at });
  if (error?.code === '23505') {
    const { data: saved, error: readError } = await supabaseAdmin.from('order_box_labels')
      .select('draft_id, confirmed_at').eq('order_id', id)
      .maybeSingle<Pick<Tables<'order_box_labels'>, 'draft_id' | 'confirmed_at'>>();
    if (!readError && saved) {
      if (saved.draft_id === draft.draftId) return NextResponse.json({ ok: true, confirmedAt: saved.confirmed_at });
      return NextResponse.json({ error: 'Otra impresión ya confirmó una copia distinta. Recarga para reimprimir la copia guardada.' }, { status: 409 });
    }
  }
  return NextResponse.json({ error: 'No se pudo guardar la impresión. Puedes reintentar la confirmación sin volver a imprimir.' }, { status: 503 });
}
