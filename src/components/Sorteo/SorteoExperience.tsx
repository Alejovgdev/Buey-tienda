'use client';

import Image from 'next/image';
import { FormEvent, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';

type SubscribeFormState = {
  nombre: string;
  email: string;
  aceptaCondi: boolean;
};

type UnsubscribeFormState = {
  email: string;
  confirmaBaja: boolean;
};

type SubmitState = 'idle' | 'submitting' | 'success' | 'error';
type SubscribeFieldErrors = Partial<Record<keyof SubscribeFormState, string>>;
type UnsubscribeFieldErrors = Partial<
  Record<keyof UnsubscribeFormState, string>
>;

const initialSubscribeFormState: SubscribeFormState = {
  nombre: '',
  email: '',
  aceptaCondi: false,
};

const initialUnsubscribeFormState: UnsubscribeFormState = {
  email: '',
  confirmaBaja: false,
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const inputBaseClasses =
  'w-full rounded-lg border bg-black/45 px-4 py-3 text-white placeholder:text-white/40 transition focus:outline-none';
const checkboxClasses =
  'mt-1 h-5 w-5 shrink-0 rounded border-white/20 accent-amber-500';

function validateSubscription(form: SubscribeFormState): SubscribeFieldErrors {
  const errors: SubscribeFieldErrors = {};

  if (!form.nombre.trim()) {
    errors.nombre = 'Indica tu nombre para suscribirte.';
  }

  if (!form.email.trim()) {
    errors.email = 'Introduce un correo electrónico válido.';
  } else if (!emailRegex.test(form.email.trim())) {
    errors.email = 'Introduce un correo electrónico válido.';
  }

  if (!form.aceptaCondi) {
    errors.aceptaCondi =
      'Acepta las condiciones y la política de privacidad para recibir la newsletter.';
  }

  return errors;
}

function validateUnsubscribe(
  form: UnsubscribeFormState
): UnsubscribeFieldErrors {
  const errors: UnsubscribeFieldErrors = {};

  if (!form.email.trim()) {
    errors.email = 'Introduce el email que quieres dar de baja.';
  } else if (!emailRegex.test(form.email.trim())) {
    errors.email = 'Introduce un correo electrónico válido.';
  }

  if (!form.confirmaBaja) {
    errors.confirmaBaja = 'Confirma que quieres dejar de recibir emails.';
  }

  return errors;
}

export default function NewsletterExperience() {
  const [subscribeForm, setSubscribeForm] = useState<SubscribeFormState>(
    initialSubscribeFormState
  );
  const [unsubscribeForm, setUnsubscribeForm] =
    useState<UnsubscribeFormState>(initialUnsubscribeFormState);
  const [subscribeErrors, setSubscribeErrors] = useState<SubscribeFieldErrors>(
    {}
  );
  const [unsubscribeErrors, setUnsubscribeErrors] =
    useState<UnsubscribeFieldErrors>({});
  const [subscribeState, setSubscribeState] = useState<SubmitState>('idle');
  const [unsubscribeState, setUnsubscribeState] =
    useState<SubmitState>('idle');
  const [subscribeFeedback, setSubscribeFeedback] = useState('');
  const [unsubscribeFeedback, setUnsubscribeFeedback] = useState('');

  const isSubscribing = subscribeState === 'submitting';
  const isUnsubscribing = unsubscribeState === 'submitting';

  const subscribeHelperCopy = useMemo(() => {
    if (subscribeState === 'success' || subscribeState === 'error') {
      return subscribeFeedback;
    }

    return 'Sin ruido: solo descuentos, promociones.';
  }, [subscribeFeedback, subscribeState]);

  const updateSubscribeField = <K extends keyof SubscribeFormState>(
    key: K,
    value: SubscribeFormState[K]
  ) => {
    setSubscribeForm((current) => ({ ...current, [key]: value }));

    if (subscribeState !== 'submitting') {
      setSubscribeState('idle');
      setSubscribeFeedback('');
    }

    setSubscribeErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const updateUnsubscribeField = <K extends keyof UnsubscribeFormState>(
    key: K,
    value: UnsubscribeFormState[K]
  ) => {
    setUnsubscribeForm((current) => ({ ...current, [key]: value }));

    if (unsubscribeState !== 'submitting') {
      setUnsubscribeState('idle');
      setUnsubscribeFeedback('');
    }

    setUnsubscribeErrors((current) => {
      if (!current[key]) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  };

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedForm = {
      ...subscribeForm,
      nombre: subscribeForm.nombre.trim(),
      email: subscribeForm.email.trim(),
    };
    const errors = validateSubscription(trimmedForm);

    if (Object.keys(errors).length > 0) {
      setSubscribeErrors(errors);
      setSubscribeState('error');
      setSubscribeFeedback('Revisa los campos marcados para suscribirte.');
      return;
    }

    setSubscribeErrors({});
    setSubscribeState('submitting');
    setSubscribeFeedback('');

    try {
      const response = await fetch('/api/sorteo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: trimmedForm.nombre,
          email: trimmedForm.email,
          aceptaCondi: trimmedForm.aceptaCondi,
          suscrito: true,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error ??
            'No hemos podido completar tu suscripción. Inténtalo de nuevo en unos segundos.'
        );
      }

      setSubscribeState('success');
      setSubscribeFeedback(
        data?.message ??
          'Te has suscrito correctamente. Pronto recibirás descuentos y novedades en tu email.'
      );
      setSubscribeForm(initialSubscribeFormState);
    } catch (error) {
      setSubscribeState('error');
      setSubscribeFeedback(
        error instanceof Error
          ? error.message
          : 'No hemos podido completar tu suscripción ahora mismo.'
      );
    }
  };

  const handleUnsubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedForm = {
      ...unsubscribeForm,
      email: unsubscribeForm.email.trim(),
    };
    const errors = validateUnsubscribe(trimmedForm);

    if (Object.keys(errors).length > 0) {
      setUnsubscribeErrors(errors);
      setUnsubscribeState('error');
      setUnsubscribeFeedback('Revisa los campos marcados para confirmar la baja.');
      return;
    }

    setUnsubscribeErrors({});
    setUnsubscribeState('submitting');
    setUnsubscribeFeedback('');

    try {
      const response = await fetch('/api/sorteo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nombre: '',
          email: trimmedForm.email,
          aceptaCondi: trimmedForm.confirmaBaja,
          suscrito: false,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { error?: string; message?: string }
        | null;

      if (!response.ok) {
        throw new Error(
          data?.error ??
            'No hemos podido confirmar la baja. Inténtalo de nuevo en unos segundos.'
        );
      }

      setUnsubscribeState('success');
      setUnsubscribeFeedback(
        data?.message ??
          'Te has desuscrito correctamente. Ya no recibirás nuestras promociones por email.'
      );
      setUnsubscribeForm(initialUnsubscribeFormState);
    } catch (error) {
      setUnsubscribeState('error');
      setUnsubscribeFeedback(
        error instanceof Error
          ? error.message
          : 'No hemos podido confirmar la baja ahora mismo.'
      );
    }
  };

  return (
    <section className="relative isolate overflow-hidden bg-[#080502]">
      <Image
        src="/assets/images/carne3.jpeg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="absolute inset-0 -z-20 object-cover object-[center_70%] opacity-40"
      />
      <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,_rgba(5,3,1,0.96)_0%,_rgba(5,3,1,0.82)_48%,_rgba(5,3,1,0.56)_100%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/70 to-transparent" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-8 px-5 pb-20 pt-10 md:px-6 md:pb-24 md:pt-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
        <div className="space-y-7">
          <div className="space-y-5">
            <span className="inline-flex items-center rounded-full border border-amber-400/40 bg-black/35 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-amber-200 backdrop-blur">
              Club de descuentos · El Buey Madurado
            </span>

            <div className="space-y-4">
              <p className="inline-flex items-center rounded-lg border border-white/10 bg-white/10 px-3 py-2 text-sm font-semibold text-white/90 backdrop-blur">
                Newsletter privada para clientes
              </p>

              <h1 className="max-w-4xl text-4xl font-black leading-tight text-white md:text-6xl">
                Recibe descuentos en tu email
              </h1>

              <p className="max-w-2xl text-base leading-7 text-white/78 md:text-lg">
                Únete gratis al club y entérate antes de ofertas especiales,
                ventajas para suscriptores y novedades de El Buey Madurado.
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-amber-300/35 bg-amber-400/12 p-6 backdrop-blur">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-amber-200">
              Ventajas solo por email
            </p>
            <p className="mt-3 text-xl font-bold leading-8 text-white md:text-2xl">
              Promociones para reservar, volver y disfrutar de nuestras carnes
              con una ventaja extra.
            </p>
          </div>
        </div>

        <div className="rounded-lg border border-white/12 bg-[#120900]/92 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.42)] backdrop-blur md:p-7">
          <div className="space-y-6">
            <div className="space-y-3">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                Suscripción gratuita
              </p>
              <h2 className="text-2xl font-bold text-white md:text-3xl">
                Únete al club
              </h2>
              <p className="text-sm leading-6 text-white/65">
                Sencillo, deja tu nombre y email.
              </p>
            </div>

            <form className="space-y-5" onSubmit={handleSubscribe} noValidate>
              <div className="space-y-2">
                <label
                  htmlFor="newsletter-nombre"
                  className="text-sm font-semibold text-white/90"
                >
                  Nombre *
                </label>
                <input
                  id="newsletter-nombre"
                  name="nombre"
                  type="text"
                  autoComplete="name"
                  value={subscribeForm.nombre}
                  onChange={(event) =>
                    updateSubscribeField('nombre', event.target.value)
                  }
                  className={`${inputBaseClasses} ${
                    subscribeErrors.nombre
                      ? 'border-red-400/70 focus:border-red-300'
                      : 'border-white/10 focus:border-amber-400'
                  }`}
                  placeholder="Ejemplo: Juan Pérez"
                  disabled={isSubscribing}
                  aria-invalid={Boolean(subscribeErrors.nombre)}
                  aria-describedby={
                    subscribeErrors.nombre
                      ? 'newsletter-nombre-error'
                      : undefined
                  }
                />
                {subscribeErrors.nombre && (
                  <p
                    id="newsletter-nombre-error"
                    className="text-sm text-red-200"
                  >
                    {subscribeErrors.nombre}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="newsletter-email"
                  className="text-sm font-semibold text-white/90"
                >
                  Email *
                </label>
                <input
                  id="newsletter-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  value={subscribeForm.email}
                  onChange={(event) =>
                    updateSubscribeField('email', event.target.value)
                  }
                  className={`${inputBaseClasses} ${
                    subscribeErrors.email
                      ? 'border-red-400/70 focus:border-red-300'
                      : 'border-white/10 focus:border-amber-400'
                  }`}
                  placeholder="Ejemplo: juan@email.com"
                  disabled={isSubscribing}
                  aria-invalid={Boolean(subscribeErrors.email)}
                  aria-describedby={
                    subscribeErrors.email ? 'newsletter-email-error' : undefined
                  }
                />
                {subscribeErrors.email && (
                  <p id="newsletter-email-error" className="text-sm text-red-200">
                    {subscribeErrors.email}
                  </p>
                )}
              </div>

              <div className="rounded-lg border border-white/10 bg-black/22 p-5">
                <label className="flex items-start gap-3">
                  <input
                    name="aceptaCondi"
                    type="checkbox"
                    checked={subscribeForm.aceptaCondi}
                    onChange={(event) =>
                      updateSubscribeField('aceptaCondi', event.target.checked)
                    }
                    className={checkboxClasses}
                    disabled={isSubscribing}
                    aria-invalid={Boolean(subscribeErrors.aceptaCondi)}
                  />

                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-white/90">
                      Acepto recibir la newsletter y la política de privacidad *
                    </span>
                    <span className="block text-sm leading-6 text-white/60">
                      Recibirás descuentos, promociones y ventajas por email.
                      Podrás darte de baja cuando quieras.
                    </span>
                  </span>
                </label>

                {subscribeErrors.aceptaCondi && (
                  <p className="mt-3 text-sm text-red-200">
                    {subscribeErrors.aceptaCondi}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                disabled={isSubscribing}
                className="w-full justify-center py-3 text-base disabled:cursor-not-allowed disabled:opacity-70"
              >
                {isSubscribing
                  ? 'Suscribiendo...'
                  : 'Quiero recibir descuentos'}
              </Button>

              <div
                aria-live="polite"
                className={`rounded-lg border px-4 py-3 text-sm leading-6 ${
                  subscribeState === 'success'
                    ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                    : subscribeState === 'error'
                      ? 'border-red-400/30 bg-red-500/10 text-red-100'
                      : 'border-white/10 bg-white/5 text-white/65'
                }`}
              >
                {subscribeHelperCopy}
              </div>
            </form>

            <details className="group rounded-lg border border-white/10 bg-white/[0.04] p-4 text-white/70">
              <summary className="cursor-pointer list-none text-sm font-semibold text-white/80 transition hover:text-amber-200">
                ¿Quieres dejar de recibir emails?
              </summary>

              <form
                className="mt-4 space-y-4 border-t border-white/10 pt-4"
                onSubmit={handleUnsubscribe}
                noValidate
              >
                <div className="space-y-2">
                  <label
                    htmlFor="unsubscribe-email"
                    className="text-sm font-semibold text-white/85"
                  >
                    Email *
                  </label>
                  <input
                    id="unsubscribe-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    value={unsubscribeForm.email}
                    onChange={(event) =>
                      updateUnsubscribeField('email', event.target.value)
                    }
                    className={`${inputBaseClasses} ${
                      unsubscribeErrors.email
                        ? 'border-red-400/70 focus:border-red-300'
                        : 'border-white/10 focus:border-amber-400'
                    }`}
                    placeholder="tu@email.com"
                    disabled={isUnsubscribing}
                    aria-invalid={Boolean(unsubscribeErrors.email)}
                    aria-describedby={
                      unsubscribeErrors.email
                        ? 'unsubscribe-email-error'
                        : undefined
                    }
                  />
                  {unsubscribeErrors.email && (
                    <p
                      id="unsubscribe-email-error"
                      className="text-sm text-red-200"
                    >
                      {unsubscribeErrors.email}
                    </p>
                  )}
                </div>

                <label className="flex items-start gap-3">
                  <input
                    name="confirmaBaja"
                    type="checkbox"
                    checked={unsubscribeForm.confirmaBaja}
                    onChange={(event) =>
                      updateUnsubscribeField('confirmaBaja', event.target.checked)
                    }
                    className={checkboxClasses}
                    disabled={isUnsubscribing}
                    aria-invalid={Boolean(unsubscribeErrors.confirmaBaja)}
                  />

                  <span className="space-y-1">
                    <span className="block text-sm font-semibold text-white/85">
                      Confirmo que quiero darme de baja *
                    </span>
                    <span className="block text-sm leading-6 text-white/55">
                      Dejaremos de enviarte promociones por email.
                    </span>
                  </span>
                </label>

                {unsubscribeErrors.confirmaBaja && (
                  <p className="text-sm text-red-200">
                    {unsubscribeErrors.confirmaBaja}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  disabled={isUnsubscribing}
                  className="w-full justify-center py-3 text-sm disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isUnsubscribing ? 'Confirmando baja...' : 'Confirmar baja'}
                </Button>

                {unsubscribeState !== 'idle' && (
                  <div
                    aria-live="polite"
                    className={`rounded-lg border px-4 py-3 text-sm leading-6 ${
                      unsubscribeState === 'success'
                        ? 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100'
                        : unsubscribeState === 'error'
                          ? 'border-red-400/30 bg-red-500/10 text-red-100'
                          : 'border-white/10 bg-white/5 text-white/65'
                    }`}
                  >
                    {unsubscribeFeedback}
                  </div>
                )}
              </form>
            </details>
          </div>
        </div>
      </div>
    </section>
  );
}
