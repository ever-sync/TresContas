import { Router } from 'express';
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../controllers/user.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// All routes require staff authentication
router.use(authMiddleware);

// List & Get - admin and collaborator can view team
router.get('/', getUsers);
router.get('/:id', getUserById);

// Create, Update, Delete - admin only
router.post('/', requireRole('admin'), createUser);
router.patch('/:id', requireRole('admin'), updateUser);
router.delete('/:id', requireRole('admin'), deleteUser);

export default router;
