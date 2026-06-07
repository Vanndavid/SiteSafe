import { Request, Response } from 'express';
import { createStripeCheckoutSession } from '../services/stripeService';

const getFrontendOrigin = (req: Request) =>
  process.env.FRONTEND_APP_URL ||
  req.headers.origin ||
  'http://localhost:5173';

export const createCheckoutSession = async (req: Request, res: Response) => {
  const userId = req.auth?.userId;
  const customerEmail = req.auth?.email;

  if (!userId) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const priceId = process.env.STRIPE_PRICE_ID;

  if (!priceId) {
    res.status(503).json({ error: 'Billing is not configured yet' });
    return;
  }

  const frontendOrigin = getFrontendOrigin(req);

  try {
    const url = await createStripeCheckoutSession({
      cancelUrl: process.env.BILLING_CANCEL_URL || `${frontendOrigin}/?billing=cancel`,
      userId,
      priceId,
      successUrl: process.env.BILLING_SUCCESS_URL || `${frontendOrigin}/?billing=success`,
      ...(customerEmail ? { customerEmail } : {}),
    });

    res.status(201).json({ url });
  } catch (error) {
    console.error('Stripe checkout creation failed:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unable to start checkout',
    });
  }
};
