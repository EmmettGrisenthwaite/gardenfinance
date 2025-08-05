const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

class APIClient {
  constructor() {
    this.baseURL = API_BASE_URL;
    this.token = localStorage.getItem('auth_token');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('auth_token', token);
    } else {
      localStorage.removeItem('auth_token');
    }
  }

  getHeaders() {
    const headers = {
      'Content-Type': 'application/json',
    };

    if (this.token) {
      headers.Authorization = `Bearer ${this.token}`;
    }

    return headers;
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    
    const config = {
      headers: this.getHeaders(),
      ...options,
    };

    if (config.body && typeof config.body === 'object') {
      config.body = JSON.stringify(config.body);
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  // Auth methods
  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: userData,
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async login(credentials) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: credentials,
    });
    
    if (response.token) {
      this.setToken(response.token);
    }
    
    return response;
  }

  async logout() {
    this.setToken(null);
  }

  async me() {
    const response = await this.request('/auth/me');
    return response.user;
  }

  async updateProfile(updates) {
    const response = await this.request('/auth/profile', {
      method: 'PUT',
      body: updates,
    });
    return response.user;
  }

  // Generic CRUD methods for entities
  async create(entity, data) {
    const response = await this.request(`/${entity}`, {
      method: 'POST',
      body: data,
    });
    return response[entity.slice(0, -1)]; // Remove 's' from entity name
  }

  async findAll(entity, filter = {}) {
    const queryParams = new URLSearchParams(filter).toString();
    const endpoint = queryParams ? `/${entity}?${queryParams}` : `/${entity}`;
    const response = await this.request(endpoint);
    return response[entity];
  }

  async findById(entity, id) {
    const response = await this.request(`/${entity}/${id}`);
    return response[entity.slice(0, -1)];
  }

  async update(entity, id, data) {
    const response = await this.request(`/${entity}/${id}`, {
      method: 'PUT',
      body: data,
    });
    return response[entity.slice(0, -1)];
  }

  async delete(entity, id) {
    await this.request(`/${entity}/${id}`, {
      method: 'DELETE',
    });
    return true;
  }

  // Specific entity methods
  async updateGoalProgress(goalId, currentAmount) {
    const response = await this.request(`/goals/${goalId}/progress`, {
      method: 'PUT',
      body: { currentAmount },
    });
    return response.goal;
  }

  async makeDebtPayment(debtId, paymentAmount) {
    const response = await this.request(`/debts/${debtId}/payment`, {
      method: 'PUT',
      body: { paymentAmount },
    });
    return response.debt;
  }

  async addPortfolioHolding(portfolioId, holdingData) {
    const response = await this.request(`/portfolios/${portfolioId}/holdings`, {
      method: 'POST',
      body: holdingData,
    });
    return response.portfolio;
  }

  async updatePortfolioHolding(portfolioId, holdingId, updates) {
    await this.request(`/portfolios/${portfolioId}/holdings/${holdingId}`, {
      method: 'PUT',
      body: updates,
    });
  }

  async removePortfolioHolding(portfolioId, holdingId) {
    await this.request(`/portfolios/${portfolioId}/holdings/${holdingId}`, {
      method: 'DELETE',
    });
  }
}

export const apiClient = new APIClient();