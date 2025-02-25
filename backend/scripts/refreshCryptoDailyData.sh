#!/bin/bash

# Navigate to the project root directory
cd "$(dirname "$0")/../.."

# Print start message
echo "Starting cryptocurrency data fetch process..."

# Run the Node.js script
node --experimental-modules backend/scripts/fetchCryptoDailyPrices.js

# Check if the script executed successfully
if [ $? -eq 0 ]; then
  echo "Cryptocurrency data refresh completed successfully."
else
  echo "Error: Cryptocurrency data refresh failed."
  exit 1
fi

exit 0 