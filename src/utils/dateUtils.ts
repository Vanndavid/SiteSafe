export const daysUntilExpiry = (expiryDate?: string) => {
  if (!expiryDate) return null;

  const parsed = new Date(expiryDate);
  if (Number.isNaN(parsed.getTime())) return null;

  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((parsed.getTime() - now.getTime()) / msPerDay);
};
