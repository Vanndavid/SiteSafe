import { Router } from 'express';
// import { upload } from '../middleware/upload';
import upload from "../config/s3uploader"
import { createCheckoutSession } from '../controllers/billingController';
import { checkHealth, getDocumentStatus, getAllDocuments, getDocumentOverview, uploadDocument, getNotifications, markAsRead, downloadDocument, searchDocuments, updateDocumentProcessingResult, createDocumentUploadUrl, completeDocumentUpload } from '../controllers/documentController';

const router = Router();

// Routes
router.get('/health', checkHealth);
router.post('/internal/documents/:id/processing-result', updateDocumentProcessingResult);
router.post('/documents/upload-url', createDocumentUploadUrl);
router.post('/documents/:id/complete-upload', completeDocumentUpload);
router.post('/upload', upload.single('document'), uploadDocument);
router.get('/document/:id', getDocumentStatus); 
router.get('/documents', getAllDocuments);
router.get('/documents/overview', getDocumentOverview);
router.get('/documents/search', searchDocuments);
router.get('/notifications', getNotifications);
router.patch('/notifications/:id/read', markAsRead);
router.get('/download/*key', downloadDocument);
router.post('/billing/checkout', createCheckoutSession);

export default router;
