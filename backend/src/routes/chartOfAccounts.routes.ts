import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getAll, create, bulkImport, remove, removeAll } from '../controllers/chartOfAccounts.controller';

const router = Router({ mergeParams: true });

// All routes require staff authentication
router.use(authMiddleware);

// GET    /api/clients/:clientId/chart-of-accounts
router.get('/', getAll);

// POST   /api/clients/:clientId/chart-of-accounts
router.post('/', create);

// POST   /api/clients/:clientId/chart-of-accounts/import
router.post('/import', bulkImport);

// DELETE /api/clients/:clientId/chart-of-accounts/:id
router.delete('/:id', remove);

// DELETE /api/clients/:clientId/chart-of-accounts
router.delete('/', removeAll);

export default router;
