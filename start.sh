#!/usr/bin/env bash
set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}Starting Factory UI V2...${NC}"

# Create logs directory
mkdir -p logs

# Start backend
echo -e "${GREEN}Starting backend on :8000...${NC}"
py -m uvicorn backend.main:app --reload --port 8000 --host 127.0.0.1 > logs/backend.log 2>&1 &
BACKEND_PID=$!

# Start frontend
echo -e "${GREEN}Starting frontend on :3000...${NC}"
cd frontend && pnpm dev --hostname 127.0.0.1 > ../logs/frontend.log 2>&1 &
FRONTEND_PID=$!
cd ..

echo -e "${GREEN}Backend:  http://127.0.0.1:8000${NC}"
echo -e "${GREEN}Frontend: http://127.0.0.1:3000${NC}"
echo ""
echo "Press Ctrl+C to stop."

# Cleanup on exit
cleanup() {
    echo ""
    echo "Shutting down..."
    kill $BACKEND_PID 2>/dev/null
    kill $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    wait $FRONTEND_PID 2>/dev/null
    echo "Done."
}
trap cleanup EXIT INT TERM

wait
