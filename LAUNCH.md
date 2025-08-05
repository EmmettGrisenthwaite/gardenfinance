# 🚀 Quick Launch Guide

## Instant Setup & Launch

### Option 1: One-Command Launch (Recommended)
```bash
./start.sh
```

### Option 2: Manual Setup
```bash
# Complete setup with sample data
npm run setup

# Start both frontend and backend
npm run full-dev
```

### Option 3: Fresh Install
```bash
# Reset everything and start fresh
npm run fresh-setup

# Start the application
npm run full-dev
```

## Access Your App

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001/api
- **API Health**: http://localhost:3001/health

## Demo Login Credentials

- **Email**: `demo@example.com`
- **Password**: `demo123`

## Verify Everything Works

```bash
npm run verify
```

## What's Included in Sample Data

✅ **Demo User Account**
- Complete profile with onboarding completed
- Ready to use immediately

✅ **Sample Budget**
- $5,000 monthly income
- 9 spending categories allocated
- Realistic budget distribution

✅ **Financial Goals**
- Emergency Fund ($18,000 target)
- European Vacation ($5,000 target)  
- House Down Payment ($60,000 target)
- Some goals have progress already

✅ **Investment Portfolio**
- 3 diversified holdings (VTI, BND, VTIAX)
- Real stock prices and quantities
- Portfolio value calculations

✅ **Debt Accounts**
- Credit card debt ($2,500)
- Student loan ($15,000)
- Car loan ($8,500)
- Different interest rates and payment schedules

✅ **Achievements**
- Budget Builder achievement
- Goal Setter achievement
- Investor achievement

## Quick Commands

| Command | Description |
|---------|-------------|
| `npm run full-dev` | Start both frontend and backend |
| `npm run dev` | Frontend only |
| `npm run backend` | Backend only |
| `npm run verify` | Test everything works |
| `npm run fresh-setup` | Reset database and restart |

## Troubleshooting

### Database Issues
```bash
npm run fresh-setup
```

### Port Conflicts
- Frontend uses port 5173
- Backend uses port 3001
- Make sure these ports are available

### Dependencies Issues
```bash
rm -rf node_modules backend/node_modules
npm install
cd backend && npm install
```

## Development Notes

- The app automatically saves all changes to the SQLite database
- No external services required - everything runs locally
- Hot reload enabled for both frontend and backend
- All external integrations replaced with smart mocks

## Ready to Code!

Your financial planning app is now running with:
- Full authentication system
- Complete database with sample data
- All CRUD operations working
- Beautiful responsive UI
- Real-time data updates

Start building new features immediately! 🎉