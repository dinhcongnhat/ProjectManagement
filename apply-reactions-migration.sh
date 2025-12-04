#!/bin/bash

# Apply chat reactions migration and rebuild
echo "========================================="
echo "Applying chat reactions migration..."
echo "========================================="

cd backend

# Generate Prisma client
echo ""
echo "Step 1: Generating Prisma client..."
npx prisma generate

# Apply migration
echo ""
echo "Step 2: Applying migration..."
npx prisma migrate deploy

# Rebuild backend
echo ""
echo "Step 3: Building backend..."
npm run build

echo ""
echo "========================================="
echo "Migration completed successfully!"
echo "========================================="
echo ""
echo "Now restart the backend server:"
echo "  cd backend && npm start"
echo ""
echo "Or use the start-app.bat script."
