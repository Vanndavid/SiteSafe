import { Alert, Button, Card, CardContent, Chip, Stack, Typography } from '@mui/material';

type BillingCardProps = {
  error: string | null;
  loading: boolean;
  status: string | null;
  onCheckout: () => void;
};

export const BillingCard = ({ error, loading, status, onCheckout }: BillingCardProps) => {
  return (
    <Card sx={{ mb: 3, borderRadius: 3 }}>
      <CardContent>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" alignItems={{ xs: 'flex-start', md: 'center' }}>
          <Stack spacing={1.5}>
            <Stack direction="row" spacing={1} alignItems="center">
              <Typography variant="h6" fontWeight={700}>
                Billing
              </Typography>
              <Chip label="Phase 5" color="primary" size="small" />
            </Stack>

            <Typography color="text.secondary">
              Start the hosted Stripe Checkout flow for the SaaS subscription plan. This is the first payment slice for turning the prototype into a customer-ready platform.
            </Typography>
          </Stack>

          <Button variant="contained" onClick={onCheckout} disabled={loading}>
            {loading ? 'Opening checkout...' : 'Upgrade With Stripe'}
          </Button>
        </Stack>

        {status ? (
          <Alert severity={status === 'success' ? 'success' : 'info'} sx={{ mt: 2 }}>
            {status === 'success'
              ? 'Stripe returned successfully. You can now refresh entitlements or add webhook handling next.'
              : 'Checkout was canceled before payment completed.'}
          </Alert>
        ) : null}

        {error ? (
          <Alert severity="error" sx={{ mt: 2 }}>
            {error}
          </Alert>
        ) : null}
      </CardContent>
    </Card>
  );
};
