import { NextRequest, NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      token,
      issuer_id,
      payment_method_id,
      transaction_amount,
      installments,
      payer,
      additional_info,
      orderId,
      description
    } = body;

    if (!process.env.MERCADOPAGO_ACCESS_TOKEN) {
        throw new Error("MercadoPago access token is not configured.");
    }

    const client = new MercadoPagoConfig({ accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN });
    const payment = new Payment(client);

    const paymentResponse = await payment.create({
      body: {
        transaction_amount,
        token,
        description,
        installments,
        payment_method_id,
        issuer_id,
        payer,
        additional_info,
        metadata: {
          order_id: orderId,
        },
      },
    });

    // Depending on the payment status, you can handle the response.
    // For example, if the payment is approved.
    if (paymentResponse.status === 'approved') {
        // Here you would typically update your database, mark the order as paid, etc.
        // For this example, we'll just return a success response with a dummy redirect URL.
        return NextResponse.json({ success: true, redirect_url: '/payment-success' });
    } else {
        // Handle other statuses (e.g., 'in_process', 'rejected')
        return NextResponse.json({ success: false, error: paymentResponse.status_detail || 'Payment was not approved.' }, { status: 400 });
    }

  } catch (error: unknown) {
    console.error('Error processing payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
} 