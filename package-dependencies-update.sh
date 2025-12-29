#!/bin/bash

# Clean Architecture Implementation - Dependency Installation Script
# Run this to install all required new dependencies

echo "🚀 Installing Clean Architecture Dependencies..."
echo ""

# Check if npm is available
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found. Please install Node.js first."
    exit 1
fi

# Check if Redis is required
echo "📋 Checking prerequisites..."
echo ""

# Install production dependencies
echo "📦 Installing production dependencies..."
npm install bullmq@^5.0.0 ioredis@^5.3.0 natural@^6.10.0

# Install dev dependencies
echo "📦 Installing development dependencies..."
npm install --save-dev @types/natural@^5.1.0

# Verify installation
echo ""
echo "✅ Dependencies installed successfully!"
echo ""

# Check Upstash Redis configuration
echo "🔍 Checking Upstash Redis configuration..."
if grep -q "UPSTASH_REDIS_URL" .env.local 2>/dev/null; then
    echo "✅ Upstash Redis configured in .env.local"
    echo "   Using serverless Redis - no local installation needed!"
else
    echo "⚠️  UPSTASH_REDIS_URL not found in .env.local"
    echo "   Add your Upstash Redis credentials to .env.local:"
    echo "   UPSTASH_REDIS_URL=redis://default:***@***.upstash.io:6379"
fi

echo ""
echo "📝 Next steps:"
echo "   1. Ensure Redis is running"
echo "   2. Run database migrations: npx prisma migrate dev"
echo "   3. Start the dev server: npm run dev"
echo "   4. Start the background worker: npx tsx src/workers/ingestion-worker.ts"
echo ""
echo "📚 See FIXES_QUICK_START.md for detailed setup instructions"
echo ""

