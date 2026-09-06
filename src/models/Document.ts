export type ExtractedDocumentPage = {
  page: number;
  text: string;
};

export type ExtractedDocumentData = {
  docType?: string;
  expiryDate?: string;
  licenseNumber?: string;
  holderName?: string;
  confidence?: number;
  content?: string;
  /** Verbatim per-page transcription. Chunking and retrieval read this, not `content`. */
  pages?: ExtractedDocumentPage[];
};
