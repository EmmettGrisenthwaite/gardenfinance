import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export class Budget {
  static async create({ userId, name, monthlyIncome, categories }) {
    const id = uuidv4();
    const categoriesJson = JSON.stringify(categories || {});
    
    await db.run(
      `INSERT INTO budgets (id, user_id, name, monthly_income, categories) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, name, monthlyIncome, categoriesJson]
    );

    return this.findById(id);
  }

  static async findById(id) {
    const budget = await db.get('SELECT * FROM budgets WHERE id = ?', [id]);
    if (budget && budget.categories) {
      budget.categories = JSON.parse(budget.categories);
    }
    return budget;
  }

  static async findByUserId(userId) {
    const budgets = await db.query('SELECT * FROM budgets WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    return budgets.map(budget => {
      if (budget.categories) {
        budget.categories = JSON.parse(budget.categories);
      }
      return budget;
    });
  }

  static async update(id, updates) {
    const allowedFields = ['name', 'monthly_income', 'categories'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        if (key === 'categories') {
          filteredUpdates[key] = JSON.stringify(value);
        } else {
          filteredUpdates[key] = value;
        }
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
      `UPDATE budgets SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM budgets WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async findByUserIdWithFilter(userId, filter = {}) {
    let query = 'SELECT * FROM budgets WHERE user_id = ?';
    const params = [userId];

    if (filter.created_by) {
      // For compatibility with Base44 SDK filter format
      query += ' AND user_id = ?';
      params.push(filter.created_by);
    }

    query += ' ORDER BY created_at DESC';
    
    const budgets = await db.query(query, params);
    return budgets.map(budget => {
      if (budget.categories) {
        budget.categories = JSON.parse(budget.categories);
      }
      return budget;
    });
  }
}