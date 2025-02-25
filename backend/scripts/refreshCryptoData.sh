#!/bin/bash

# Script to refresh cryptocurrency data for the 7 specific cryptocurrencies
# - Bitcoin
# - Ethereum
# - Solana
# - Polkadot
# - Dogecoin
# - BNB
# - Tether USDT

# Get the directory of this script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Change to the project root directory
cd "$SCRIPT_DIR/../.."

# Refresh all 7 cryptocurrencies
echo "Refreshing data for all 7 cryptocurrencies..."
node --experimental-modules backend/scripts/fetchCryptoEOM.js

# Check if the script executed successfully
if [ $? -eq 0 ]; then
  echo "Cryptocurrency data refresh completed successfully."
else
  echo "Error refreshing cryptocurrency data."
  exit 1
fi

exit 0 