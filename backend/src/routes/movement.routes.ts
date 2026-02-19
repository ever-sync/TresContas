import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import { getMovements, importMovements, removeMovements } from '../controllers/movement.controller';

const router = Router({ mergeParams: true });

router.use(authMiddleware);

// GET    /api/clients/:clientId/movements?year=2025
router.get('/', getMovements);

// POST   /api/clients/:clientId/movements/import
router.post('/import', importMovements);

// DELETE /api/clients/:clientId/movements?year=2025
router.delete('/', removeMovements);

export default router;
