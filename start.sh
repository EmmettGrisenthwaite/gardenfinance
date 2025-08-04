#!/bin/bash

# Financial Planning App Startup Script
echo "🚀 Starting Financial Planning App"
echo "=================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 18+ and try again."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    print_error "Node.js version $NODE_VERSION is too old. Please install Node.js 18+ and try again."
    exit 1
fi

print_success "Node.js $(node -v) is installed"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    print_error "npm is not installed. Please install npm and try again."
    exit 1
fi

print_success "npm $(npm -v) is installed"

# Install frontend dependencies
print_status "Installing frontend dependencies..."
if npm install; then
    print_success "Frontend dependencies installed"
else
    print_error "Failed to install frontend dependencies"
    exit 1
fi

# Install backend dependencies
print_status "Installing backend dependencies..."
cd backend
if npm install; then
    print_success "Backend dependencies installed"
else
    print_error "Failed to install backend dependencies"
    exit 1
fi

# Check if database exists
if [ -f "database.sqlite" ]; then
    print_warning "Database already exists. Skipping migration and seeding."
    print_status "To reset the database, run: npm run fresh-setup"
else
    # Run migrations
    print_status "Running database migrations..."
    if npm run migrate; then
        print_success "Database migrations completed"
    else
        print_error "Database migration failed"
        exit 1
    fi

    # Run seeds
    print_status "Seeding database with sample data..."
    if npm run seed; then
        print_success "Database seeded with sample data"
        echo ""
        print_success "Demo user created:"
        echo "  📧 Email: demo@example.com"
        echo "  🔐 Password: demo123"
    else
        print_error "Database seeding failed"
        exit 1
    fi
fi

cd ..

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    print_status "Creating .env.local file..."
    echo "VITE_API_URL=http://localhost:3001/api" > .env.local
    print_success ".env.local created"
fi

echo ""
echo "🎉 Setup completed successfully!"
echo ""
echo "📋 Quick Start:"
echo "  • Frontend: http://localhost:5173"
echo "  • Backend API: http://localhost:3001/api"
echo "  • API Health: http://localhost:3001/health"
echo ""
echo "🔧 Available Commands:"
echo "  npm run full-dev     - Start both frontend and backend"
echo "  npm run dev          - Start frontend only"
echo "  npm run backend      - Start backend only"
echo "  npm run fresh-setup  - Reset database and restart"
echo ""
echo "💡 Tips:"
echo "  • Use demo@example.com / demo123 to login"
echo "  • Check the README.md for detailed documentation"
echo "  • Backend logs will show API requests"
echo ""

# Ask if user wants to start the application
read -p "🚀 Start the application now? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    print_status "Starting the application..."
    npm run full-dev
else
    print_status "To start the application later, run: npm run full-dev"
fi