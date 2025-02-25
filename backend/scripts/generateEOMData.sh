#!/bin/bash

# Navigate to the project root directory
cd "$(dirname "$0")/../.."

# Print start message
echo "Starting end-of-month data generation process..."

# Run the Node.js script
node --experimental-modules backend/scripts/generateEOMData.js

# Check if the script executed successfully
if [ $? -eq 0 ]; then
  echo "End-of-month data generation completed successfully."
else
  echo "Error: End-of-month data generation failed."
  exit 1
fi

exit 0 