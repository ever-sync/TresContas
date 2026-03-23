import { Router } from 'express';
import { register, login, clientLogin } from '../controllers/auth.controller';
import {
    clientLoginRateLimiter,
    loginRateLimiter,
    registerRateLimiter,
} from '../middlewares/rateLimit.middleware';

const router = Router();

router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);
router.post('/client-login', clientLoginRateLimiter, clientLogin);

export default router;
