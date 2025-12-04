#!/bin/bash
# Script to apply database migrations and regenerate Prisma client

echo "=== Applying Database Migrations ==="

# Navigate to backend folder
cd backend

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Apply migrations
echo "Applying migrations..."
npx prisma migrate deploy

# Or use db push for development
# npx prisma db push

echo "=== Migration Complete ==="
echo ""
echo "Don't forget to restart the backend server!"
