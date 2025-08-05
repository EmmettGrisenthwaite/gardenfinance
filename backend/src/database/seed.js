import { db } from '../config/database.js';
import { seed as sampleData } from './seeds/001_sample_data.js';
import dotenv from 'dotenv';

dotenv.config();

async function runSeeds() {
  try {
    await db.connect();
    
    console.log('🌱 Running database seeds...');
    
    // Check if we already have users to avoid duplicating seed data
    const existingUsers = await db.query('SELECT COUNT(*) as count FROM users');
    if (existingUsers[0].count > 0) {
      console.log('Database already has users, skipping seed data');
      console.log('To reset and reseed, delete the database file and run migrations again');
      return;
    }

    await sampleData(db);
    
    console.log('🎉 All seeds completed successfully!');
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run seeds if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runSeeds();
}