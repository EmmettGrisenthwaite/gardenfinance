import express from 'express';
import { 
  getAchievements, 
  getAchievement
} from '../controllers/achievementController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All achievement routes require authentication
router.use(authenticate);

router.get('/', getAchievements);
router.get('/:id', getAchievement);

export default router;