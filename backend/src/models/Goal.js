import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export class Goal {
  static async create({ userId, title, description, targetAmount, targetDate, category, priority = 'medium' }) {
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO goals (id, user_id, title, description, target_amount, target_date, category, priority) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, title, description, targetAmount, targetDate, category, priority]
    );

    return this.findById(id);
  }

  static async findById(id) {
    return db.get('SELECT * FROM goals WHERE id = ?', [id]);
  }

  static async findByUserId(userId) {
    return db.query('SELECT * FROM goals WHERE user_id = ? ORDER BY created_at DESC', [userId]);
  }

  static async update(id, updates) {
    const allowedFields = ['title', 'description', 'target_amount', 'current_amount', 'target_date', 'category', 'priority', 'is_completed'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return this.findById(id);
    }

    const setClause = Object.keys(filteredUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(filteredUpdates), id];

    await db.run(
      `UPDATE goals SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM goals WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async findByUserIdWithFilter(userId, filter = {}) {
    let query = 'SELECT * FROM goals WHERE user_id = ?';
    const params = [userId];

    if (filter.created_by) {
      // For compatibility with Base44 SDK filter format
      query += ' AND user_id = ?';
      params.push(filter.created_by);
    }

    if (filter.is_completed !== undefined) {
      query += ' AND is_completed = ?';
      params.push(filter.is_completed);
    }

    query += ' ORDER BY created_at DESC';
    
    return db.query(query, params);
  }

  static async updateProgress(id, currentAmount) {
    const goal = await this.findById(id);
    if (!goal) {
      throw new Error('Goal not found');
    }

    const isCompleted = currentAmount >= goal.target_amount;
    
    await db.run(
      'UPDATE goals SET current_amount = ?, is_completed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [currentAmount, isCompleted, id]
    );

    return this.findById(id);
  }
}