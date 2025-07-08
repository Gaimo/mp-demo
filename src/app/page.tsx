'use client'

import { useState } from 'react';
import Script from 'next/script';
import { PaymentForm, type MercadoPago } from "./components/PaymentForm";

export default function Home() {
  const [mpInstance, setMpInstance] = useState<MercadoPago | null>(null);

  const publicKey = process.env.NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY;

  return (
    <>
      <Script 
        src="https://sdk.mercadopago.com/js/v2" 
        onLoad={() => {
          if (publicKey) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mp = new (window as any).MercadoPago(publicKey);
            setMpInstance(mp);
          }
        }}
      />
      <main className="flex min-h-screen flex-col items-center justify-center p-4 bg-[#0a0a0a] text-white">
        <div className="w-full max-w-md">
          {!publicKey ? (
            <div className="text-center p-4 bg-red-900/50 border border-red-700 rounded-lg">
              <p className="font-semibold">Chave pública do Mercado Pago não configurada.</p>
              <p className="text-sm text-gray-300 mt-2">
                Por favor, adicione `NEXT_PUBLIC_MERCADOPAGO_PUBLIC_KEY` ao seu arquivo `.env.local`.
              </p>
            </div>
          ) : (
            <PaymentForm mp={mpInstance} />
          )}
        </div>
      </main>
    </>
  );
}
