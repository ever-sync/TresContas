import { Router } from 'express';
import { register, login, clientLogin } from '../controllers/auth.controller';

const router = Router();

router.post('/register', register);
router.post('/login', login);
router.post('/client-login', clientLogin);

export default router;
