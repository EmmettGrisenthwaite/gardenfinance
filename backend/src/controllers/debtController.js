import { Debt } from '../models/Debt.js';
import { Achievement } from '../models/Achievement.js';

export const createDebt = async (req, res) => {
  try {
    const { name, type, balance, interestRate, minimumPayment, dueDate } = req.body;
    
    const debt = await Debt.create({
      userId: req.user.id,
      name,
      type,
      balance,
      interestRate,
      minimumPayment,
      dueDate
    });

    res.status(201).json({
      message: 'Debt created successfully',
      debt
    });
  } catch (error) {
    console.error('Create debt error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getDebts = async (req, res) => {
  try {
    const filter = req.query;
    let debts;
    
    if (Object.keys(filter).length > 0) {
      debts = await Debt.findByUserIdWithFilter(req.user.id, filter);
    } else {
      debts = await Debt.findByUserId(req.user.id);
    }

    res.json({
      debts
    });
  } catch (error) {
    console.error('Get debts error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const getDebt = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    
    if (!debt) {
      return res.status(404).json({
        error: 'Debt not found'
      });
    }

    if (debt.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    res.json({
      debt
    });
  } catch (error) {
    console.error('Get debt error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const updateDebt = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    
    if (!debt) {
      return res.status(404).json({
        error: 'Debt not found'
      });
    }

    if (debt.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const updatedDebt = await Debt.update(req.params.id, req.body);

    res.json({
      message: 'Debt updated successfully',
      debt: updatedDebt
    });
  } catch (error) {
    console.error('Update debt error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const makePayment = async (req, res) => {
  try {
    const { paymentAmount } = req.body;
    const debt = await Debt.findById(req.params.id);
    
    if (!debt) {
      return res.status(404).json({
        error: 'Debt not found'
      });
    }

    if (debt.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const updatedDebt = await Debt.makePayment(req.params.id, paymentAmount);

    // Check if debt was paid off completely
    if (updatedDebt.balance === 0 && debt.balance > 0) {
      await Achievement.checkAndAwardAchievements(req.user.id, 'debt_paid_off');
    }

    res.json({
      message: 'Payment recorded successfully',
      debt: updatedDebt
    });
  } catch (error) {
    console.error('Make payment error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};

export const deleteDebt = async (req, res) => {
  try {
    const debt = await Debt.findById(req.params.id);
    
    if (!debt) {
      return res.status(404).json({
        error: 'Debt not found'
      });
    }

    if (debt.user_id !== req.user.id) {
      return res.status(403).json({
        error: 'Access denied'
      });
    }

    const deleted = await Debt.delete(req.params.id);

    if (deleted) {
      res.json({
        message: 'Debt deleted successfully'
      });
    } else {
      res.status(500).json({
        error: 'Failed to delete debt'
      });
    }
  } catch (error) {
    console.error('Delete debt error:', error);
    res.status(500).json({
      error: 'Internal server error'
    });
  }
};