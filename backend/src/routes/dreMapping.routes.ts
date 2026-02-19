import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    getDREMappings,
    createOrUpdateDREMapping,
    deleteDREMapping,
    getUnmappedMovements,
    bulkCreateDREMappings,
} from '../controllers/dreMapping.controller';

const router = Router();

// Aplicar middleware de autenticação a todas as rotas
router.use(authMiddleware);

/**
 * GET /api/clients/:clientId/dre-mappings
 * Retorna todos os mapeamentos DE-PARA para um cliente
 */
router.get('/:clientId/dre-mappings', getDREMappings);

/**
 * POST /api/clients/:clientId/dre-mappings
 * Cria ou atualiza um mapeamento DE-PARA
 */
router.post('/:clientId/dre-mappings', createOrUpdateDREMapping);

/**
 * DELETE /api/clients/:clientId/dre-mappings/:account_code
 * Remove um mapeamento DE-PARA
 */
router.delete('/:clientId/dre-mappings/:account_code', deleteDREMapping);

/**
 * GET /api/clients/:clientId/unmapped-movements
 * Retorna movimentações não mapeadas
 */
router.get('/:clientId/unmapped-movements', getUnmappedMovements);

/**
 * POST /api/clients/:clientId/bulk-dre-mappings
 * Importa múltiplos mapeamentos DE-PARA
 */
router.post('/:clientId/bulk-dre-mappings', bulkCreateDREMappings);

export default router;
