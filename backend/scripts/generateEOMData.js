import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import csvtojson from 'csvtojson';
import process from 'process';

// Get the directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const CRYPTO_DATA_DIR = path.join(DATA_DIR, 'crypto_data');
const CRYPTO_CONFIG_FILE = path.join(DATA_DIR, 'crypto_config.json');

// Ensure the data directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CRYPTO_DATA_DIR, { recursive: true });
    console.log('Data directories created or already exist');
  } catch (error) {
    console.error('Error creating directories:', error);
    throw error;
  }
}

// Load cryptocurrencies from config file
async function loadCryptocurrencies() {
  try {
    const data = await fs.readFile(CRYPTO_CONFIG_FILE, 'utf8');
    const cryptos = JSON.parse(data);
    console.log(`Loaded ${cryptos.length} cryptocurrencies from config file`);
    return cryptos;
  } catch (error) {
    console.error('Error loading cryptocurrencies:', error);
    throw error;
  }
}

// Function to calculate month-over-month percentage change
function calculateMoMChange(currentPrice, previousPrice) {
  if (!previousPrice) return null;
  return ((currentPrice - previousPrice) / previousPrice) * 100;
}

// Function to get the last day of a month
function getLastDayOfMonth(year, month) {
  // month is 0-indexed (0 = January, 11 = December)
  // Create a date for the first day of the next month, then subtract one day
  return new Date(year, month + 1, 0);
}

// Function to format date as YYYY-MM-DD
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Function to extract end-of-month data from daily data
async function generateEOMData(symbol) {
  try {
    const inputFilePath = path.join(CRYPTO_DATA_DIR, `${symbol.toLowerCase()}_usd.csv`);
    const outputFilePath = path.join(CRYPTO_DATA_DIR, `${symbol.toLowerCase()}_usd_eom.csv`);
    
    console.log(`Processing ${symbol}...`);
    console.log(`Reading data from ${inputFilePath}`);
    
    // Read the daily data
    const data = await csvtojson().fromFile(inputFilePath);
    
    if (!data || data.length === 0) {
      console.error(`No data found for ${symbol}`);
      return {
        symbol,
        success: false,
        error: 'No data found'
      };
    }
    
    console.log(`Found ${data.length} daily records for ${symbol}`);
    
    // Create a map for quick lookup by date
    const dataByDate = {};
    data.forEach(item => {
      dataByDate[item.Date] = {
        date: item.Date,
        close: parseFloat(item.Close)
      };
    });
    
    // Group data by year-month
    const dataByYearMonth = {};
    
    data.forEach(item => {
      const date = new Date(item.Date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;
      
      if (!dataByYearMonth[key]) {
        dataByYearMonth[key] = [];
      }
      
      dataByYearMonth[key].push({
        date: item.Date,
        close: parseFloat(item.Close),
        fullDate: date
      });
    });
    
    // Get the last day of each month
    const eomData = [];
    
    Object.keys(dataByYearMonth).sort().forEach(key => {
      const [year, month] = key.split('-').map(Number);
      const lastDayOfMonth = getLastDayOfMonth(year, month);
      const lastDayFormatted = formatDate(lastDayOfMonth);
      
      // First check if the exact end-of-month date exists in our data
      if (dataByDate[lastDayFormatted]) {
        eomData.push({
          date: lastDayFormatted,
          close: dataByDate[lastDayFormatted].close
        });
        console.log(`For ${year}-${month+1}: Found exact match for ${lastDayFormatted} with price ${dataByDate[lastDayFormatted].close}`);
      } else {
        // If not, find the closest date
        const monthData = dataByYearMonth[key];
        let closestToLastDay = null;
        let minDayDiff = Infinity;
        
        for (const entry of monthData) {
          const entryDate = entry.fullDate;
          const entryDay = entryDate.getDate();
          const dayDiff = Math.abs(lastDayOfMonth.getDate() - entryDay);
          
          if (dayDiff < minDayDiff) {
            minDayDiff = dayDiff;
            closestToLastDay = entry;
          }
        }
        
        if (closestToLastDay) {
          eomData.push({
            date: lastDayFormatted,
            close: closestToLastDay.close,
            originalDate: closestToLastDay.date
          });
          console.log(`For ${year}-${month+1}: No exact match for ${lastDayFormatted}, using price from ${closestToLastDay.date} (${closestToLastDay.close})`);
        }
      }
    });
    
    // Sort by date (oldest to newest)
    eomData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    console.log(`Found ${eomData.length} end-of-month dates for ${symbol}`);
    
    // Calculate month-over-month change
    const eomDataWithMoM = eomData.map((item, index) => {
      let momChange = null;
      
      if (index > 0) {
        momChange = calculateMoMChange(item.close, eomData[index - 1].close);
      }
      
      return {
        date: item.date,
        close: item.close,
        momChange: momChange !== null ? momChange.toFixed(2) : ''
      };
    });
    
    console.log(`Generated ${eomDataWithMoM.length} end-of-month records for ${symbol}`);
    
    // Convert to CSV format
    const csvHeader = 'Date,Price,MoM_%_Chg';
    const csvRows = eomDataWithMoM.map(item => `${item.date},${item.close.toFixed(2)},${item.momChange}`);
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Save to file
    await fs.writeFile(outputFilePath, csvContent);
    
    console.log(`Successfully saved end-of-month data for ${symbol} to ${outputFilePath}`);
    return {
      symbol,
      recordCount: eomDataWithMoM.length,
      success: true
    };
  } catch (error) {
    console.error(`Error generating end-of-month data for ${symbol}:`, error.message);
    return {
      symbol,
      success: false,
      error: error.message
    };
  }
}

// Main function to generate end-of-month data for all cryptocurrencies
async function generateAllEOMData() {
  try {
    // Ensure directories exist
    await ensureDirectories();
    
    // Load cryptocurrencies
    const cryptos = await loadCryptocurrencies();
    console.log(`Generating end-of-month data for ${cryptos.length} cryptocurrencies: ${cryptos.map(c => c.symbol).join(', ')}`);
    
    // Process each cryptocurrency
    const results = [];
    for (const crypto of cryptos) {
      const result = await generateEOMData(crypto.symbol);
      results.push(result);
    }
    
    // Summarize results
    const successful = results.filter(r => r && r.success).map(r => r.symbol);
    const failed = results.filter(r => !r || !r.success).map(r => r.symbol);
    
    console.log('\nEnd-of-month data generation completed.');
    if (successful.length > 0) {
      console.log(`Successfully processed: ${successful.join(', ')}`);
    }
    if (failed.length > 0) {
      console.log(`Failed to process: ${failed.join(', ')}`);
    }
    
    return {
      successful,
      failed
    };
  } catch (error) {
    console.error('Error in generateAllEOMData:', error);
    throw error;
  }
}

// Run the main function
generateAllEOMData()
  .then(() => {
    console.log('End-of-month data generation completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error generating end-of-month data:', error);
    process.exit(1);
  }); 