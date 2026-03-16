import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    createSupportTicketMessage,
    listSupportTickets,
    listSupportTicketMessages,
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
router.get('/:id/messages', listSupportTicketMessages);
router.post('/:id/messages', createSupportTicketMessage);

export default router;
