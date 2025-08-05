import express from 'express';
import { register, login, me, updateProfile } from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// Public routes
router.post('/register', validate(schemas.register), register);
router.post('/login', validate(schemas.login), login);

// Protected routes
router.get('/me', authenticate, me);
router.put('/profile', authenticate, updateProfile);

export default router;