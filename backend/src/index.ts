import 'dotenv/config';
import { randomUUID } from 'crypto';
import express from 'express';
import helmet from 'helmet';

import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import supportRoutes from './routes/support.routes';
import clientPortalRoutes from './routes/client-portal.routes';
import userRoutes from './routes/user.routes';
import chartOfAccountsRoutes from './routes/chartOfAccounts.routes';
import clientDocumentRoutes from './routes/client-document.routes';
import movementRoutes from './routes/movement.routes';
import dreMappingRoutes from './routes/dreMapping.routes';
import dfcRoutes from './routes/dfc.routes';
import prisma from './lib/prisma';
import { isOriginAllowed, securityConfig } from './config/security';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware';

const app = express();
const port = process.env.PORT || 3001;

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

app.use(helmet());

app.use((req, res, next) => {
    const requestId = randomUUID();
    const startedAt = Date.now();

    res.locals.requestId = requestId;
    res.setHeader('X-Request-Id', requestId);

    res.on('finish', () => {
        console.log(
            JSON.stringify({
                type: 'request_complete',
                requestId,
                method: req.method,
                path: req.originalUrl,
                status: res.statusCode,
                durationMs: Date.now() - startedAt,
            })
        );
    });

    next();
});

app.use((req, res, next) => {
    const origin = typeof req.headers.origin === 'string' ? req.headers.origin : null;

    if (!origin) {
        return next();
    }

    if (!isOriginAllowed(origin, securityConfig)) {
        if (req.method === 'OPTIONS') {
            return res.status(403).end();
        }

        return res.status(403).json({ message: 'Origin nao permitida' });
    }

    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    next();
});

app.use(express.json({ limit: '25mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/client-documents', clientDocumentRoutes);
app.use('/api/clients/:clientId/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/clients/:clientId/movements', movementRoutes);
app.use('/api/clients/:clientId', dfcRoutes);
app.use('/api/clients', dreMappingRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/users', userRoutes);

app.get('/health', async (_req, res, next) => {
    try {
        const hasQueryRaw = typeof (prisma as { $queryRaw?: unknown }).$queryRaw === 'function';

        if (!hasQueryRaw) {
            res.status(200).json({ status: 'ok', database: 'unknown' });
            return;
        }

        await prisma.$queryRaw`SELECT 1`;
        res.status(200).json({ status: 'ok', database: 'up' });
    } catch (error) {
        console.warn('Health check database query failed', error);
        res.status(200).json({ status: 'ok', database: 'down' });
    }
});

app.use(notFoundHandler);
app.use(errorHandler);

export default app;

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
