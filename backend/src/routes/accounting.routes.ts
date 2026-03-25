import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    getAccountingDREMappings,
    replaceGlobalDREMappings,
} from '../controllers/dreMapping.controller';
import {
    getAccountingDfcConfig,
    putAccountingDfcConfig,
} from '../controllers/dfc.controller';

const router = Router();

router.use(authMiddleware);

router.get('/dre-mappings', getAccountingDREMappings);
router.post('/dre-mappings/bulk', replaceGlobalDREMappings);
router.get('/dfc-config', getAccountingDfcConfig);
router.put('/dfc-config', putAccountingDfcConfig);

export default router;
