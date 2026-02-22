#!/bin/bash

# Script to kill processes using port 5000 and start the server
# Usage: ./start-server.sh

PORT=5000

echo "🔍 Checking for processes using port $PORT..."

# Find and kill all processes using the port
PIDS=$(lsof -ti:$PORT)

if [ -z "$PIDS" ]; then
  echo "✅ Port $PORT is free"
else
  echo "⚠️  Found processes using port $PORT: $PIDS"
  echo "🔪 Killing processes..."
  lsof -ti:$PORT | xargs kill -9 2>/dev/null
  sleep 1
  
  # Verify port is free
  if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "❌ Failed to free port $PORT. Trying harder..."
    pkill -9 node
    sleep 2
  fi
  
  if lsof -ti:$PORT > /dev/null 2>&1; then
    echo "❌ Port $PORT is still in use. Please check manually."
    exit 1
  else
    echo "✅ Port $PORT is now free"
  fi
fi

echo ""
echo "🚀 Starting server..."
npm run dev
