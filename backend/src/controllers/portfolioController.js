import { Portfolio } from '../models/Portfolio.js';
import { Achievement } from '../models/Achievement.js';

export const createPortfolio = async (req, res) => {
  try {
    const { name, description, riskLevel } = req.body;
    
    const portfolio = await Portfolio.create({
      userId: req.user.id,
      name,
      description,
      riskLevel
    });

    // Check for achievements
    const userPortfolios = await Portfolio.findByUserId(req.user.id);
    if (userPortfolios.length === 1) {
      await Achievement.checkAndAwardAchievements(req.user.id, 'first_portfolio_created');
    }

    res.status(201).json({
      message: 'Portfolio created successfully',
      portfolio
    });
  } catch (error) {
    console.error('Create portfolio error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getPortfolios = async (req, res) => {
  try {
    const filter = req.query;
    let portfolios;
    
    if (Object.keys(filter).length > 0) {
      portfolios = await Portfolio.findByUserIdWithFilter(req.user.id, filter);
    } else {
      portfolios = await Portfolio.findByUserId(req.user.id);
    }

    res.json({
      portfolios
    });
  } catch (error) {
    console.error('Get portfolios error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getPortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({
        error: 'Portfolio not found'
      });
    }

    if (portfolio.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      portfolio
    });
  } catch (error) {
    console.error('Get portfolio error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updatePortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({
        error: 'Portfolio not found'
      });
    }

    if (portfolio.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const updatedPortfolio = await Portfolio.update(req.params.id, req.body);

    res.json({
      message: 'Portfolio updated successfully',
      portfolio: updatedPortfolio
    });
  } catch (error) {
    console.error('Update portfolio error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const deletePortfolio = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({
        error: 'Portfolio not found'
      });
    }

    if (portfolio.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const deleted = await Portfolio.delete(req.params.id);

    if (deleted) {
      res.json({
        message: 'Portfolio deleted successfully'
      });
    } else {
      res.status(500).json({
        error: 'Failed to delete portfolio'
      });
    }
  } catch (error) {
    console.error('Delete portfolio error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const addHolding = async (req, res) => {
  try {
    const portfolio = await Portfolio.findById(req.params.id);
    
    if (!portfolio) {
      return res.status(404).json({
        error: 'Portfolio not found'
      });
    }

    if (portfolio.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const { symbol, name, quantity, purchasePrice, currentPrice } = req.body;
    
    const updatedPortfolio = await Portfolio.addHolding({
      portfolioId: req.params.id,
      symbol,
      name,
      quantity,
      purchasePrice,
      currentPrice
    });

    res.status(201).json({
      message: 'Holding added successfully',
      portfolio: updatedPortfolio
    });
  } catch (error) {
    console.error('Add holding error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updateHolding = async (req, res) => {
  try {
    await Portfolio.updateHolding(req.params.holdingId, req.body);

    res.json({
      message: 'Holding updated successfully'
    });
  } catch (error) {
    console.error('Update holding error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const removeHolding = async (req, res) => {
  try {
    const deleted = await Portfolio.removeHolding(req.params.holdingId);

    if (deleted) {
      res.json({
        message: 'Holding removed successfully'
      });
    } else {
      res.status(404).json({
        error: 'Holding not found'
      });
    }
  } catch (error) {
    console.error('Remove holding error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};