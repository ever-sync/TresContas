import { Router } from 'express';
import {
    register,
    login,
    me,
    refresh,
    logout,
    forgotPassword,
    resetPassword,
    acceptInvite,
    clientLogin,
    clientRefresh,
    clientLogout,
} from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import {
    clientLoginRateLimiter,
    loginRateLimiter,
    registerRateLimiter,
} from '../middlewares/rateLimit.middleware';

const router = Router();

router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);
router.get('/me', authMiddleware, me);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);
router.post('/accept-invite', acceptInvite);
router.post('/client-login', clientLoginRateLimiter, clientLogin);
router.post('/client-refresh', clientRefresh);
router.post('/client-logout', clientLogout);

export default router;
