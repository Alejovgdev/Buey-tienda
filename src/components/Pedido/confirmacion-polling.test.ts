import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfirmacionEstado } from './ConfirmacionPolling';
import {
  MAX_POLL_ATTEMPTS,
  MAX_WAIT_MS,
  POLL_INTERVAL_MS,
  WAIT_MESSAGE_AFTER_MS,
  startConfirmationPolling,
  type ConfirmationState,
} from './confirmacion-polling';

const orderNumber = 'BM-2026-00123';
const fetchMock = vi.fn<typeof fetch>();
const onState = vi.fn<(state: ConfirmationState) => void>();
const response = (status: string) => Response.json({ orderNumber, status });
const markup = (state: ConfirmationState) => renderToStaticMarkup(
  createElement(ConfirmacionEstado, { orderNumber, state }),
);
const signal = () => fetchMock.mock.calls[0][1]!.signal!;
const flush = () => vi.advanceTimersByTimeAsync(0);

beforeEach(() => {
  vi.useFakeTimers();
  fetchMock.mockReset();
  onState.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('resultados de la confirmación', () => {
  it.each([
    ['PAID', '¡Gracias por tu pedido!', 'Tu pago está confirmado'],
    ['PREPARING', 'Estamos preparando tu pedido', 'ya hemos empezado a prepararlo'],
    ['PAYMENT_FAILED', 'El pago no se ha completado', 'Si ves un cargo o tienes dudas'],
    ['CANCELLED', 'Tu pedido está cancelado', 'Si se ha realizado un cargo'],
    ['STOCK_ERROR', 'Hay una incidencia de disponibilidad', 'El pago podría haberse cobrado'],
    ['NEEDS_REVIEW', 'Tu pedido necesita revisión', 'podría haberse cobrado'],
  ])('%s muestra su mensaje y detiene todas las consultas', async (status, title, detail) => {
    fetchMock.mockResolvedValue(response(status));
    startConfirmationPolling(orderNumber, onState);
    await flush();

    const state = onState.mock.lastCall![0];
    expect(state).toEqual({ kind: 'result', status });
    const html = markup(state);
    expect(html).toContain(title);
    expect(html).toContain(detail);
    expect(html).toContain(orderNumber);
    expect(html).not.toContain('confirmando el pago');
    expect(html).not.toMatch(/<a\b|<button\b/);
    expect(signal().aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledTimes(2);
  });

  it('solo espera por PENDING_PAYMENT y permite una confirmación posterior', async () => {
    fetchMock.mockResolvedValueOnce(response('PENDING_PAYMENT'))
      .mockResolvedValueOnce(response('PREPARING'));
    startConfirmationPolling(orderNumber, onState);
    await flush();
    expect(onState).toHaveBeenLastCalledWith({ kind: 'waiting', delayed: false });
    expect(fetchMock).toHaveBeenCalledWith(
      `/api/pedidos/estado?order=${orderNumber}`,
      expect.objectContaining({ cache: 'no-store', signal: expect.any(AbortSignal) }),
    );
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(onState).toHaveBeenLastCalledWith({ kind: 'result', status: 'PREPARING' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un 404 muestra una salida prudente y detiene las consultas', async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 404 }));
    startConfirmationPolling(orderNumber, onState);
    await flush();
    expect(onState).toHaveBeenLastCalledWith({ kind: 'not-found' });
    expect(markup(onState.mock.lastCall![0])).toContain('No hemos encontrado tu pedido');
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([
    { orderNumber, status: 'DESCONOCIDO' },
    { orderNumber, status: 'toString' },
    { orderNumber },
    { orderNumber: 'OTRO-PEDIDO', status: 'PAID' },
    null,
  ])('una respuesta inesperada no confirma ni espera indefinidamente: %j', async (data) => {
    fetchMock.mockResolvedValue(Response.json(data));
    startConfirmationPolling(orderNumber, onState);
    await flush();
    expect(onState).toHaveBeenLastCalledWith({ kind: 'unavailable' });
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe('límites y errores de consulta', () => {
  it.each(['pendiente', 'red', 'HTTP', 'JSON'])('limita a 30 consultas incluso con %s', async (mode) => {
    fetchMock.mockImplementation(async () => {
      if (mode === 'red') throw new TypeError('Sin red');
      if (mode === 'HTTP') return new Response(null, { status: 503 });
      if (mode === 'JSON') return new Response('JSON inválido');
      return response('PENDING_PAYMENT');
    });
    startConfirmationPolling(orderNumber, onState);
    await vi.advanceTimersByTimeAsync(WAIT_MESSAGE_AFTER_MS - 1);
    expect(onState).not.toHaveBeenCalledWith({ kind: 'waiting', delayed: true });
    await vi.advanceTimersByTimeAsync(1);
    expect(onState).toHaveBeenLastCalledWith({ kind: 'waiting', delayed: true });
    expect(markup(onState.mock.lastCall![0])).toContain('tardando más de lo habitual');

    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(MAX_POLL_ATTEMPTS);
    expect(onState).toHaveBeenLastCalledWith({ kind: 'timeout' });
    expect(signal().aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un fallo transitorio permite recuperar el resultado sin interpretar un HTTP fallido como éxito', async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ orderNumber, status: 'PAID' }, { status: 500 }))
      .mockResolvedValueOnce(response('PAID'));
    startConfirmationPolling(orderNumber, onState);
    await flush();
    expect(onState).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(onState).toHaveBeenLastCalledWith({ kind: 'result', status: 'PAID' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['fetch', 'JSON'])('avisa y termina a los 60 segundos aunque %s no responda', async (phase) => {
    let resolveLate!: (value: Response) => void;
    let resolveBody!: (value: unknown) => void;
    if (phase === 'fetch') {
      fetchMock.mockReturnValue(new Promise<Response>((resolve) => { resolveLate = resolve; }));
    } else {
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => new Promise((resolve) => { resolveBody = resolve; }),
      } as Response);
    }
    startConfirmationPolling(orderNumber, onState);
    await vi.advanceTimersByTimeAsync(WAIT_MESSAGE_AFTER_MS);
    expect(onState).toHaveBeenLastCalledWith({ kind: 'waiting', delayed: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS - WAIT_MESSAGE_AFTER_MS);
    expect(onState).toHaveBeenLastCalledWith({ kind: 'timeout' });
    expect(signal().aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);

    // Incluso un transporte que ignore abort no puede sobrescribir la salida.
    if (phase === 'fetch') resolveLate(response('PAID'));
    else resolveBody({ orderNumber, status: 'PAID' });
    await flush();
    expect(onState).toHaveBeenLastCalledWith({ kind: 'timeout' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    { kind: 'waiting', delayed: true },
    { kind: 'not-found' },
    { kind: 'timeout' },
    { kind: 'unavailable' },
  ] satisfies ConfirmationState[])('la salida incierta %j advierte de un posible cargo', (state) => {
    const html = markup(state).toLowerCase();
    expect(html).toContain('podría haberse cobrado');
    expect(html).toContain('no repitas el pago');
    expect(html).toContain('contacta con nosotros');
    expect(html).toContain(orderNumber.toLowerCase());
    expect(html).not.toMatch(/<a\b|<button\b/);
  });
});

describe('salida de la pantalla', () => {
  it('el cleanup elimina la siguiente consulta y todos los avisos', async () => {
    fetchMock.mockResolvedValue(response('PENDING_PAYMENT'));
    const stop = startConfirmationPolling(orderNumber, onState);
    await flush();
    stop();
    stop();
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS * 2);
    expect(signal().aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(onState).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(['PAID', '404', 'error'])('ignora una respuesta %s tras abandonar la pantalla', async (status) => {
    let resolveLate!: (value: Response) => void;
    let rejectLate!: (reason: Error) => void;
    fetchMock.mockReturnValue(new Promise<Response>((resolve, reject) => {
      resolveLate = resolve;
      rejectLate = reject;
    }));
    const stop = startConfirmationPolling(orderNumber, onState);
    stop();
    if (status === 'error') rejectLate(new Error('Abortado'));
    else resolveLate(status === '404' ? new Response(null, { status: 404 }) : response(status));
    await vi.advanceTimersByTimeAsync(MAX_WAIT_MS * 2);
    expect(signal().aborted).toBe(true);
    expect(onState).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('un cambio de pedido impide que la respuesta del anterior confirme el nuevo', async () => {
    let resolveOld!: (value: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveOld = resolve; }))
      .mockResolvedValueOnce(Response.json({ orderNumber: 'OTRO-PEDIDO', status: 'NEEDS_REVIEW' }));
    const stop = startConfirmationPolling(orderNumber, onState);
    stop();
    startConfirmationPolling('OTRO-PEDIDO', onState);
    await flush();
    resolveOld(response('PAID'));
    await flush();
    expect(onState).toHaveBeenLastCalledWith({ kind: 'result', status: 'NEEDS_REVIEW' });
    expect(onState).not.toHaveBeenCalledWith({ kind: 'result', status: 'PAID' });
    expect(vi.getTimerCount()).toBe(0);
  });
});
