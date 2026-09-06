import { Router } from 'express';
import { upload } from '../middleware/upload';
// import upload from "../config/s3uploader"
import { login, logout, me, refresh, register } from '../controllers/authController';
import { createCheckoutSession } from '../controllers/billingController';
import { createProjectHandler, getProjects } from '../controllers/projectController';
import { checkHealth, getDocumentStatus, getAllDocuments, getDocumentOverview, uploadDocument, getNotifications, markAsRead, downloadDocument, searchDocuments, updateDocumentProcessingResult, createDocumentUploadUrl, completeDocumentUpload } from '../controllers/documentController';
import { askQuestion } from '../controllers/ragController';
import { requireAuth } from '../middleware/auth';

const router = Router();

// Routes
router.get('/health', checkHealth);
router.post('/internal/documents/:id/processing-result', updateDocumentProcessingResult);
router.post('/auth/register', register);
router.post('/auth/login', login);
router.post('/auth/refresh', refresh);
router.post('/auth/logout', logout);
router.get('/auth/me', requireAuth, me);
router.get('/projects', requireAuth, getProjects);
router.post('/projects', requireAuth, createProjectHandler);
router.post('/documents/upload-url', requireAuth, createDocumentUploadUrl);
router.post('/documents/:id/complete-upload', requireAuth, completeDocumentUpload);
router.post('/upload', requireAuth, upload.single('document'), uploadDocument);
router.get('/document/:id', requireAuth, getDocumentStatus); 
router.get('/documents', requireAuth, getAllDocuments);
router.get('/documents/overview', requireAuth, getDocumentOverview);
router.get('/documents/search', requireAuth, searchDocuments);
router.post('/ask', requireAuth, askQuestion);
router.get('/notifications', requireAuth, getNotifications);
router.patch('/notifications/:id/read', requireAuth, markAsRead);
router.get('/download/*key', requireAuth, downloadDocument);
router.post('/billing/checkout', requireAuth, createCheckoutSession);

export default router;
