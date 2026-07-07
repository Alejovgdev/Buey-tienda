'use client';

import { useEffect, useRef } from 'react';
import type { RedsysRedirectPayload } from '@/types/checkout';

interface RedsysAutoSubmitFormProps {
  payload: RedsysRedirectPayload;
}

export default function RedsysAutoSubmitForm({ payload }: RedsysAutoSubmitFormProps) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formRef.current?.submit();
  }, []);

  return (
    <form ref={formRef} action={payload.actionUrl} method="POST" className="hidden">
      <input type="hidden" name="Ds_SignatureVersion" value={payload.Ds_SignatureVersion} />
      <input type="hidden" name="Ds_MerchantParameters" value={payload.Ds_MerchantParameters} />
      <input type="hidden" name="Ds_Signature" value={payload.Ds_Signature} />
    </form>
  );
}
