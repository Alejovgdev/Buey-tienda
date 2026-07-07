'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { customerDataSchema, type CustomerData } from '@/lib/checkout-schema';

interface CheckoutFormProps {
  disabled: boolean;
  submitting: boolean;
  errorMessage: string | null;
  onSubmit: (data: CustomerData) => void;
}

type FormState = {
  customerName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  shippingStreet: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode: string;
  shippingNotes: string;
  acceptTerms: boolean;
};

const initialState: FormState = {
  customerName: '',
  customerLastName: '',
  customerEmail: '',
  customerPhone: '',
  shippingStreet: '',
  shippingCity: '',
  shippingProvince: '',
  shippingPostalCode: '',
  shippingNotes: '',
  acceptTerms: false,
};

const inputClass =
  'w-full rounded-xl border border-white/15 bg-black/30 px-4 py-2.5 text-sm text-white placeholder:text-white/30 outline-none transition-colors duration-200 focus:border-amber-500/60 disabled:cursor-not-allowed disabled:opacity-50';
const labelClass = 'mb-1.5 block text-sm font-medium text-white/80';

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="mt-1 text-xs text-red-400">{messages[0]}</p>;
}

export default function CheckoutForm({
  disabled,
  submitting,
  errorMessage,
  onSubmit,
}: CheckoutFormProps) {
  const [form, setForm] = useState<FormState>(initialState);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const result = customerDataSchema.safeParse({
      ...form,
      shippingNotes: form.shippingNotes.trim() || undefined,
    });

    if (!result.success) {
      setFieldErrors(result.error.flatten().fieldErrors as Record<string, string[]>);
      return;
    }

    setFieldErrors({});
    onSubmit(result.data);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 rounded-2xl border border-white/10 bg-white/5 p-6"
    >
      <div>
        <h2 className="text-lg font-bold text-white">Tus datos</h2>
        <p className="mt-1 text-sm text-white/50">
          Los usaremos para preparar y enviarte el pedido.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="customerName">
            Nombre
          </label>
          <input
            id="customerName"
            className={inputClass}
            disabled={disabled}
            value={form.customerName}
            onChange={(e) => update('customerName', e.target.value)}
          />
          <FieldError messages={fieldErrors.customerName} />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerLastName">
            Apellidos
          </label>
          <input
            id="customerLastName"
            className={inputClass}
            disabled={disabled}
            value={form.customerLastName}
            onChange={(e) => update('customerLastName', e.target.value)}
          />
          <FieldError messages={fieldErrors.customerLastName} />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerEmail">
            Email
          </label>
          <input
            id="customerEmail"
            type="email"
            className={inputClass}
            disabled={disabled}
            value={form.customerEmail}
            onChange={(e) => update('customerEmail', e.target.value)}
          />
          <FieldError messages={fieldErrors.customerEmail} />
        </div>
        <div>
          <label className={labelClass} htmlFor="customerPhone">
            Teléfono
          </label>
          <input
            id="customerPhone"
            type="tel"
            className={inputClass}
            disabled={disabled}
            value={form.customerPhone}
            onChange={(e) => update('customerPhone', e.target.value)}
          />
          <FieldError messages={fieldErrors.customerPhone} />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
          Dirección de envío
        </h3>
        <p className="mt-1 text-sm text-white/50">
          Enviamos únicamente a España peninsular. La entrega se realiza en 24-48 h desde el
          pedido; si compras de viernes a domingo, lo prepararemos el lunes.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="shippingStreet">
            Calle y número
          </label>
          <input
            id="shippingStreet"
            className={inputClass}
            disabled={disabled}
            value={form.shippingStreet}
            onChange={(e) => update('shippingStreet', e.target.value)}
          />
          <FieldError messages={fieldErrors.shippingStreet} />
        </div>
        <div>
          <label className={labelClass} htmlFor="shippingPostalCode">
            Código postal
          </label>
          <input
            id="shippingPostalCode"
            className={inputClass}
            disabled={disabled}
            value={form.shippingPostalCode}
            onChange={(e) => update('shippingPostalCode', e.target.value)}
          />
          <FieldError messages={fieldErrors.shippingPostalCode} />
        </div>
        <div>
          <label className={labelClass} htmlFor="shippingCity">
            Ciudad
          </label>
          <input
            id="shippingCity"
            className={inputClass}
            disabled={disabled}
            value={form.shippingCity}
            onChange={(e) => update('shippingCity', e.target.value)}
          />
          <FieldError messages={fieldErrors.shippingCity} />
        </div>
        <div>
          <label className={labelClass} htmlFor="shippingProvince">
            Provincia
          </label>
          <input
            id="shippingProvince"
            className={inputClass}
            disabled={disabled}
            value={form.shippingProvince}
            onChange={(e) => update('shippingProvince', e.target.value)}
          />
          <FieldError messages={fieldErrors.shippingProvince} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="shippingNotes">
            Observaciones (opcional)
          </label>
          <textarea
            id="shippingNotes"
            rows={3}
            className={inputClass}
            disabled={disabled}
            value={form.shippingNotes}
            onChange={(e) => update('shippingNotes', e.target.value)}
          />
          <FieldError messages={fieldErrors.shippingNotes} />
        </div>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-white/70">
          <input
            type="checkbox"
            disabled={disabled}
            checked={form.acceptTerms}
            onChange={(e) => update('acceptTerms', e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-white/30 bg-black/30 accent-amber-500"
          />
          <span>
            He leído y acepto el{' '}
            <Link href="/aviso-legal" className="text-amber-400 underline hover:text-amber-300">
              aviso legal
            </Link>{' '}
            y la{' '}
            <Link
              href="/politica-de-privacidad"
              className="text-amber-400 underline hover:text-amber-300"
            >
              política de privacidad
            </Link>
            .
          </span>
        </label>
        <FieldError messages={fieldErrors.acceptTerms} />
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {errorMessage}
        </div>
      )}

      <button
        type="submit"
        disabled={disabled || submitting}
        className="w-full rounded-full border border-transparent bg-amber-500 px-6 py-3 font-semibold text-[#1a1410] transition-colors duration-200 hover:border-amber-500 hover:bg-[#1a1410] hover:text-amber-500 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-amber-500 disabled:hover:text-[#1a1410]"
      >
        {submitting ? 'Procesando…' : 'Pagar con tarjeta'}
      </button>
    </form>
  );
}
