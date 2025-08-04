import { Goal } from '../models/Goal.js';
import { Achievement } from '../models/Achievement.js';

export const createGoal = async (req, res) => {
  try {
    const { title, description, targetAmount, targetDate, category, priority } = req.body;
    
    const goal = await Goal.create({
      userId: req.user.id,
      title,
      description,
      targetAmount,
      targetDate,
      category,
      priority
    });

    // Check for achievements
    const userGoals = await Goal.findByUserId(req.user.id);
    if (userGoals.length === 1) {
      await Achievement.checkAndAwardAchievements(req.user.id, 'first_goal_created');
    }

    res.status(201).json({
      message: 'Goal created successfully',
      goal
    });
  } catch (error) {
    console.error('Create goal error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getGoals = async (req, res) => {
  try {
    const filter = req.query;
    let goals;
    
    if (Object.keys(filter).length > 0) {
      goals = await Goal.findByUserIdWithFilter(req.user.id, filter);
    } else {
      goals = await Goal.findByUserId(req.user.id);
    }

    res.json({
      goals
    });
  } catch (error) {
    console.error('Get goals error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        error: 'Goal not found'
      });
    }

    if (goal.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      goal
    });
  } catch (error) {
    console.error('Get goal error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updateGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        error: 'Goal not found'
      });
    }

    if (goal.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const updatedGoal = await Goal.update(req.params.id, req.body);

    // Check if goal was completed
    if (req.body.is_completed && !goal.is_completed) {
      await Achievement.checkAndAwardAchievements(req.user.id, 'goal_completed');
    }

    res.json({
      message: 'Goal updated successfully',
      goal: updatedGoal
    });
  } catch (error) {
    console.error('Update goal error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updateGoalProgress = async (req, res) => {
  try {
    const { currentAmount } = req.body;
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        error: 'Goal not found'
      });
    }

    if (goal.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const updatedGoal = await Goal.updateProgress(req.params.id, currentAmount);

    // Check if goal was completed
    if (updatedGoal.is_completed && !goal.is_completed) {
      await Achievement.checkAndAwardAchievements(req.user.id, 'goal_completed');
    }

    res.json({
      message: 'Goal progress updated successfully',
      goal: updatedGoal
    });
  } catch (error) {
    console.error('Update goal progress error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const deleteGoal = async (req, res) => {
  try {
    const goal = await Goal.findById(req.params.id);
    
    if (!goal) {
      return res.status(404).json({
        error: 'Goal not found'
      });
    }

    if (goal.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const deleted = await Goal.delete(req.params.id);

    if (deleted) {
      res.json({
        message: 'Goal deleted successfully'
      });
    } else {
      res.status(500).json({
        error: 'Failed to delete goal'
      });
    }
  } catch (error) {
    console.error('Delete goal error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};