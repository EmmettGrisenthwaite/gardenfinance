# Base44 Financial Planning App

A complete full-stack financial planning application with budgeting, goal tracking, portfolio management, debt tracking, and achievement systems.

## Features

- 💰 **Budget Management**: Create and track personal budgets with category allocations
- 🎯 **Goal Setting**: Set and monitor financial goals with progress tracking
- 📈 **Portfolio Management**: Track investment portfolios and holdings
- 💳 **Debt Tracking**: Monitor debts and payment progress
- 🏆 **Achievements**: Earn achievements for financial milestones
- 🔐 **Secure Authentication**: JWT-based authentication system
- 📱 **Responsive Design**: Beautiful UI built with React and Tailwind CSS

## Technology Stack

### Frontend
- **React 18** with Vite for fast development
- **Tailwind CSS** for styling
- **Radix UI** components for accessibility
- **React Router** for navigation
- **Recharts** for data visualization
- **Framer Motion** for animations

### Backend
- **Node.js** with Express.js
- **SQLite** database for development
- **JWT** authentication
- **Joi** for validation
- **bcryptjs** for password hashing

## Quick Start

### Prerequisites
- Node.js 18+ installed
- npm or yarn package manager

### Option 1: Full Setup (Recommended)
```bash
# Clone and setup everything
npm run setup

# Run both frontend and backend
npm run full-dev
```

### Option 2: Manual Setup
```bash
# Install frontend dependencies
npm install

# Setup backend
cd backend
npm install
npm run migrate
cd ..

# Run frontend (terminal 1)
npm run dev

# Run backend (terminal 2)  
npm run backend
```

## Development

### Available Scripts

#### Frontend Scripts
- `npm run dev` - Start frontend development server (port 5173)
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint

#### Backend Scripts
- `npm run backend` - Start backend development server (port 3001)
- `npm run backend:start` - Start backend in production mode
- `npm run backend:migrate` - Run database migrations

#### Combined Scripts
- `npm run full-dev` - Run both frontend and backend concurrently
- `npm run setup` - Complete setup (install dependencies and migrate DB)

### Environment Variables

#### Frontend (.env.local)
```
VITE_API_URL=http://localhost:3001/api
```

#### Backend (backend/.env)
```
NODE_ENV=development
PORT=3001
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
DB_PATH=./database.sqlite
CORS_ORIGIN=http://localhost:5173
```

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user  
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update user profile

### Data Endpoints
- `GET/POST/PUT/DELETE /api/budgets` - Budget management
- `GET/POST/PUT/DELETE /api/goals` - Goal management
- `GET/POST/PUT/DELETE /api/portfolios` - Portfolio management
- `GET/POST/PUT/DELETE /api/debts` - Debt management
- `GET /api/achievements` - View achievements

### Special Endpoints
- `PUT /api/goals/:id/progress` - Update goal progress
- `PUT /api/debts/:id/payment` - Make debt payment
- `POST /api/portfolios/:id/holdings` - Add portfolio holding

## Database Schema

The app uses SQLite with the following main entities:
- **Users** - User accounts and profiles
- **Budgets** - Budget plans with category allocations
- **Goals** - Financial goals with progress tracking
- **Portfolios** - Investment portfolios with holdings
- **Debts** - Debt accounts with payment tracking
- **Achievements** - User achievements and milestones
- **Transactions** - Financial transactions (future feature)

## Architecture

### Frontend Architecture
- **Pages**: Main application pages (Dashboard, BudgetBuilder, etc.)
- **Components**: Reusable UI components organized by feature
- **API Layer**: Custom API client replacing Base44 SDK
- **State Management**: React hooks for local state
- **Routing**: React Router for navigation

### Backend Architecture
- **Models**: Database entity models with business logic
- **Controllers**: Request handlers and business logic
- **Routes**: API endpoint definitions
- **Middleware**: Authentication, validation, error handling
- **Database**: SQLite with migration system

## Migration from Base44

This app was successfully migrated from using the Base44 platform to a custom full-stack architecture:

- ✅ **Database**: Custom SQLite database with full schema
- ✅ **Authentication**: JWT-based auth system
- ✅ **API**: RESTful API with all CRUD operations
- ✅ **Data Persistence**: All user data stored locally
- ✅ **Feature Parity**: All original features maintained
- ✅ **Mock Integrations**: LLM and external service mocks

## Development Notes

### Adding New Features
1. Create database migration in `backend/src/database/migrations/`
2. Add model in `backend/src/models/`
3. Create controller in `backend/src/controllers/`
4. Add routes in `backend/src/routes/`
5. Update frontend API client if needed

### Database Migrations
```bash
cd backend
npm run migrate
```

### Testing
- Backend: Unit tests can be added using Jest
- Frontend: Component tests can be added using Vitest
- E2E: Playwright or Cypress can be integrated

## Production Deployment

### Frontend
- Build: `npm run build`
- Deploy `dist/` folder to any static hosting service
- Update `VITE_API_URL` to production backend URL

### Backend
- Set `NODE_ENV=production`
- Use PostgreSQL or MySQL for production database
- Deploy to any Node.js hosting service
- Set secure `JWT_SECRET`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For questions or issues, please open a GitHub issue or contact the development team.