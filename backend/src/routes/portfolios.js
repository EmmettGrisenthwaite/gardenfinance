import express from 'express';
import { 
  createPortfolio, 
  getPortfolios, 
  getPortfolio, 
  updatePortfolio, 
  deletePortfolio,
  addHolding,
  updateHolding,
  removeHolding
} from '../controllers/portfolioController.js';
import { authenticate } from '../middleware/auth.js';
import { validate, schemas } from '../middleware/validation.js';

const router = express.Router();

// All portfolio routes require authentication
router.use(authenticate);

router.post('/', validate(schemas.portfolio), createPortfolio);
router.get('/', getPortfolios);
router.get('/:id', getPortfolio);
router.put('/:id', updatePortfolio);
router.delete('/:id', deletePortfolio);

// Holdings routes
router.post('/:id/holdings', validate(schemas.holding), addHolding);
router.put('/:id/holdings/:holdingId', updateHolding);
router.delete('/:id/holdings/:holdingId', removeHolding);

export default router;