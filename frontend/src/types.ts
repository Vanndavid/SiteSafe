export interface AiExtraction {
  docType?: string;
  expiryDate?: string;
  licenseNumber?: string;
  holderName?: string;
  confidence?: number;
  content?: string;
}

export interface ProjectItem {
  id: number;
  name: string;
  description?: string | null;
}

export interface DocumentItem {
  id: string;
  name: string;
  status: 'pending' | 'processed' | 'failed';
  storagePath: string;
  extraction?: AiExtraction;
  matchReasons?: string[];
}

export interface SearchResponse {
  query: string;
  interpretedFilters: {
    keywords: string[];
    expiryWithinDays: number | null;
  };
  results: DocumentItem[];
}

export interface NotificationItem {
  _id: string;
  type: 'EXPIRY_WARNING' | 'SYSTEM_INFO';
  message: string;
  createdAt: string;
}
