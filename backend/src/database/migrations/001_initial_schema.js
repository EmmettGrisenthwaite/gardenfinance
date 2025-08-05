export const up = async (db) => {
  // Users table
  await db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      onboarding_completed BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Budgets table
  await db.run(`
    CREATE TABLE IF NOT EXISTS budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      monthly_income DECIMAL(10,2) DEFAULT 0,
      categories TEXT, -- JSON string for category allocations
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Goals table
  await db.run(`
    CREATE TABLE IF NOT EXISTS goals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      target_amount DECIMAL(10,2),
      current_amount DECIMAL(10,2) DEFAULT 0,
      target_date DATE,
      category TEXT,
      priority TEXT DEFAULT 'medium',
      is_completed BOOLEAN DEFAULT FALSE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Portfolios table
  await db.run(`
    CREATE TABLE IF NOT EXISTS portfolios (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      total_value DECIMAL(12,2) DEFAULT 0,
      risk_level TEXT DEFAULT 'moderate',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Portfolio holdings table
  await db.run(`
    CREATE TABLE IF NOT EXISTS portfolio_holdings (
      id TEXT PRIMARY KEY,
      portfolio_id TEXT NOT NULL,
      symbol TEXT NOT NULL,
      name TEXT,
      quantity DECIMAL(10,4),
      purchase_price DECIMAL(10,2),
      current_price DECIMAL(10,2),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (portfolio_id) REFERENCES portfolios(id) ON DELETE CASCADE
    )
  `);

  // Debts table
  await db.run(`
    CREATE TABLE IF NOT EXISTS debts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT, -- credit_card, loan, mortgage, etc.
      balance DECIMAL(10,2) NOT NULL,
      interest_rate DECIMAL(5,2),
      minimum_payment DECIMAL(10,2),
      due_date DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Achievements table
  await db.run(`
    CREATE TABLE IF NOT EXISTS achievements (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT, -- budget, goal, portfolio, etc.
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Transactions table for tracking financial activities
  await db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL, -- income, expense, transfer
      category TEXT,
      amount DECIMAL(10,2) NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  console.log('Initial schema migration completed');
};

export const down = async (db) => {
  await db.run('DROP TABLE IF EXISTS transactions');
  await db.run('DROP TABLE IF EXISTS achievements');
  await db.run('DROP TABLE IF EXISTS portfolio_holdings');
  await db.run('DROP TABLE IF EXISTS portfolios');
  await db.run('DROP TABLE IF EXISTS debts');
  await db.run('DROP TABLE IF EXISTS goals');
  await db.run('DROP TABLE IF EXISTS budgets');
  await db.run('DROP TABLE IF EXISTS users');
  
  console.log('Initial schema rollback completed');
};