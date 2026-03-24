import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    createSupportTicketDocument,
    createSupportTicketMessage,
    listSupportTickets,
    listSupportTicketDocuments,
    listSupportTicketMessages,
    createSupportTicket,
    updateSupportTicket,
} from '../controllers/support.controller';
import { supportWriteRateLimiter } from '../middlewares/rateLimit.middleware';

const router = Router();

// All support routes require staff authentication (admin or collaborator)
router.use(authMiddleware);

// Read/Write - admin and collaborator
router.get('/', listSupportTickets);
router.post('/', supportWriteRateLimiter, createSupportTicket);
router.patch('/:id', supportWriteRateLimiter, updateSupportTicket);
router.get('/:id/messages', listSupportTicketMessages);
router.post('/:id/messages', supportWriteRateLimiter, createSupportTicketMessage);
router.get('/:id/documents', listSupportTicketDocuments);
router.post('/:id/documents', supportWriteRateLimiter, createSupportTicketDocument);

export default router;
