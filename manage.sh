#!/bin/bash

# å¼€å…³æ§åˆ¶
BUILD_BACKEND=1
BUILD_FRONTEND=1
START_ALL=1
CLEAN_OLD=0

# è¯»å–æœ¬åœ° .env è·å– Key (å¦‚æœå­˜åœ¨)
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "íº€ Managing ChatPPT Services..."

if [ "$CLEAN_OLD" -eq 1 ]; then
    docker compose down --remove-orphans
fi

if [ "$BUILD_BACKEND" -eq 1 ]; then
    echo "í¿—ï¸  Building Backend (UV + Model Prefetch)..."
    docker compose build backend
fi

if [ "$BUILD_FRONTEND" -eq 1 ]; then
    echo "í¾¨ Building Frontend..."
    docker compose build frontend
fi

if [ "$START_ALL" -eq 1 ]; then
    echo "í´¥ Starting All Services..."
    docker compose up -d
    echo "âœ… Done! Visit http://localhost"
fi
