import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import yahooFinance from 'yahoo-finance2';
import { createObjectCsvWriter } from 'csv-writer';
import process from 'process';

// Setup file paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const CRYPTO_DATA_DIR = path.join(DATA_DIR, 'crypto_data');

// Define only the 7 specific cryptocurrencies to track
const CRYPTOCURRENCIES = [
  { symbol: 'BTC', name: 'Bitcoin', yahooSymbol: 'BTC-USD' },
  { symbol: 'ETH', name: 'Ethereum', yahooSymbol: 'ETH-USD' },
  { symbol: 'SOL', name: 'Solana', yahooSymbol: 'SOL-USD' },
  { symbol: 'DOT', name: 'Polkadot', yahooSymbol: 'DOT-USD' },
  { symbol: 'DOGE', name: 'Dogecoin', yahooSymbol: 'DOGE-USD' },
  { symbol: 'BNB', name: 'BNB', yahooSymbol: 'BNB-USD' },
  { symbol: 'USDT', name: 'Tether USDT', yahooSymbol: 'USDT-USD' }
];

// Simplified function to fetch data from Yahoo Finance
const fetchCryptoData = async (crypto) => {
  try {
    const { symbol, yahooSymbol } = crypto;
    
    // Get dates for the past 5 years
    const today = new Date();
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(today.getFullYear() - 5);
    
    const startDate = fiveYearsAgo.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];
    
    console.log(`Fetching data for ${symbol} from ${startDate} to ${endDate}`);
    
    // Fetch historical data from Yahoo Finance
    const result = await yahooFinance.historical(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: '1mo'  // Monthly data to simplify
    });
    
    if (!result || result.length === 0) {
      console.error(`No data returned from Yahoo Finance for ${symbol}`);
      return null;
    }
    
    // Process the data
    const processedData = result.map((item, index) => {
      // Format date as YYYY-MM-DD
      const date = new Date(item.date);
      const formattedDate = date.toISOString().split('T')[0];
      
      // Calculate MoM change if not the first item
      let momChange = null;
      if (index > 0) {
        const currentPrice = item.close;
        const previousPrice = result[index - 1].close;
        momChange = ((currentPrice - previousPrice) / previousPrice) * 100;
      }
      
      return {
        date: formattedDate,
        close: item.close,
        momChange
      };
    });
    
    // Get the latest price
    try {
      const latestQuote = await yahooFinance.quote(yahooSymbol);
      if (latestQuote && latestQuote.regularMarketPrice) {
        const formattedToday = today.toISOString().split('T')[0];
        
        // Only add if it's newer than the last data point
        const lastDataDate = new Date(processedData[processedData.length - 1].date);
        const todayDate = new Date(formattedToday);
        
        if (todayDate > lastDataDate) {
          // Calculate MoM change
          const previousPrice = processedData[processedData.length - 1].close;
          const currentPrice = latestQuote.regularMarketPrice;
          const momChange = ((currentPrice - previousPrice) / previousPrice) * 100;
          
          processedData.push({
            date: formattedToday,
            close: currentPrice,
            momChange
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching latest quote for ${symbol}:`, error.message);
      // Continue without the latest price
    }
    
    return processedData;
  } catch (error) {
    console.error(`Error fetching data for ${crypto.symbol}:`, error.message);
    return null;
  }
};

// Function to save data to CSV file
const saveDataToCSV = async (symbol, data) => {
  try {
    const filePath = path.join(CRYPTO_DATA_DIR, `${symbol.toLowerCase()}_usd.csv`);
    
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'date', title: 'Date' },
        { id: 'close', title: 'Close' },
        { id: 'momChange', title: 'MoM Change %' }
      ]
    });
    
    // Format the data for CSV writing
    const formattedData = data.map(item => ({
      date: item.date,
      close: item.close.toFixed(2),
      momChange: item.momChange !== null ? item.momChange.toFixed(2) : ''
    }));
    
    await csvWriter.writeRecords(formattedData);
    console.log(`Successfully saved data for ${symbol} to ${filePath}`);
    return true;
  } catch (error) {
    console.error(`Error saving data for ${symbol}:`, error.message);
    return false;
  }
};

// Main function to fetch and save data for all cryptocurrencies
const fetchAndSaveAllCryptoData = async () => {
  try {
    // Create data directory if it doesn't exist
    await fs.mkdir(CRYPTO_DATA_DIR, { recursive: true });
    
    const results = {
      success: [],
      failed: []
    };
    
    console.log('Starting cryptocurrency data fetch process...');
    console.log(`Fetching data for ${CRYPTOCURRENCIES.length} cryptocurrencies: ${CRYPTOCURRENCIES.map(c => c.symbol).join(', ')}`);
    
    // Process each cryptocurrency
    for (const crypto of CRYPTOCURRENCIES) {
      try {
        console.log(`Processing ${crypto.name} (${crypto.symbol})...`);
        
        const data = await fetchCryptoData(crypto);
        
        if (data && data.length > 0) {
          const success = await saveDataToCSV(crypto.symbol, data);
          
          if (success) {
            results.success.push(crypto.symbol);
          } else {
            results.failed.push(crypto.symbol);
          }
        } else {
          console.error(`Failed to fetch data for ${crypto.symbol}`);
          results.failed.push(crypto.symbol);
        }
      } catch (error) {
        console.error(`Error processing ${crypto.symbol}:`, error.message);
        results.failed.push(crypto.symbol);
      }
    }
    
    console.log('\nCryptocurrency data fetch process completed.');
    console.log(`Successfully processed: ${results.success.join(', ')}`);
    
    if (results.failed.length > 0) {
      console.log(`Failed to process: ${results.failed.join(', ')}`);
    }
  } catch (error) {
    console.error('Error in fetchAndSaveAllCryptoData:', error.message);
  }
};

// Run the main function
fetchAndSaveAllCryptoData().catch(error => {
  console.error('Unhandled error in script execution:', error);
  process.exit(1);
}); 