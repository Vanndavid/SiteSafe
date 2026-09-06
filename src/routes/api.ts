import { Router } from 'express';
import { upload } from '../middleware/upload';
// import upload from "../config/s3uploader"
import { login, logout, me, refresh, register } from '../controllers/authController';
import { createCheckoutSession } from '../controllers/billingController';
import { createProjectHandler, getProjects } from '../controllers/projectController';
import { checkHealth, getDocumentStatus, getAllDocuments, getDocumentOverview, uploadDocument, getNotifications, markAsRead, downloadDocument, searchDocuments, updateDocumentProcessingResult, createDocumentUploadUrl, completeDocumentUpload } from '../controllers/documentController';
import { requireCaptcha } from '../middleware/captcha';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter, uploadRateLimiter, workerCallbackRateLimiter } from '../middleware/rateLimit';

const router = Router();

// Routes
router.get('/health', checkHealth);
router.post('/internal/documents/:id/processing-result', workerCallbackRateLimiter, updateDocumentProcessingResult);
router.post('/auth/register', authRateLimiter, requireCaptcha, register);
router.post('/auth/login', authRateLimiter, requireCaptcha, login);
router.post('/auth/refresh', authRateLimiter, refresh);
router.post('/auth/logout', logout);
router.get('/auth/me', requireAuth, me);
router.get('/projects', requireAuth, getProjects);
router.post('/projects', requireAuth, createProjectHandler);
router.post('/documents/upload-url', requireAuth, uploadRateLimiter, createDocumentUploadUrl);
router.post('/documents/:id/complete-upload', requireAuth, uploadRateLimiter, completeDocumentUpload);
router.post('/upload', requireAuth, uploadRateLimiter, upload.single('document'), uploadDocument);
router.get('/document/:id', requireAuth, getDocumentStatus); 
router.get('/documents', requireAuth, getAllDocuments);
router.get('/documents/overview', requireAuth, getDocumentOverview);
router.get('/documents/search', requireAuth, searchDocuments);
router.get('/notifications', requireAuth, getNotifications);
router.patch('/notifications/:id/read', requireAuth, markAsRead);
router.get('/download/*key', requireAuth, downloadDocument);
router.post('/billing/checkout', requireAuth, createCheckoutSession);

export default router;
