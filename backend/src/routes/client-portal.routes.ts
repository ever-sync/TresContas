import { Router } from 'express';
import { authClientMiddleware } from '../middlewares/auth.middleware';
import { getClientProfile, createClientSupportTicket, getClientSupportTickets, getClientChartOfAccounts } from '../controllers/clientPortal.controller';

const router = Router();

// All routes require client authentication
router.use(authClientMiddleware);

// Client profile
router.get('/me', getClientProfile);

// Client chart of accounts (read-only)
router.get('/chart-of-accounts', getClientChartOfAccounts);

// Client support tickets (read own + create)
router.get('/support', getClientSupportTickets);
router.post('/support', createClientSupportTicket);

export default router;
