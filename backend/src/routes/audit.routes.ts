import { Router } from 'express';
import { getAuditEvents } from '../controllers/audit.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.get('/', requireRole('admin', 'collaborator'), getAuditEvents);

export default router;
