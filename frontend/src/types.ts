export interface AiExtraction {
  type?: string;
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
  extraction?: AiExtraction;
}

export interface NotificationItem {
  _id: string;
  type: 'EXPIRY_WARNING' | 'SYSTEM_INFO';
  message: string;
  createdAt: string;
}