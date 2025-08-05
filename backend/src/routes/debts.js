import express from 'express';
import { 
  createDebt, 
  getDebts, 
  getDebt, 
  updateDebt, 
  makePayment,
  deleteDebt 
} from '../controllers/debtController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All debt routes require authentication
router.use(authenticate);

router.post('/', validate(schemas.debt), createDebt);
router.get('/', getDebts);
router.get('/:id', getDebt);
router.put('/:id', updateDebt);
router.put('/:id/payment', makePayment);
router.delete('/:id', deleteDebt);

export default router;