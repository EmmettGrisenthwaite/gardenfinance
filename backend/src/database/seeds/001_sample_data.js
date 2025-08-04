import { User } from '../../models/User.js';
import { Budget } from '../../models/Budget.js';
import { Goal } from '../../models/Goal.js';
import { Portfolio } from '../../models/Portfolio.js';
import { Debt } from '../../models/Debt.js';
import { Achievement } from '../../models/Achievement.js';

export const seed = async (db) => {
  console.log('Seeding sample data...');

  try {
    // Create a demo user
    const demoUser = await User.create({
      email: 'demo@example.com',
      password: 'demo123',
      firstName: 'Demo',
      lastName: 'User'
    });

    console.log('Created demo user:', demoUser.email);

    // Mark onboarding as completed
    await User.update(demoUser.id, { onboarding_completed: true });

    // Create sample budget
    const budget = await Budget.create({
      userId: demoUser.id,
      name: 'Monthly Budget 2024',
      monthlyIncome: 5000,
      categories: {
        housing: 1500,
        food: 600,
        transportation: 400,
        entertainment: 300,
        shopping: 200,
        subscriptions: 100,
        debt_payments: 500,
        savings: 1000,
        other: 400
      }
    });

    console.log('Created sample budget:', budget.name);

    // Create sample goals
    const emergencyFund = await Goal.create({
      userId: demoUser.id,
      title: 'Emergency Fund',
      description: 'Build 6 months of expenses for emergencies',
      targetAmount: 18000,
      targetDate: '2024-12-31',
      category: 'savings',
      priority: 'high'
    });

    const vacation = await Goal.create({
      userId: demoUser.id,
      title: 'European Vacation',
      description: 'Save for a 2-week trip to Europe',
      targetAmount: 5000,
      targetDate: '2024-08-15',
      category: 'travel',
      priority: 'medium'
    });

    const houseFund = await Goal.create({
      userId: demoUser.id,
      title: 'House Down Payment',
      description: 'Save 20% down payment for a house',
      targetAmount: 60000,
      targetDate: '2025-12-31',
      category: 'housing',
      priority: 'high'
    });

    // Update progress on some goals
    await Goal.updateProgress(emergencyFund.id, 4500);
    await Goal.updateProgress(vacation.id, 2100);

    console.log('Created sample goals');

    // Create sample portfolio
    const portfolio = await Portfolio.create({
      userId: demoUser.id,
      name: 'Investment Portfolio',
      description: 'Diversified long-term investment portfolio',
      riskLevel: 'moderate'
    });

    // Add sample holdings
    await Portfolio.addHolding({
      portfolioId: portfolio.id,
      symbol: 'VTI',
      name: 'Vanguard Total Stock Market ETF',
      quantity: 25,
      purchasePrice: 220.50,
      currentPrice: 235.20
    });

    await Portfolio.addHolding({
      portfolioId: portfolio.id,
      symbol: 'BND',
      name: 'Vanguard Total Bond Market ETF',
      quantity: 15,
      purchasePrice: 78.40,
      currentPrice: 79.10
    });

    await Portfolio.addHolding({
      portfolioId: portfolio.id,
      symbol: 'VTIAX',
      name: 'Vanguard Total International Stock',
      quantity: 10,
      purchasePrice: 28.75,
      currentPrice: 29.20
    });

    console.log('Created sample portfolio with holdings');

    // Create sample debts
    const creditCard = await Debt.create({
      userId: demoUser.id,
      name: 'Chase Sapphire Credit Card',
      type: 'credit_card',
      balance: 2500,
      interestRate: 18.99,
      minimumPayment: 75,
      dueDate: '2024-02-15'
    });

    const studentLoan = await Debt.create({
      userId: demoUser.id,
      name: 'Federal Student Loan',
      type: 'student_loan',
      balance: 15000,
      interestRate: 4.5,
      minimumPayment: 200,
      dueDate: '2024-02-01'
    });

    const carLoan = await Debt.create({
      userId: demoUser.id,
      name: 'Honda Civic Car Loan',
      type: 'auto_loan',
      balance: 8500,
      interestRate: 3.2,
      minimumPayment: 225,
      dueDate: '2024-02-10'
    });

    console.log('Created sample debts');

    // Create sample achievements
    await Achievement.create({
      userId: demoUser.id,
      title: 'Budget Builder',
      description: 'Created your first budget',
      type: 'budget'
    });

    await Achievement.create({
      userId: demoUser.id,
      title: 'Goal Setter',
      description: 'Set your first financial goal',
      type: 'goal'
    });

    await Achievement.create({
      userId: demoUser.id,
      title: 'Investor',
      description: 'Created your first investment portfolio',
      type: 'portfolio'
    });

    console.log('Created sample achievements');
    console.log('✅ Sample data seeding completed successfully!');
    console.log('');
    console.log('Demo user credentials:');
    console.log('Email: demo@example.com');
    console.log('Password: demo123');

  } catch (error) {
    console.error('Error seeding data:', error);
    throw error;
  }
};