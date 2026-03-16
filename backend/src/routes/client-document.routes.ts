import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    downloadClientDocument,
    listClientDocuments,
} from '../controllers/clientDocument.controller';

const router = Router();

router.use(authMiddleware);
router.get('/', listClientDocuments);
router.get('/:id/download', downloadClientDocument);

export default router;
