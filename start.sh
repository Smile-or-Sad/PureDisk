#!/bin/bash
echo "==================================================="
echo "      Welcome to PureDisk Space Analyzer!          "
echo "==================================================="
echo " [Info] Starting backend native server..."
echo " [Info] Opening http://localhost:3000 in your browser..."
echo "==================================================="

# Open browser based on OS type
if [[ "$OSTYPE" == "darwin"* ]]; then
  open http://localhost:3000
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
  if command -v xdg-open > /dev/null; then
    xdg-open http://localhost:3000
  else
    echo "Please open http://localhost:3000 manually in your browser."
  fi
else
  echo "Please open http://localhost:3000 manually in your browser."
fi

node server.js
