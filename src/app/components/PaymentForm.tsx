'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'

// A SDK do MercadoPago é carregada externamente, então definimos um tipo 'any'
// para o objeto 'mp' que será recebido via props.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type MercadoPago = any

interface PaymentFormProps {
  mp: MercadoPago | null
}

type CardFormType = ReturnType<MercadoPago['cardForm']>

export function PaymentForm({ mp }: PaymentFormProps) {
  const [formValues, setFormValues] = useState({
    cardholderName: '',
    email: '',
    identificationNumber: '',
    rawIdentificationNumber: ''
  })

  const [isProcessingPayment, setIsProcessingPayment] = useState(false)
  const [needsNewToken, setNeedsNewToken] = useState(false)

  const cardFormRef = useRef<CardFormType | null>(null)
  const formValuesRef = useRef(formValues)
  useEffect(() => {
    formValuesRef.current = formValues
  }, [formValues])

  const translateErrorMessage = (errorMessage: string): string => {
    const errorTranslations: { [key: string]: string } = {
      'cc_rejected_insufficient_amount': 'Saldo insuficiente no cartão',
      'cc_rejected_bad_filled_card_number': 'Número do cartão inválido',
      'cc_rejected_bad_filled_date': 'Data de vencimento inválida',
      'cc_rejected_bad_filled_security_code': 'Código de segurança inválido',
      'cc_rejected_call_for_authorize': 'Operação negada pelo banco emissor',
      'cc_rejected_card_disabled': 'Cartão desabilitado',
      'cc_rejected_duplicated_payment': 'Pagamento duplicado',
      'cc_rejected_high_risk': 'Pagamento recusado por segurança',
      'cc_rejected_card_error': 'Erro no cartão',
      'cc_rejected_blacklist': 'Cartão não permitido',
      'cc_rejected_invalid_installments': 'Número de parcelas inválido'
    }

    for (const [code, translation] of Object.entries(errorTranslations)) {
      if (errorMessage.includes(code)) {
        return translation
      }
    }
    return errorMessage || 'Erro no processamento do pagamento'
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    let formattedValue = value

    if (name === 'identificationNumber') {
      const rawValue = value.replace(/\D/g, '')
      if (rawValue.length <= 11) {
        formattedValue = rawValue.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')
      } else {
        formattedValue = rawValue.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5')
      }
      setFormValues(prev => ({
        ...prev,
        identificationNumber: formattedValue,
        rawIdentificationNumber: rawValue
      }))
      return
    }

    setFormValues(prev => ({ ...prev, [name]: formattedValue }))
  }

  useEffect(() => {
    if (!mp) {
      const timer = setTimeout(() => {
        if (cardFormRef.current === null) {
          window.location.reload();
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [mp]);

  useEffect(() => {
    if (!mp) return

    if (needsNewToken) {
      setNeedsNewToken(false)
    }

    const cardForm = mp.cardForm({
      amount: "100", // Valor fixo para o produto de demonstração
      iframe: true,
      form: {
        id: "form-checkout",
        cardNumber: { id: "form-checkout__cardNumber", placeholder: "Número do cartão" },
        expirationDate: { id: "form-checkout__expirationDate", placeholder: "MM/YY" },
        securityCode: { id: "form-checkout__securityCode", placeholder: "Código de segurança" },
        cardholderName: { id: "form-checkout__cardholderName", placeholder: "Titular do cartão" },
        issuer: { id: "form-checkout__issuer", placeholder: "Banco emissor" },
        installments: { id: "form-checkout__installments", placeholder: "Parcelas" },
        identificationType: { id: "form-checkout__identificationType", placeholder: "Tipo de documento" },
      },
      callbacks: {
        onFormMounted: (error: unknown) => {
          if (error) return console.warn("Form Mounted handling error: ", error);
        },
        onSubmit: (event: { preventDefault: () => void; }) => {
          event.preventDefault();
          setIsProcessingPayment(true)

          if (!cardFormRef.current) {
            toast.error('Ocorreu um erro, por favor, tente novamente.')
            setIsProcessingPayment(false)
            return
          }

          const {
            paymentMethodId: payment_method_id,
            issuerId: issuer_id,
            amount,
            token,
            installments,
            identificationType,
          } = cardFormRef.current.getCardFormData();

          const currentFormValues = formValuesRef.current

          const paymentData = {
            token,
            issuer_id,
            payment_method_id,
            transaction_amount: Number(amount),
            installments: Number(installments),
            description: "Produto Demo",
            payer: {
              email: currentFormValues.email,
              identification: {
                type: identificationType,
                number: currentFormValues.rawIdentificationNumber,
              },
            },
          };

          fetch('/api/mercadopago/process-card-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(paymentData),
          })
            .then(response => response.json())
            .then(data => {
              setIsProcessingPayment(false)
              if (data.success) {
                toast.success('Pagamento aprovado! Redirecionando...')
                if (data.redirect_url) {
                  window.location.href = data.redirect_url
                }
              } else {
                const translatedError = translateErrorMessage(data.error || 'Erro no processamento do pagamento')
                toast.error(translatedError)
                setNeedsNewToken(true)
              }
            })
            .catch(() => {
              setIsProcessingPayment(false)
              toast.error('Erro de comunicação. Tente novamente.')
              setNeedsNewToken(true)
            })
        },
        onError: (error: unknown) => {
          console.error('Error from MercadoPago:', error)
          toast.error('Ocorreu um erro, verifique os dados do cartão.')
        }
      },
    });

    cardFormRef.current = cardForm

    return () => {
      // A função unmount() existe na documentação da SDK, mas pode não estar nos tipos.
      cardForm?.unmount()
      cardFormRef.current = null
    }
  }, [mp, needsNewToken]);

  if (!mp) {
    return (
      <div className="p-6 text-center">
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          <span className="text-gray-400">Carregando sistema de pagamento...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 bg-[#1a1a1a] rounded-lg max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-semibold text-white">Produto Demo</h2>
        <p className="text-4xl font-bold text-[#97D964] mt-2">R$ 100,00</p>
        <p className="text-gray-400 mt-2">
          Parcele em até 12x com juros no cartão de crédito.
        </p>
      </div>

      <form id="form-checkout" className="space-y-4">
        {/* Número do cartão */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Número do cartão</label>
          <div id="form-checkout__cardNumber" className="form-field"></div>
        </div>

        {/* Data de vencimento e código de segurança */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Data de vencimento</label>
            <div id="form-checkout__expirationDate" className="form-field"></div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">Código de segurança</label>
            <div id="form-checkout__securityCode" className="form-field"></div>
          </div>
        </div>

        {/* Nome do titular */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Nome do titular</label>
          <input
            id="form-checkout__cardholderName"
            name="cardholderName"
            type="text"
            value={formValues.cardholderName}
            onChange={handleInputChange}
            className="form-input"
            required
          />
        </div>
        
        {/* E-mail */}
        <div>
            <label className="block text-sm font-medium mb-2 text-gray-300">E-mail</label>
            <input
                name="email"
                type="email"
                placeholder="seuemail@exemplo.com"
                value={formValues.email}
                onChange={handleInputChange}
                className="form-input"
                required
            />
        </div>

        {/* Documento do titular */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium mb-2 text-gray-300">Tipo de doc.</label>
            <select id="form-checkout__identificationType" className="form-input"></select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium mb-2 text-gray-300">Documento</label>
            <input
              name="identificationNumber"
              type="text"
              placeholder={'CPF ou CNPJ'}
              value={formValues.identificationNumber}
              onChange={handleInputChange}
              maxLength={18}
              className="form-input"
              required
            />
          </div>
        </div>

        {/* Banco Emissor */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Banco Emissor</label>
          <select id="form-checkout__issuer" className="form-input"></select>
        </div>

        {/* Parcelas */}
        <div>
          <label className="block text-sm font-medium mb-2 text-gray-300">Parcelas</label>
          <select id="form-checkout__installments" className="form-input"></select>
        </div>
        
        {/* Botão de pagamento */}
        <button
          type="submit"
          disabled={isProcessingPayment}
          className="w-full bg-[#97D964] hover:bg-[#86C853] disabled:bg-gray-600 text-black font-semibold py-3 px-6 rounded-lg transition-colors mt-6 flex items-center justify-center gap-2"
        >
          {isProcessingPayment ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-black"></div>
              Processando...
            </>
          ) : 'Pagar R$ 100,00'}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-400">
        <p>Pagamento 100% seguro processado pelo MercadoPago</p>
      </div>
    </div>
  )
} 