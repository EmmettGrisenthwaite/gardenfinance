import { Budget } from '../models/Budget.js';
import { Achievement } from '../models/Achievement.js';

export const createBudget = async (req, res) => {
  try {
    const { name, monthlyIncome, categories } = req.body;
    
    const budget = await Budget.create({
      userId: req.user.id,
      name,
      monthlyIncome,
      categories
    });

    // Check for achievements
    const userBudgets = await Budget.findByUserId(req.user.id);
    if (userBudgets.length === 1) {
      await Achievement.checkAndAwardAchievements(req.user.id, 'first_budget_created');
    }

    res.status(201).json({
      message: 'Budget created successfully',
      budget
    });
  } catch (error) {
    console.error('Create budget error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getBudgets = async (req, res) => {
  try {
    const filter = req.query;
    let budgets;
    
    if (Object.keys(filter).length > 0) {
      budgets = await Budget.findByUserIdWithFilter(req.user.id, filter);
    } else {
      budgets = await Budget.findByUserId(req.user.id);
    }

    res.json({
      budgets
    });
  } catch (error) {
    console.error('Get budgets error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    
    if (!budget) {
      return res.status(404).json({
        error: 'Budget not found'
      });
    }

    // Check if budget belongs to user
    if (budget.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      budget
    });
  } catch (error) {
    console.error('Get budget error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updateBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    
    if (!budget) {
      return res.status(404).json({
        error: 'Budget not found'
      });
    }

    // Check if budget belongs to user
    if (budget.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const updatedBudget = await Budget.update(req.params.id, req.body);

    res.json({
      message: 'Budget updated successfully',
      budget: updatedBudget
    });
  } catch (error) {
    console.error('Update budget error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const deleteBudget = async (req, res) => {
  try {
    const budget = await Budget.findById(req.params.id);
    
    if (!budget) {
      return res.status(404).json({
        error: 'Budget not found'
      });
    }

    // Check if budget belongs to user
    if (budget.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const deleted = await Budget.delete(req.params.id);

    if (deleted) {
      res.json({
        message: 'Budget deleted successfully'
      });
    } else {
      res.status(500).json({
        error: 'Failed to delete budget'
      });
    }
  } catch (error) {
    console.error('Delete budget error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};