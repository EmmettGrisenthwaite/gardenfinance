import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export class Debt {
  static async create({ userId, name, type, balance, interestRate, minimumPayment, dueDate }) {
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO debts (id, user_id, name, type, balance, interest_rate, minimum_payment, due_date) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, name, type, balance, interestRate, minimumPayment, dueDate]
    );

    return this.findById(id);
  }

  static async findById(id) {
    return db.get('SELECT * FROM debts WHERE id = ?', [id]);
  }

  static async findByUserId(userId) {
    return db.query('SELECT * FROM debts WHERE user_id = ? ORDER BY due_date ASC, created_at DESC', [userId]);
  }

  static async update(id, updates) {
    const allowedFields = ['name', 'type', 'balance', 'interest_rate', 'minimum_payment', 'due_date'];
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
      `UPDATE debts SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async makePayment(id, paymentAmount) {
    const debt = await this.findById(id);
    if (!debt) {
      throw new Error('Debt not found');
    }

    const newBalance = Math.max(0, debt.balance - paymentAmount);
    
    await db.run(
      'UPDATE debts SET balance = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newBalance, id]
    );

    return this.findById(id);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM debts WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async findByUserIdWithFilter(userId, filter = {}) {
    let query = 'SELECT * FROM debts WHERE user_id = ?';
    const params = [userId];

    if (filter.created_by) {
      // For compatibility with filter format
      query += ' AND user_id = ?';
      params.push(filter.created_by);
    }

    if (filter.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }

    query += ' ORDER BY due_date ASC, created_at DESC';
    
    return db.query(query, params);
  }

  static async getTotalDebt(userId) {
    const result = await db.get(
      'SELECT SUM(balance) as total_debt FROM debts WHERE user_id = ?',
      [userId]
    );
    return result?.total_debt || 0;
  }

  static async getMonthlyPayments(userId) {
    const result = await db.get(
      'SELECT SUM(minimum_payment) as total_monthly_payments FROM debts WHERE user_id = ?',
      [userId]
    );
    return result?.total_monthly_payments || 0;
  }
}