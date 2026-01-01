import { Router } from 'express';
import { upload } from '../middleware/upload';
import { checkHealth, testAI, uploadDocument } from '../controllers/documentController';

const router = Router();

// Routes
router.get('/health', checkHealth);
router.post('/test-ai', testAI);
router.post('/upload', upload.single('document'), uploadDocument);

export default router;