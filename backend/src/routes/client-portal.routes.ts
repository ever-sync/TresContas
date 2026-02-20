import { Router } from 'express';
import { authClientMiddleware } from '../middlewares/auth.middleware';
import { getClientProfile, createClientSupportTicket, getClientSupportTickets, getClientChartOfAccounts, getClientMovements } from '../controllers/clientPortal.controller';
import { analyzeFinancials } from '../controllers/aiAnalysis.controller';

const router = Router();

// All routes require client authentication
router.use(authClientMiddleware);

// Client profile
router.get('/me', getClientProfile);

// Client chart of accounts (read-only)
router.get('/chart-of-accounts', getClientChartOfAccounts);

// Client movements — DRE e Patrimonial (read-only)
router.get('/movements', getClientMovements);

// AI financial analysis (streaming SSE)
router.post('/ai-analysis', analyzeFinancials);

// Client support tickets (read own + create)
router.get('/support', getClientSupportTickets);
router.post('/support', createClientSupportTicket);

export default router;
