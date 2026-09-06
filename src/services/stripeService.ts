type CreateCheckoutSessionInput = {
  cancelUrl: string;
  userId: string;
  customerEmail?: string;
  priceId: string;
  successUrl: string;
};

type StripeCheckoutSessionResponse = {
  error?: {
    message?: string;
  };
  url?: string;
};

const STRIPE_CHECKOUT_SESSIONS_URL = 'https://api.stripe.com/v1/checkout/sessions';

export const createStripeCheckoutSession = async ({
  cancelUrl,
  userId,
  customerEmail,
  priceId,
  successUrl,
}: CreateCheckoutSessionInput) => {
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    throw new Error('Stripe is not configured. Missing STRIPE_SECRET_KEY.');
  }

  const formData = new URLSearchParams();
  formData.append('mode', 'subscription');
  formData.append('success_url', successUrl);
  formData.append('cancel_url', cancelUrl);
  formData.append('line_items[0][price]', priceId);
  formData.append('line_items[0][quantity]', '1');
  formData.append('allow_promotion_codes', 'true');
  formData.append('billing_address_collection', 'auto');
  formData.append('metadata[userId]', userId);

  if (customerEmail) {
    formData.append('customer_email', customerEmail);
  }

  const response = await fetch(STRIPE_CHECKOUT_SESSIONS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString(),
  });

  const payload = (await response.json()) as StripeCheckoutSessionResponse;

  if (!response.ok || !payload.url) {
    throw new Error(payload.error?.message || 'Failed to create Stripe Checkout session.');
  }

  return payload.url;
};
