import { Router } from 'express';
import { upload } from '../middleware/upload';
import { checkHealth, uploadDocument } from '../controllers/documentController';

const router = Router();

// Routes
router.get('/health', checkHealth);
router.post('/upload', upload.single('document'), uploadDocument);

export default router;