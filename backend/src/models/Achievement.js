import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export class Achievement {
  static async create({ userId, title, description, type }) {
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO achievements (id, user_id, title, description, type) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, title, description, type]
    );

    return this.findById(id);
  }

  static async findById(id) {
    return db.get('SELECT * FROM achievements WHERE id = ?', [id]);
  }

  static async findByUserId(userId) {
    return db.query('SELECT * FROM achievements WHERE user_id = ? ORDER BY earned_at DESC', [userId]);
  }

  static async findByUserIdWithFilter(userId, filter = {}) {
    let query = 'SELECT * FROM achievements WHERE user_id = ?';
    const params = [userId];

    if (filter.created_by) {
      // For compatibility with Base44 SDK filter format
      query += ' AND user_id = ?';
      params.push(filter.created_by);
    }

    if (filter.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }

    query += ' ORDER BY earned_at DESC';
    
    return db.query(query, params);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM achievements WHERE id = ?', [id]);
    return result.changes > 0;
  }

  // Predefined achievement triggers
  static async checkAndAwardAchievements(userId, eventType, eventData = {}) {
    const achievements = [];

    switch (eventType) {
      case 'first_budget_created':
        achievements.push(await this.awardIfNotExists(userId, {
          title: 'Budget Builder',
          description: 'Created your first budget',
          type: 'budget'
        }));
        break;

      case 'first_goal_created':
        achievements.push(await this.awardIfNotExists(userId, {
          title: 'Goal Setter',
          description: 'Set your first financial goal',
          type: 'goal'
        }));
        break;

      case 'goal_completed':
        achievements.push(await this.awardIfNotExists(userId, {
          title: 'Goal Achiever',
          description: 'Completed your first financial goal',
          type: 'goal'
        }));
        break;

      case 'first_portfolio_created':
        achievements.push(await this.awardIfNotExists(userId, {
          title: 'Investor',
          description: 'Created your first investment portfolio',
          type: 'portfolio'
        }));
        break;

      case 'debt_paid_off':
        achievements.push(await this.awardIfNotExists(userId, {
          title: 'Debt Free',
          description: 'Paid off a debt completely',
          type: 'debt'
        }));
        break;
    }

    return achievements.filter(Boolean);
  }

  static async awardIfNotExists(userId, achievementData) {
    // Check if user already has this achievement
    const existing = await db.get(
      'SELECT id FROM achievements WHERE user_id = ? AND title = ?',
      [userId, achievementData.title]
    );

    if (existing) {
      return null;
    }

    return this.create({ userId, ...achievementData });
  }
}