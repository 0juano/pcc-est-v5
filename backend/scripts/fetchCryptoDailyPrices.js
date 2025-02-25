import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yahooFinance from 'yahoo-finance2';
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

// Fetch daily closing prices for a cryptocurrency
async function fetchDailyPrices(crypto) {
  const symbol = crypto.symbol;
  const name = crypto.name;
  let yahooSymbol = crypto.yahooSymbol || `${symbol}-USD`;
  
  // Check if the yahooSymbol already has the -USD suffix
  if (crypto.yahooSymbol && !yahooSymbol.endsWith('-USD')) {
    yahooSymbol = `${yahooSymbol}-USD`;
  }
  
  console.log(`Processing ${name} (${symbol})...`);
  console.log(`Using Yahoo symbol: ${yahooSymbol}`);
  
  try {
    // Calculate date range for the last 1,500 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 1500);
    
    const formattedStartDate = startDate.toISOString().split('T')[0];
    const formattedEndDate = endDate.toISOString().split('T')[0];
    
    console.log(`Fetching data for ${symbol} from ${formattedStartDate} to ${formattedEndDate}`);
    
    // Fetch historical data from Yahoo Finance
    const result = await yahooFinance.historical(yahooSymbol, {
      period1: formattedStartDate,
      period2: formattedEndDate,
      interval: '1d'  // Daily data
    });
    
    if (!result || result.length === 0) {
      console.error(`No data returned from Yahoo Finance for ${symbol}`);
      return null;
    }
    
    console.log(`Retrieved ${result.length} records for ${symbol}`);
    
    // Extract only the date and closing price
    const priceData = result.map(item => ({
      date: item.date.toISOString().split('T')[0],
      close: item.close
    }));
    
    // Sort by date (oldest to newest)
    priceData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Convert to CSV format
    const csvHeader = 'Date,Close';
    const csvRows = priceData.map(item => `${item.date},${item.close.toFixed(2)}`);
    const csvContent = [csvHeader, ...csvRows].join('\n');
    
    // Save to file
    const filePath = path.join(CRYPTO_DATA_DIR, `${symbol.toLowerCase()}_usd.csv`);
    await fs.writeFile(filePath, csvContent);
    
    console.log(`Successfully saved data for ${symbol} to ${filePath}`);
    return {
      symbol,
      recordCount: priceData.length,
      success: true
    };
  } catch (error) {
    console.error(`Error fetching data for ${symbol}:`, error.message);
    return {
      symbol,
      success: false,
      error: error.message
    };
  }
}

// Main function to fetch data for all cryptocurrencies
async function fetchAllCryptoPrices() {
  try {
    // Ensure directories exist
    await ensureDirectories();
    
    // Load cryptocurrencies
    const cryptos = await loadCryptocurrencies();
    console.log(`Fetching data for ${cryptos.length} cryptocurrencies: ${cryptos.map(c => c.symbol).join(', ')}`);
    
    // Process each cryptocurrency
    const results = [];
    for (const crypto of cryptos) {
      const result = await fetchDailyPrices(crypto);
      results.push(result);
    }
    
    // Summarize results
    const successful = results.filter(r => r && r.success).map(r => r.symbol);
    const failed = results.filter(r => !r || !r.success).map(r => r.symbol);
    
    console.log('\nCryptocurrency data fetch process completed.');
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
    console.error('Error in fetchAllCryptoPrices:', error);
    throw error;
  }
}

// Run the main function
fetchAllCryptoPrices()
  .then(() => {
    console.log('Cryptocurrency daily price fetch completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error fetching cryptocurrency daily prices:', error);
    process.exit(1);
  }); 