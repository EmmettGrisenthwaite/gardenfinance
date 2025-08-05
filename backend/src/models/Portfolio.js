import { db } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

export class Portfolio {
  static async create({ userId, name, description, riskLevel = 'moderate' }) {
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO portfolios (id, user_id, name, description, risk_level) 
       VALUES (?, ?, ?, ?, ?)`,
      [id, userId, name, description, riskLevel]
    );

    return this.findById(id);
  }

  static async findById(id) {
    const portfolio = await db.get('SELECT * FROM portfolios WHERE id = ?', [id]);
    if (portfolio) {
      portfolio.holdings = await this.getHoldings(id);
    }
    return portfolio;
  }

  static async findByUserId(userId) {
    const portfolios = await db.query('SELECT * FROM portfolios WHERE user_id = ? ORDER BY created_at DESC', [userId]);
    
    // Add holdings to each portfolio
    for (const portfolio of portfolios) {
      portfolio.holdings = await this.getHoldings(portfolio.id);
    }
    
    return portfolios;
  }

  static async getHoldings(portfolioId) {
    return db.query('SELECT * FROM portfolio_holdings WHERE portfolio_id = ? ORDER BY created_at DESC', [portfolioId]);
  }

  static async addHolding({ portfolioId, symbol, name, quantity, purchasePrice, currentPrice }) {
    const id = uuidv4();
    
    await db.run(
      `INSERT INTO portfolio_holdings (id, portfolio_id, symbol, name, quantity, purchase_price, current_price) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, portfolioId, symbol, name, quantity, purchasePrice, currentPrice]
    );

    await this.updateTotalValue(portfolioId);
    return this.findById(portfolioId);
  }

  static async updateHolding(holdingId, updates) {
    const allowedFields = ['quantity', 'current_price'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    if (Object.keys(filteredUpdates).length === 0) {
      return;
    }

    const setClause = Object.keys(filteredUpdates)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(filteredUpdates), holdingId];

    await db.run(
      `UPDATE portfolio_holdings SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    // Get portfolio ID and update total value
    const holding = await db.get('SELECT portfolio_id FROM portfolio_holdings WHERE id = ?', [holdingId]);
    if (holding) {
      await this.updateTotalValue(holding.portfolio_id);
    }
  }

  static async removeHolding(holdingId) {
    const holding = await db.get('SELECT portfolio_id FROM portfolio_holdings WHERE id = ?', [holdingId]);
    
    const result = await db.run('DELETE FROM portfolio_holdings WHERE id = ?', [holdingId]);
    
    if (holding && result.changes > 0) {
      await this.updateTotalValue(holding.portfolio_id);
    }
    
    return result.changes > 0;
  }

  static async updateTotalValue(portfolioId) {
    const holdings = await this.getHoldings(portfolioId);
    const totalValue = holdings.reduce((sum, holding) => {
      return sum + (holding.quantity * (holding.current_price || holding.purchase_price));
    }, 0);

    await db.run(
      'UPDATE portfolios SET total_value = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [totalValue, portfolioId]
    );
  }

  static async update(id, updates) {
    const allowedFields = ['name', 'description', 'risk_level'];
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
      `UPDATE portfolios SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      values
    );

    return this.findById(id);
  }

  static async delete(id) {
    const result = await db.run('DELETE FROM portfolios WHERE id = ?', [id]);
    return result.changes > 0;
  }

  static async findByUserIdWithFilter(userId, filter = {}) {
    let query = 'SELECT * FROM portfolios WHERE user_id = ?';
    const params = [userId];

    if (filter.created_by) {
      // For compatibility with filter format
      query += ' AND user_id = ?';
      params.push(filter.created_by);
    }

    query += ' ORDER BY created_at DESC';
    
    const portfolios = await db.query(query, params);
    
    // Add holdings to each portfolio
    for (const portfolio of portfolios) {
      portfolio.holdings = await this.getHoldings(portfolio.id);
    }
    
    return portfolios;
  }
}