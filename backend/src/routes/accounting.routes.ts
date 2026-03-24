import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    getAccountingDREMappings,
    replaceGlobalDREMappings,
} from '../controllers/dreMapping.controller';

const router = Router();

router.use(authMiddleware);

router.get('/dre-mappings', getAccountingDREMappings);
router.post('/dre-mappings/bulk', replaceGlobalDREMappings);

export default router;
