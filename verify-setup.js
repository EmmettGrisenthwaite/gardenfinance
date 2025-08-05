#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

console.log('🔍 Verifying Financial Planning App Setup');
console.log('=========================================\n');

let errors = [];

// Check files exist
const requiredFiles = [
  'package.json',
  'backend/package.json',
  'backend/src/server.js',
  'backend/database.sqlite',
  'src/api/client.js',
  'src/api/newEntities.js',
  '.env.local'
];

console.log('📂 Checking required files...');
requiredFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - MISSING`);
    errors.push(`Missing file: ${file}`);
  }
});

// Check database tables
console.log('\n🗄️  Checking database schema...');
try {
  const Database = await import('./backend/src/config/database.js');
  const db = Database.db;
  await db.connect();
  
  const tables = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
  const expectedTables = ['users', 'budgets', 'goals', 'portfolios', 'portfolio_holdings', 'debts', 'achievements', 'transactions', 'migrations'];
  
  expectedTables.forEach(table => {
    const exists = tables.some(t => t.name === table);
    if (exists) {
      console.log(`   ✅ Table: ${table}`);
    } else {
      console.log(`   ❌ Table: ${table} - MISSING`);
      errors.push(`Missing table: ${table}`);
    }
  });
  
  // Check if we have sample data
  const userCount = await db.query('SELECT COUNT(*) as count FROM users');
  if (userCount[0].count > 0) {
    console.log(`   ✅ Sample data (${userCount[0].count} users)`);
  } else {
    console.log(`   ⚠️  No sample data found`);
  }
  
  await db.close();
} catch (error) {
  console.log(`   ❌ Database connection failed: ${error.message}`);
  errors.push(`Database error: ${error.message}`);
}

// Check environment variables
console.log('\n🔧 Checking environment configuration...');
try {
  const envContent = fs.readFileSync('.env.local', 'utf8');
  if (envContent.includes('VITE_API_URL=http://localhost:3001/api')) {
    console.log('   ✅ Frontend API URL configured');
  } else {
    console.log('   ❌ Frontend API URL not configured correctly');
    errors.push('Frontend API URL configuration issue');
  }
} catch (error) {
  console.log('   ❌ .env.local file issue');
  errors.push('.env.local file missing or unreadable');
}

try {
  const backendEnvContent = fs.readFileSync('backend/.env', 'utf8');
  if (backendEnvContent.includes('PORT=3001') && backendEnvContent.includes('JWT_SECRET')) {
    console.log('   ✅ Backend environment configured');
  } else {
    console.log('   ❌ Backend environment not configured correctly');
    errors.push('Backend environment configuration issue');
  }
} catch (error) {
  console.log('   ❌ backend/.env file issue');
  errors.push('backend/.env file missing or unreadable');
}

// Test backend startup
console.log('\n🚀 Testing backend startup...');
try {
  const backendProcess = spawn('node', ['src/server.js'], { 
    cwd: 'backend',
    stdio: 'pipe'
  });
  
  let backendStarted = false;
  
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Backend startup timeout')), 10000);
  });
  
  const startupPromise = new Promise((resolve, reject) => {
    backendProcess.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('Server running on port')) {
        backendStarted = true;
        resolve();
      }
    });
    
    backendProcess.stderr.on('data', (data) => {
      const error = data.toString();
      if (error.includes('Error') || error.includes('error')) {
        reject(new Error(error));
      }
    });
  });
  
  await Promise.race([startupPromise, timeoutPromise]);
  
  // Test API endpoint
  const response = await fetch('http://localhost:3001/health');
  if (response.ok) {
    console.log('   ✅ Backend API responding');
  } else {
    console.log('   ❌ Backend API not responding correctly');
    errors.push('Backend API health check failed');
  }
  
  backendProcess.kill();
  
} catch (error) {
  console.log(`   ❌ Backend startup failed: ${error.message}`);
  errors.push(`Backend startup error: ${error.message}`);
}

// Summary
console.log('\n📋 Verification Summary');
console.log('=======================');

if (errors.length === 0) {
  console.log('🎉 ALL CHECKS PASSED! Your app is ready for development.');
  console.log('\n🚀 To start developing:');
  console.log('   npm run full-dev');
  console.log('\n👤 Demo login credentials:');
  console.log('   Email: demo@example.com');
  console.log('   Password: demo123');
  console.log('\n🌐 URLs:');
  console.log('   Frontend: http://localhost:5173');
  console.log('   Backend:  http://localhost:3001/api');
} else {
  console.log('❌ ISSUES FOUND:');
  errors.forEach(error => console.log(`   • ${error}`));
  console.log('\n💡 Try running: npm run fresh-setup');
}

process.exit(errors.length === 0 ? 0 : 1);