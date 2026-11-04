'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal, flushSync } from 'react-dom';
import Link from 'next/link';
import type { BoxLabelPreview } from '@/lib/box-label/schema';
import { DEFAULT_BOX_LABEL_PAPER, lineText, type BoxLabelPaper, type BoxLabelSheet } from '@/lib/box-label/pagination';
import { measureBoxLabel, verifyBoxLabelLayout, waitForBoxLabelResources } from '@/lib/box-label/print-layout';
import { prepareThermalLogo } from '@/lib/box-label/thermal-logo';
import BoxLabelTicket from './BoxLabelTicket';

const FRAME_DOCUMENT = '<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Etiqueta de caja</title></head><body></body></html>';

export default function BoxLabelClient({ orderId, initial }: { orderId: string; initial: BoxLabelPreview }) {
  const [preview, setPreview] = useState(initial);
  const [giftIds, setGiftIds] = useState(initial.gifts.filter((gift) => gift.included).map((gift) => gift.id));
  const [paper, setPaper] = useState<BoxLabelPaper>(DEFAULT_BOX_LABEL_PAPER);
  const [frameDocument, setFrameDocument] = useState<Document | null>(null);
  const [sheets, setSheets] = useState<BoxLabelSheet[] | null>(null);
  const [thermalLogo, setThermalLogo] = useState<string>();
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const frame = useRef<HTMLIFrameElement>(null);
  const dirty = preview.gifts.some((gift) => gift.included !== giftIds.includes(gift.id));

  useEffect(() => {
    if (!frameDocument) return;
    let cancelled = false;
    setReady(false);
    setSheets(null);
    setError('');
    async function layout() {
      try {
        const logo = await prepareThermalLogo(preview.snapshot.logoDataUrl, frameDocument!);
        if (cancelled) return;
        // El portal debe contener el recurso definitivo antes de medirlo.
        // Estas confirmaciones de render ocurren después de un await, fuera
        // del ciclo de efectos de React.
        flushSync(() => { setThermalLogo(logo); setSheets(null); });
        await waitForBoxLabelResources(frameDocument!);
        if (cancelled) return;
        const pages = measureBoxLabel(frameDocument!, preview.snapshot, paper);
        flushSync(() => setSheets(pages));
        // Esperar otra vez: la paginación añade logos y cambia las filas y
        // contadores. La primera espera no cubre este segundo render.
        await waitForBoxLabelResources(frameDocument!);
        if (cancelled) return;
        verifyBoxLabelLayout(frameDocument!, pages);
        setReady(true);
      } catch {
        if (!cancelled) setError('No se pudo preparar el ticket. Comprueba el logo o aumenta la longitud del papel.');
      }
    }
    void layout();
    return () => { cancelled = true; };
  }, [frameDocument, preview.snapshot, paper]);

  async function updateGifts() {
    setBusy(true); setError(''); setMessage(''); setAwaitingConfirmation(false);
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/etiqueta-caja`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ includedGiftIds: giftIds }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudo actualizar la vista previa');
      setReady(false);
      setPreview(data);
      setGiftIds((data as BoxLabelPreview).gifts.filter((gift) => gift.included).map((gift) => gift.id));
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'No se pudo actualizar la vista previa');
    } finally { setBusy(false); }
  }

  async function print() {
    if (!ready || dirty || !frameDocument || busy) return;
    setBusy(true); setError(''); setMessage('');
    try {
      await waitForBoxLabelResources(frameDocument);
      verifyBoxLabelLayout(frameDocument, sheets!);
      const target = frame.current!.contentWindow!;
      target.focus();
      target.print();
      // Ni abrir ni cerrar el diálogo registra nada. Esta pregunta requiere
      // siempre una acción explícita del trabajador, para todas las páginas.
      setAwaitingConfirmation(true);
    } catch { setError('No se pudo abrir la impresión. Vuelve a intentarlo.'); }
    finally { setBusy(false); }
  }

  async function confirm() {
    if (busy) return;
    if (preview.confirmedAt) {
      setAwaitingConfirmation(false); setMessage('Reimpresión confirmada. Se conserva la copia original.'); return;
    }
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/etiqueta-caja/confirmar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ draftToken: preview.draftToken }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? 'No se pudo confirmar la impresión');
      setPreview((current) => ({ ...current, confirmedAt: data.confirmedAt, draftToken: null, gifts: [] }));
      setAwaitingConfirmation(false); setMessage('Impresión confirmada. Esta copia se utilizará para las reimpresiones.');
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'No se pudo confirmar la impresión'); }
    finally { setBusy(false); }
  }

  const renderedSheets = sheets ?? [{
    heightMm: paper.maxHeightMm,
    fragments: preview.snapshot.lines.map((line) => ({ line, text: lineText(line), continued: false })),
  }];

  return <div className="mx-auto max-w-3xl space-y-4 px-4 py-6 text-gray-900">
    <Link href={`/admin/pedidos/${orderId}`} className="text-sm text-blue-700 hover:underline">← Volver al pedido</Link>
    <h1 className="text-xl font-bold">Etiqueta de caja · {preview.snapshot.orderNumber}</h1>
    <p className="text-sm">{preview.confirmedAt
      ? `Copia guardada. Preparado por: ${preview.snapshot.preparedBy}. Las reimpresiones conservan este contenido.`
      : `Vista previa preparada por ${preview.snapshot.preparedBy}. Solo se guardará cuando confirmes una impresión correcta.`}</p>

    {preview.gifts.length > 0 && <fieldset className="space-y-2 rounded border border-gray-300 bg-white p-4" disabled={busy || awaitingConfirmation}>
      <legend className="font-semibold">Regalos que van en esta caja</legend>
      {preview.gifts.map((gift) => <label key={gift.id} className="block text-sm">
        <input type="checkbox" checked={giftIds.includes(gift.id)} onChange={(event) => {
          setGiftIds((current) => event.target.checked ? [...current, gift.id] : current.filter((id) => id !== gift.id));
          setMessage('');
        }} />{' '}{gift.productName} · {gift.variantName} × {gift.quantity}
        {gift.pendingStock && <span className="block text-amber-800">Se registró falta de stock. Inclúyelo solo si lo has añadido físicamente; la obligación de entrega sigue en las incidencias del pedido.</span>}
      </label>)}
      {dirty && <button onClick={updateGifts} disabled={busy} className="rounded bg-gray-900 px-3 py-2 text-sm text-white">Actualizar vista previa</button>}
    </fieldset>}

    <fieldset className="flex flex-wrap gap-4 rounded border border-gray-300 bg-white p-4 text-sm" disabled={busy || awaitingConfirmation}>
      <legend className="font-semibold">Papel de 80 mm · Qian Anjet 80 Ultra</legend>
      <label>Longitud <select value={paper.mode} onChange={(event) => {
        setReady(false); setPaper((current) => ({ ...current, mode: event.target.value as BoxLabelPaper['mode'] }));
      }} className="ml-2 rounded border p-1">
        <option value="content">Ajustar al contenido</option><option value="fixed">Páginas de longitud fija</option>
      </select></label>
      <label>{paper.mode === 'fixed' ? 'Longitud por página' : 'Longitud máxima por página'} (mm)
        <input type="number" min="80" max="1000" step="1" value={paper.maxHeightMm} onChange={(event) => {
          setReady(false); setPaper((current) => ({ ...current, maxHeightMm: Math.max(80, Math.min(1000, Math.round(Number(event.target.value) || 210))) }));
        }} className="ml-2 w-20 rounded border p-1" />
      </label>
    </fieldset>
    <p className="text-sm">POS-80-Series: Thermal Paper (80 × 210), orientación vertical, una página por hoja,
      márgenes «Ninguno», escala personalizada 100 % y encabezados/pies desactivados.
      Usa el botón Imprimir para imprimir solo el ticket, desde el margen superior.</p>
    <p className="text-sm">«Ajustar al contenido» calcula la longitud necesaria, pero no cambia el papel del controlador.
      Para gastar menos papel, crea y selecciona un formulario de 80 mm con la longitud calculada si el controlador lo admite.
      Si solo ofrece 80 × 210, quedará papel sobrante al final; puedes usar páginas de longitud fija a 210 mm.
      La longitud máxima de la aplicación no debe superar la del papel seleccionado.</p>
    {sheets && <p className="text-sm">{sheets.length} página(s): {sheets.map((sheet) => `${sheet.heightMm} mm`).join(', ')}.
      {paper.mode === 'content' && ' Longitudes calculadas de contenido; el papel físico se elige en el diálogo.'} Contenido de 68 mm de ancho.</p>}
    <button type="button" onClick={print} disabled={!ready || busy || dirty || awaitingConfirmation}
      className="rounded bg-gray-900 px-4 py-2 font-semibold text-white disabled:opacity-50">
      {preview.confirmedAt ? 'Reimprimir' : 'Imprimir'}
    </button>
    {dirty && <p className="text-sm text-amber-800">Actualiza la vista previa para aplicar la selección de regalos antes de imprimir.</p>}
    {awaitingConfirmation && <div className="space-y-3 rounded border-2 border-gray-600 bg-white p-4">
      <p>¿Se han impreso correctamente todas las páginas?</p>
      <button onClick={confirm} disabled={busy} className="mr-3 rounded bg-green-800 px-3 py-2 text-white disabled:opacity-50">Sí, confirmar impresión</button>
      <button onClick={() => { setAwaitingConfirmation(false); setMessage('No se ha registrado ninguna impresión nueva.'); }} disabled={busy} className="rounded border px-3 py-2">No confirmar</button>
    </div>}
    {message && <p role="status" className="text-sm text-green-800">{message}</p>}
    {error && <div role="alert" className="text-sm text-red-800">{error}{' '}<button onClick={() => window.location.reload()} className="underline">Recargar vista previa</button></div>}
    {!ready && !error && <p role="status">Preparando logo, fuentes y paginación…</p>}
    <iframe ref={frame} title="Vista previa imprimible de la etiqueta de caja" srcDoc={FRAME_DOCUMENT}
      sandbox="allow-same-origin allow-modals" onLoad={() => setFrameDocument(frame.current!.contentDocument)}
      className="block max-w-full border-0 bg-white" style={{ width: '80mm', height: `${renderedSheets.reduce((sum, sheet) => sum + sheet.heightMm, 0) + renderedSheets.length * 3}mm` }} />
    {frameDocument && createPortal(<BoxLabelTicket snapshot={preview.snapshot} sheets={renderedSheets} logoDataUrl={thermalLogo} />, frameDocument.body)}
  </div>;
}
