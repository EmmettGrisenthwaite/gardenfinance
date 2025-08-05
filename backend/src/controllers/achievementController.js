import { Achievement } from '../models/Achievement.js';

export const getAchievements = async (req, res) => {
  try {
    const filter = req.query;
    let achievements;
    
    if (Object.keys(filter).length > 0) {
      achievements = await Achievement.findByUserIdWithFilter(req.user.id, filter);
    } else {
      achievements = await Achievement.findByUserId(req.user.id);
    }

    res.json({
      achievements
    });
  } catch (error) {
    console.error('Get achievements error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getAchievement = async (req, res) => {
  try {
    const achievement = await Achievement.findById(req.params.id);
    
    if (!achievement) {
      return res.status(404).json({
        error: 'Achievement not found'
      });
    }

    if (achievement.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      achievement
    });
  } catch (error) {
    console.error('Get achievement error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};