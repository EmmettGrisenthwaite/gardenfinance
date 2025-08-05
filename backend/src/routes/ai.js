import express from 'express';
import { chatController } from '../controllers/aiController.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validation.js';
import Joi from 'joi';

const router = express.Router();

// Validation schema for chat messages
const chatMessageSchema = Joi.object({
  message: Joi.string().required().min(1).max(2000),
  context: Joi.string().optional().max(10000)
});

// POST /api/ai/chat - Send a message to the AI
router.post('/chat', 
  authenticate, 
  validate(chatMessageSchema),
  chatController.sendMessage
);

export default router;