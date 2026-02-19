import 'dotenv/config';
import express from 'express';
import cors from 'cors';

import authRoutes from './routes/auth.routes';
import clientRoutes from './routes/client.routes';
import supportRoutes from './routes/support.routes';
import clientPortalRoutes from './routes/client-portal.routes';
import userRoutes from './routes/user.routes';
import chartOfAccountsRoutes from './routes/chartOfAccounts.routes';
import movementRoutes from './routes/movement.routes';
import dreMappingRoutes from './routes/dreMapping.routes';

const app = express();
const port = process.env.PORT || 3001;

const requiredEnv = ['DATABASE_URL', 'JWT_SECRET'];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);
if (missingEnv.length > 0) {
    console.error(`Missing required environment variables: ${missingEnv.join(', ')}`);
    process.exit(1);
}

// CORS configuration - allowing all for debugging
app.use(cors());

// Simple request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

app.use(express.json({ limit: '10mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/clients/:clientId/chart-of-accounts', chartOfAccountsRoutes);
app.use('/api/clients/:clientId/movements', movementRoutes);
app.use('/api/clients', dreMappingRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/client-portal', clientPortalRoutes);
app.use('/api/users', userRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
});

const server = app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

process.on('exit', (code) => {
    console.log(`PROCESS EXIT WITH CODE: ${code}`);
});

process.on('SIGINT', () => {
    console.log('SIGINT received');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received');
    process.exit(0);
});

server.on('error', (err) => {
    console.error('SERVER ERROR:', err);
});

server.on('close', () => {
    console.log('SERVER CLOSED');
});
