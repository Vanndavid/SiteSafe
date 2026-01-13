import mongoose, { Document, Schema } from 'mongoose';

export interface INotification extends Document {
  type: 'EXPIRY_WARNING' | 'SYSTEM_INFO';
  message: string;
  docId?: string; // Link to document
  createdAt: Date;
  read: boolean;
}

const NotificationSchema = new Schema<INotification>({
  type: { type: String, required: true },
  message: { type: String, required: true },
  docId: { type: String },
  createdAt: { type: Date, default: Date.now },
  read: { type: Boolean, default: false }
});

export default mongoose.model<INotification>('Notification', NotificationSchema);