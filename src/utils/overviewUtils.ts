import { daysUntilExpiry } from './dateUtils';

// Accept `extractedData` as `any` because Prisma returns JSON as `JsonValue`.
// We only read `expiryDate` (a string) from it, so cast safely at use-sites.
export const computeDocumentOverview = (
  docs: Array<{ id: string; originalName: string; status: string; extractedData: any }>,
  expiringWithinDays: number,
  limit: number,
) => {
  const totals = {
    total: docs.length,
    pending: 0,
    processed: 0,
    failed: 0,
    expired: 0,
    expiringSoon: 0,
    valid: 0,
    missingExpiry: 0,
  };

  const expiringDocuments: Array<{ id: string; name: string; expiryDate: string | undefined; daysUntilExpiry: number; status: string }> = [];

  docs.forEach(doc => {
    if (doc.status === 'pending') totals.pending += 1;
    if (doc.status === 'processed') totals.processed += 1;
    if (doc.status === 'failed') totals.failed += 1;

    const expiryInDays = daysUntilExpiry((doc.extractedData as any)?.expiryDate);

    if (expiryInDays == null) {
      totals.missingExpiry += 1;
      return;
    }

    if (expiryInDays < 0) {
      totals.expired += 1;
      return;
    }

    if (expiryInDays <= expiringWithinDays) {
      totals.expiringSoon += 1;
      expiringDocuments.push({
        id: doc.id,
        name: doc.originalName,
        expiryDate: (doc.extractedData as any)?.expiryDate,
        daysUntilExpiry: expiryInDays,
        status: doc.status,
      });
      return;
    }

    totals.valid += 1;
  });

  expiringDocuments.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  return {
    generatedAt: new Date().toISOString(),
    filters: { expiringWithinDays },
    totals,
    expiringDocuments: expiringDocuments.slice(0, limit),
  };
};
