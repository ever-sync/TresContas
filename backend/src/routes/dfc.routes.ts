import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    getClientDfcConfig,
    getClientDfcReport,
    putClientDfcConfig,
} from '../controllers/dfc.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

router.get('/dfc-config', getClientDfcConfig);
router.put('/dfc-config', putClientDfcConfig);
router.get('/dfc', getClientDfcReport);

export default router;
