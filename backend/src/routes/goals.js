import express from 'express';
import { 
  createGoal, 
  getGoals, 
  getGoal, 
  updateGoal, 
  updateGoalProgress,
  deleteGoal 
} from '../controllers/goalController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All goal routes require authentication
router.use(authenticate);

router.post('/', validate(schemas.goal), createGoal);
router.get('/', getGoals);
router.get('/:id', getGoal);
router.put('/:id', updateGoal);
router.put('/:id/progress', updateGoalProgress);
router.delete('/:id', deleteGoal);

export default router;