import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    createClientDocument,
    createClientDocumentForClient,
    downloadClientDocument,
    listClientDocuments,
} from '../controllers/clientDocument.controller';

const router = Router();

router.use(authMiddleware);
router.get('/', listClientDocuments);
router.post('/', createClientDocument);
router.post('/clients/:clientId', createClientDocumentForClient);
router.get('/:id/download', downloadClientDocument);

export default router;
