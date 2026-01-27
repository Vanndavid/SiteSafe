export interface AiExtraction {
  docType?: string;
  expiryDate?: string;
  licenseNumber?: string;
  holderName?: string;
  confidence?: number;
  content?: string;
}

export interface DocumentItem {
  id: string;
  name: string;
  status: 'pending' | 'processed' | 'failed';
  storagePath: string;
  extraction?: AiExtraction;
}

export interface NotificationItem {
  _id: string;
  type: 'EXPIRY_WARNING' | 'SYSTEM_INFO';
  message: string;
  createdAt: string;
}