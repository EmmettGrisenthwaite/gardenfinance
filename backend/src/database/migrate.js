import { db } from '../config/database.js';
import { up as initialSchema } from './migrations/001_initial_schema.js';
import dotenv from 'dotenv';

dotenv.config();

async function runMigrations() {
  try {
    await db.connect();
    
    // Create migrations table to track which migrations have been run
    await db.run(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Check if initial schema migration has been run
    const existingMigration = await db.get(
      'SELECT * FROM migrations WHERE name = ?',
      ['001_initial_schema']
    );

    if (!existingMigration) {
      console.log('Running initial schema migration...');
      await initialSchema(db);
      await db.run(
        'INSERT INTO migrations (name) VALUES (?)',
        ['001_initial_schema']
      );
      console.log('Initial schema migration completed');
    } else {
      console.log('Initial schema migration already exists');
    }

    console.log('All migrations completed successfully');
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run migrations if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runMigrations();
}