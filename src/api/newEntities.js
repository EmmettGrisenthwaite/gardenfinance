import { apiClient } from './client.js';

// Base entity class with common methods
class BaseEntity {
  constructor(entityName) {
    this.entityName = entityName;
  }

  async create(data) {
    return await apiClient.create(this.entityName, data);
  }

  async filter(filterObj = {}) {
    return await apiClient.findAll(this.entityName, filterObj);
  }

  async findById(id) {
    return await apiClient.findById(this.entityName, id);
  }

  async update(id, data) {
    return await apiClient.update(this.entityName, id, data);
  }

  async delete(id) {
    return await apiClient.delete(this.entityName, id);
  }
}

// Budget entity
class BudgetEntity extends BaseEntity {
  constructor() {
    super('budgets');
  }

  async create(data) {
    // Transform data to match backend expectations
    const transformedData = {
      name: data.name || 'My Budget',
      monthlyIncome: data.monthly_income || 0,
      categories: data.categories || {}
    };
    return await apiClient.create(this.entityName, transformedData);
  }
}

// Goal entity
class GoalEntity extends BaseEntity {
  constructor() {
    super('goals');
  }

  async create(data) {
    const transformedData = {
      title: data.title,
      description: data.description || '',
      targetAmount: data.target_amount || 0,
      targetDate: data.target_date,
      category: data.category || '',
      priority: data.priority || 'medium'
    };
    return await apiClient.create(this.entityName, transformedData);
  }

  async updateProgress(id, currentAmount) {
    return await apiClient.updateGoalProgress(id, currentAmount);
  }
}

// Portfolio entity
class PortfolioEntity extends BaseEntity {
  constructor() {
    super('portfolios');
  }

  async create(data) {
    const transformedData = {
      name: data.name,
      description: data.description || '',
      riskLevel: data.risk_level || 'moderate'
    };
    return await apiClient.create(this.entityName, transformedData);
  }

  async addHolding(portfolioId, holdingData) {
    const transformedData = {
      symbol: holdingData.symbol,
      name: holdingData.name || '',
      quantity: holdingData.quantity,
      purchasePrice: holdingData.purchase_price,
      currentPrice: holdingData.current_price
    };
    return await apiClient.addPortfolioHolding(portfolioId, transformedData);
  }

  async updateHolding(portfolioId, holdingId, updates) {
    return await apiClient.updatePortfolioHolding(portfolioId, holdingId, updates);
  }

  async removeHolding(portfolioId, holdingId) {
    return await apiClient.removePortfolioHolding(portfolioId, holdingId);
  }
}

// Debt entity
class DebtEntity extends BaseEntity {
  constructor() {
    super('debts');
  }

  async create(data) {
    const transformedData = {
      name: data.name,
      type: data.type,
      balance: data.balance,
      interestRate: data.interest_rate,
      minimumPayment: data.minimum_payment,
      dueDate: data.due_date
    };
    return await apiClient.create(this.entityName, transformedData);
  }

  async makePayment(id, paymentAmount) {
    return await apiClient.makeDebtPayment(id, paymentAmount);
  }
}

// Achievement entity
class AchievementEntity extends BaseEntity {
  constructor() {
    super('achievements');
  }

  // Achievements are read-only for users
  async create() {
    throw new Error('Achievements are automatically created by the system');
  }

  async update() {
    throw new Error('Achievements cannot be updated');
  }

  async delete() {
    throw new Error('Achievements cannot be deleted');
  }
}

// User entity (for auth operations)
class UserEntity {
  async register(userData) {
    return await apiClient.register({
      email: userData.email,
      password: userData.password,
      firstName: userData.firstName || userData.first_name,
      lastName: userData.lastName || userData.last_name
    });
  }

  async login(credentials) {
    return await apiClient.login(credentials);
  }

  async logout() {
    return await apiClient.logout();
  }

  async me() {
    return await apiClient.me();
  }

  async updateProfile(updates) {
    return await apiClient.updateProfile(updates);
  }
}

// Export instances
export const Budget = new BudgetEntity();
export const Goal = new GoalEntity();
export const Portfolio = new PortfolioEntity();
export const Debt = new DebtEntity();
export const Achievement = new AchievementEntity();
export const User = new UserEntity();