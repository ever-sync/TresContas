import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    listSupportTickets,
    createSupportTicket,
    updateSupportTicket,
} from '../controllers/support.controller';

const router = Router();

// All support routes require staff authentication (admin or collaborator)
router.use(authMiddleware);

// Read/Write - admin and collaborator
router.get('/', listSupportTickets);
router.post('/', createSupportTicket);
router.patch('/:id', updateSupportTicket);

export default router;
