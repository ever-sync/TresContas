import { Router } from 'express';
import { authClientMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
    getClientProfile,
    createClientSupportTicket,
    getClientSupportTickets,
    getClientChartOfAccounts,
    getClientMovements,
    getClientSupportTicketMessages,
    createClientSupportTicketMessage,
} from '../controllers/clientPortal.controller';
import { analyzeFinancials } from '../controllers/aiAnalysis.controller';
import { getPortalDfcReport } from '../controllers/dfc.controller';
import {
    createClientPortalDocument,
    downloadClientPortalDocument,
    getClientPortalDocuments,
} from '../controllers/clientDocument.controller';

const router = Router();

// Client profile
router.get('/me', authClientMiddleware, getClientProfile);

// Client chart of accounts (read-only)
router.get('/chart-of-accounts', authClientMiddleware, getClientChartOfAccounts);

// Client movements — DRE e Patrimonial (read-only)
router.get('/movements', authClientMiddleware, getClientMovements);
router.get('/dfc', authClientMiddleware, getPortalDfcReport);

// AI financial analysis (streaming SSE) — accessible by client OR accounting staff
router.post('/ai-analysis', requireRole('admin', 'collaborator', 'client'), analyzeFinancials);

// Client support tickets (read own + create)
router.get('/support', authClientMiddleware, getClientSupportTickets);
router.post('/support', authClientMiddleware, createClientSupportTicket);
router.get('/support/:id/messages', authClientMiddleware, getClientSupportTicketMessages);
router.post('/support/:id/messages', authClientMiddleware, createClientSupportTicketMessage);
router.get('/documents', authClientMiddleware, getClientPortalDocuments);
router.post('/documents', authClientMiddleware, createClientPortalDocument);
router.get('/documents/:id/download', authClientMiddleware, downloadClientPortalDocument);

export default router;
