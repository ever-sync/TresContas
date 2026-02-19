import { Router } from 'express';
import { getClients, getClientById, createClient, updateClient, deleteClient } from '../controllers/client.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// All routes require staff authentication (admin or collaborator)
router.use(authMiddleware);

// Read - admin and collaborator
router.get('/', getClients);
router.get('/:id', getClientById);

// Write - admin and collaborator can create/update clients
router.post('/', createClient);
router.patch('/:id', updateClient);

// Delete - admin only
router.delete('/:id', requireRole('admin'), deleteClient);

export default router;
