import Joi from 'joi';

export const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    next();
  };
};

// Validation schemas
export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(6).required(),
    firstName: Joi.string().min(1).required(),
    lastName: Joi.string().min(1).required()
  }),

  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  budget: Joi.object({
    name: Joi.string().min(1).required(),
    monthlyIncome: Joi.number().min(0).required(),
    categories: Joi.object().pattern(
      Joi.string(),
      Joi.number().min(0)
    ).required()
  }),

  goal: Joi.object({
    title: Joi.string().min(1).required(),
    description: Joi.string().allow(''),
    targetAmount: Joi.number().min(0).required(),
    targetDate: Joi.date().iso(),
    category: Joi.string().allow(''),
    priority: Joi.string().valid('low', 'medium', 'high').default('medium')
  }),

  portfolio: Joi.object({
    name: Joi.string().min(1).required(),
    description: Joi.string().allow(''),
    riskLevel: Joi.string().valid('conservative', 'moderate', 'aggressive').default('moderate')
  }),

  holding: Joi.object({
    symbol: Joi.string().min(1).required(),
    name: Joi.string().allow(''),
    quantity: Joi.number().min(0).required(),
    purchasePrice: Joi.number().min(0).required(),
    currentPrice: Joi.number().min(0)
  }),

  debt: Joi.object({
    name: Joi.string().min(1).required(),
    type: Joi.string().min(1).required(),
    balance: Joi.number().min(0).required(),
    interestRate: Joi.number().min(0).max(100),
    minimumPayment: Joi.number().min(0),
    dueDate: Joi.date().iso()
  })
};