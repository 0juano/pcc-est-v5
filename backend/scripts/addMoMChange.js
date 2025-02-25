import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import csvtojson from 'csvtojson';
import { createObjectCsvWriter } from 'csv-writer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CRYPTO_DATA_DIR = path.join(__dirname, '../../data/crypto_data');

// Function to calculate month-over-month percentage change
const calculateMoMChange = (currentPrice, previousPrice) => {
  if (!previousPrice) return null;
  return ((currentPrice - previousPrice) / previousPrice) * 100;
};

// Function to process a single CSV file
async function processCsvFile(filePath) {
  try {
    // Read the CSV file
    const data = await csvtojson().fromFile(filePath);
    
    if (data.length === 0) {
      console.log(`No data found in ${filePath}`);
      return;
    }
    
    // Sort data by date to ensure chronological order
    data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    
    // Add the MoM change column
    for (let i = 0; i < data.length; i++) {
      const currentPrice = parseFloat(data[i].Close);
      
      if (i === 0) {
        // First entry has no previous month
        data[i]['MoM_Change_%'] = '';
      } else {
        const previousPrice = parseFloat(data[i-1].Close);
        const momChange = calculateMoMChange(currentPrice, previousPrice);
        data[i]['MoM_Change_%'] = momChange !== null ? momChange.toFixed(2) : '';
      }
    }
    
    // Write the updated data back to CSV
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'Date', title: 'Date' },
        { id: 'Close', title: 'Close' },
        { id: 'MoM_Change_%', title: 'MoM_Change_%' }
      ]
    });
    
    await csvWriter.writeRecords(data);
    console.log(`✓ Added MoM change to ${path.basename(filePath)}`);
    
    return true;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error);
    return false;
  }
}

// Main function to process all CSV files
async function addMoMChangeToAllFiles() {
  try {
    // Get all CSV files in the crypto data directory
    const files = await fs.readdir(CRYPTO_DATA_DIR);
    const csvFiles = files.filter(file => file.endsWith('.csv'));
    
    console.log(`Found ${csvFiles.length} CSV files to process`);
    
    // Process each file
    let successCount = 0;
    for (const file of csvFiles) {
      const filePath = path.join(CRYPTO_DATA_DIR, file);
      const success = await processCsvFile(filePath);
      if (success) successCount++;
    }
    
    console.log(`✓ Successfully processed ${successCount} out of ${csvFiles.length} files`);
  } catch (error) {
    console.error('Error processing CSV files:', error);
  }
}

// Run the script
addMoMChangeToAllFiles(); 