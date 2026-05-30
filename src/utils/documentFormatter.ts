import type { Document } from '@prisma/client';

// Formats a Prisma `Document` into the shape returned by the API.
export const formatDocumentListItem = (doc: Document) => ({
  id: doc.id,
  name: doc.originalName,
  status: doc.status,
  storagePath: doc.storagePath,
  extraction: doc.extractedData,
});
