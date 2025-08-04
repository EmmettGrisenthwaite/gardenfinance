import express from 'express';
import { 
  createBudget, 
  getBudgets, 
  getBudget, 
  updateBudget, 
  deleteBudget 
} from '../controllers/budgetController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All budget routes require authentication
router.use(authenticate);

router.post('/', validate(schemas.budget), createBudget);
router.get('/', getBudgets);
router.get('/:id', getBudget);
router.put('/:id', updateBudget);
router.delete('/:id', deleteBudget);

export default router;