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
    endDate.setHours(0, 0, 0, 0); // Set to start of today
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 1500);
    
    console.log(`Fetching data for ${symbol} from ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`);
    
    // Fetch historical data from Yahoo Finance
    const result = await yahooFinance.quote(yahooSymbol);
    if (!result) {
      console.error(`No data returned from Yahoo Finance for ${symbol}`);
      return null;
    }
    
    // Get the current price
    const currentPrice = result.regularMarketPrice;
    const currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    
    // Now fetch historical data
    const historicalResult = await yahooFinance.historical(yahooSymbol, {
      period1: startDate.toISOString().split('T')[0],
      period2: currentDate.toISOString().split('T')[0],
      interval: '1d'
    });
    
    if (!historicalResult || historicalResult.length === 0) {
      console.error(`No historical data returned from Yahoo Finance for ${symbol}`);
      return null;
    }
    
    console.log(`Retrieved ${historicalResult.length} historical records for ${symbol}`);
    
    // Extract only the date and closing price, ensuring no future dates
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const priceData = historicalResult
      .filter(item => {
        const itemDate = new Date(item.date);
        return itemDate <= today;
      })
      .map(item => ({
        date: item.date.toISOString().split('T')[0],
        close: item.close || item.adjclose || 0
      }))
      .filter(item => item.close > 0);
    
    // Add today's price if we have it
    if (currentPrice > 0) {
      priceData.push({
        date: currentDate.toISOString().split('T')[0],
        close: currentPrice
      });
    }
    
    console.log(`Filtered to ${priceData.length} records for ${symbol}`);
    if (priceData.length > 0) {
      console.log('First processed record:', JSON.stringify(priceData[0]));
      console.log('Last processed record:', JSON.stringify(priceData[priceData.length - 1]));
    }
    
    // Sort by date (oldest to newest)
    priceData.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Create CSV content with proper line endings
    const csvRows = ['Date,Close'];
    for (const item of priceData) {
      csvRows.push(`${item.date},${item.close.toFixed(2)}`);
    }
    const csvContent = csvRows.join('\n') + '\n'; // Ensure final newline
    
    // Save to file using writeFile with utf8 encoding
    const filePath = path.join(CRYPTO_DATA_DIR, `${symbol.toLowerCase()}_usd.csv`);
    await fs.writeFile(filePath, csvContent, { encoding: 'utf8' });
    
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