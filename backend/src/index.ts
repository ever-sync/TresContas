import 'dotenv/config';
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
import { isOriginAllowed, securityConfig } from './config/security';

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

app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
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

app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
});

export default app;

if (!process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`Server running on port ${port}`);
    });
}
