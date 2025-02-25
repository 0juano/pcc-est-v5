import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import csvtojson from 'csvtojson';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const CRYPTO_DATA_DIR = path.join(DATA_DIR, 'crypto_data');
const CRYPTO_CONFIG_FILE = path.join(DATA_DIR, 'crypto_config.json');

// Default list of cryptocurrencies to track
const DEFAULT_CRYPTOCURRENCIES = [
  { symbol: 'BTC', name: 'Bitcoin' },
  { symbol: 'ETH', name: 'Ethereum' },
  { symbol: 'XRP', name: 'XRP' },
  { symbol: 'USDT', name: 'Tether' },
  { symbol: 'BNB', name: 'BNB' },
  { symbol: 'SOL', name: 'Solana' },
  { symbol: 'DOGE', name: 'Dogecoin' },
  { symbol: 'ADA', name: 'Cardano' },
  { symbol: 'TRX', name: 'Tron' },
  { symbol: 'LINK', name: 'Chainlink' },
  { symbol: 'XLM', name: 'Stellar' },
  { symbol: 'AVAX', name: 'Avalanche' },
  { symbol: 'LTC', name: 'Litecoin' },
  { symbol: 'SUI', name: 'Sui' },
  { symbol: 'HBAR', name: 'Hedera' },
  { symbol: 'TON', name: 'Toncoin' },
  { symbol: 'LEO', name: 'Leo' },
  { symbol: 'SHIB', name: 'Shiba Inu' },
  { symbol: 'MANTA', name: 'Mantra' },
  { symbol: 'DOT', name: 'Polkadot' },
  { symbol: 'HLP', name: 'Hyperliquid' },
  { symbol: 'BCH', name: 'Bitcoin Cash' },
  { symbol: 'BG', name: 'Bitget' },
  { symbol: 'UNI', name: 'Uniswap' },
  { symbol: 'XMR', name: 'Monero' },
  { symbol: 'NEAR', name: 'Near' },
  { symbol: 'PEPE', name: 'Pepe' },
  { symbol: 'TAO', name: 'Bittensor' },
  { symbol: 'AAVE', name: 'Aave' },
  { symbol: 'APT', name: 'Aptos' },
  { symbol: 'YFI', name: 'yearn.finance' },
];

// Load cryptocurrencies from config file or use defaults
const loadCryptocurrencies = async () => {
  try {
    // Ensure data directory exists
    await fs.mkdir(DATA_DIR, { recursive: true });
    
    // Check if config file exists
    try {
      await fs.access(CRYPTO_CONFIG_FILE);
      // File exists, read it
      const data = await fs.readFile(CRYPTO_CONFIG_FILE, 'utf8');
      const cryptos = JSON.parse(data);
      console.log(`Loaded ${cryptos.length} cryptocurrencies from config file`);
      return cryptos;
    } catch {
      // File doesn't exist, create it with defaults
      console.log('Crypto config file not found, creating with defaults');
      await fs.writeFile(CRYPTO_CONFIG_FILE, JSON.stringify(DEFAULT_CRYPTOCURRENCIES, null, 2));
      return DEFAULT_CRYPTOCURRENCIES;
    }
  } catch (err) {
    console.error('Error loading cryptocurrencies:', err);
    return DEFAULT_CRYPTOCURRENCIES;
  }
};

// Save cryptocurrencies to config file
const saveCryptocurrencies = async (cryptos) => {
  try {
    await fs.writeFile(CRYPTO_CONFIG_FILE, JSON.stringify(cryptos, null, 2));
    console.log(`Saved ${cryptos.length} cryptocurrencies to config file`);
    return true;
  } catch (err) {
    console.error('Error saving cryptocurrencies:', err);
    return false;
  }
};

// Initialize the cryptocurrencies list
export let CRYPTOCURRENCIES = [];

// Load cryptocurrencies on module initialization
(async () => {
  CRYPTOCURRENCIES = await loadCryptocurrencies();
})();

// List of cryptocurrencies that need special handling due to very small values
const SMALL_VALUE_CRYPTOS = ['SHIB', 'SUI', 'PEPE'];

// Get the file path for a specific cryptocurrency
const getCryptoFilePath = (symbol) => {
  return path.join(CRYPTO_DATA_DIR, `${symbol.toLowerCase()}_usd.csv`);
};

// Read and parse CSV data
const readCryptoData = async (symbol) => {
  const filePath = getCryptoFilePath(symbol);
  
  try {
    await fs.access(filePath);
    const data = await csvtojson().fromFile(filePath);
    return data;
  } catch (err) {
    console.log(`No data file found for ${symbol}: ${err.message}`);
    return [];
  }
};

// Calculate the number of data points for each cryptocurrency
const countDataPoints = async (symbol) => {
  try {
    const data = await readCryptoData(symbol);
    return data.length;
  } catch (err) {
    console.log(`Error counting data points for ${symbol}: ${err.message}`);
    return 0;
  }
};

// @desc    Get all cryptocurrencies
// @route   GET /api/crypto
export const getAllCryptocurrencies = async (req, res) => {
  try {
    // Enhance the list with data point counts
    const cryptoList = await Promise.all(
      CRYPTOCURRENCIES.map(async (crypto) => {
        const dataPoints = await countDataPoints(crypto.symbol);
        return {
          ...crypto,
          dataPoints,
        };
      })
    );
    
    res.json(cryptoList);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get details for a specific cryptocurrency
// @route   GET /api/crypto/:symbol
export const getCryptoDetails = async (req, res) => {
  const { symbol } = req.params;
  
  try {
    const crypto = CRYPTOCURRENCIES.find(c => c.symbol === symbol);
    if (!crypto) {
      return res.status(404).json({ message: `Cryptocurrency ${symbol} not found` });
    }
    
    // Determine which symbol to use for Yahoo Finance API
    let yahooSymbol;
    if (crypto.yahooSymbol) {
      // Use the stored Yahoo symbol for API calls
      yahooSymbol = `${crypto.yahooSymbol}-USD`;
      console.log(`Using special Yahoo symbol for ${symbol}: ${yahooSymbol}`);
    } else {
      yahooSymbol = `${symbol}-USD`;
    }
    
    // Check if we need to use Yahoo Finance data
    // Use Yahoo Finance if:
    // 1. It's a small value cryptocurrency OR
    // 2. The CSV file doesn't exist yet
    const filePath = getCryptoFilePath(symbol);
    let useYahooFinance = SMALL_VALUE_CRYPTOS.includes(symbol);
    
    // Check if the file exists
    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      console.log(`No data file found for ${symbol}, using Yahoo Finance data instead`);
      useYahooFinance = true;
    }
    
    if (useYahooFinance) {
      try {
        // Fetch real-time data from Yahoo Finance
        const result = await yahooFinance.quote(yahooSymbol);
        
        if (result && result.regularMarketPrice) {
          const currentPrice = result.regularMarketPrice;
          const changePercent = result.regularMarketChangePercent || 0;
          const changeText = changePercent >= 0 ? 'Increase' : 'Decrease';
          
          const details = {
            symbol,
            name: crypto.name,
            currentPrice,
            changePercent,
            changeText,
            momChangePercent: 0 // We don't have historical data for MoM change
          };
          
          console.log(`Using Yahoo Finance data for ${symbol}: Price=${currentPrice}`);
          return res.json(details);
        }
      } catch (yahooError) {
        console.error(`Error fetching Yahoo Finance data for ${symbol}:`, yahooError);
        // Continue with CSV data if Yahoo Finance fails
      }
    }
    
    const data = await readCryptoData(symbol);
    
    if (!data || data.length === 0) {
      return res.status(404).json({ message: `No data available for ${symbol}` });
    }
    
    // Sort data by date
    data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    
    // Get the most recent price
    const latestData = data[data.length - 1];
    const currentPrice = parseFloat(latestData.Close);
    
    // Get the month-over-month change percentage
    const momChangePercent = latestData['MoM_Change_%'] ? parseFloat(latestData['MoM_Change_%']) : 0;
    
    // Calculate change percentage (if we have at least 2 data points)
    let changePercent = 0;
    let changeText = 'No change';
    
    if (data.length > 1) {
      const previousData = data[data.length - 2];
      const previousPrice = parseFloat(previousData.Close);
      
      changePercent = ((currentPrice - previousPrice) / previousPrice) * 100;
      changeText = changePercent >= 0 ? 'Increase' : 'Decrease';
    }
    
    const details = {
      symbol,
      name: crypto.name,
      currentPrice,
      changePercent,
      changeText,
      momChangePercent
    };
    
    res.json(details);
  } catch (error) {
    console.error(`Error fetching details for ${symbol}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get price history for a specific cryptocurrency
// @route   GET /api/crypto/:symbol/history
export const getPriceHistory = async (req, res) => {
  const { symbol } = req.params;
  
  try {
    const crypto = CRYPTOCURRENCIES.find(c => c.symbol === symbol);
    if (!crypto) {
      return res.status(404).json({ message: `Cryptocurrency ${symbol} not found` });
    }
    
    // Determine which symbol to use for Yahoo Finance API
    let yahooSymbol;
    if (crypto.yahooSymbol) {
      // Use the stored Yahoo symbol for API calls
      yahooSymbol = `${crypto.yahooSymbol}-USD`;
      console.log(`Using special Yahoo symbol for ${symbol}: ${yahooSymbol}`);
    } else {
      yahooSymbol = `${symbol}-USD`;
    }
    
    // Check if we need to use Yahoo Finance data
    // Use Yahoo Finance if:
    // 1. It's a small value cryptocurrency OR
    // 2. The CSV file doesn't exist yet
    const filePath = getCryptoFilePath(symbol);
    let useYahooFinance = SMALL_VALUE_CRYPTOS.includes(symbol);
    
    // Check if the file exists
    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      console.log(`No data file found for ${symbol}, using Yahoo Finance data instead`);
      useYahooFinance = true;
    }
    
    if (useYahooFinance) {
      try {
        // Fetch real-time data from Yahoo Finance
        const result = await yahooFinance.quote(yahooSymbol);
        
        if (result && result.regularMarketPrice) {
          const today = new Date();
          const formattedDate = today.toISOString().split('T')[0];
          
          // Create a simplified history response with current data
          const simplifiedData = {
            startDate: '2020-08-01', // First date in our CSV
            endDate: formattedDate,
            endPrice: result.regularMarketPrice,
            momChangePercent: result.regularMarketChangePercent || 0
          };
          
          console.log(`Using Yahoo Finance history for ${symbol}: Price=${result.regularMarketPrice}`);
          return res.json(simplifiedData);
        }
      } catch (yahooError) {
        console.error(`Error fetching Yahoo Finance data for ${symbol}:`, yahooError);
        // Continue with CSV data if Yahoo Finance fails
      }
    }
    
    const data = await readCryptoData(symbol);
    
    if (!data || data.length === 0) {
      return res.json({ message: 'No data available' });
    }
    
    // Sort data by date
    data.sort((a, b) => new Date(a.Date) - new Date(b.Date));
    
    // Get the starting date
    const startDate = data[0].Date;
    
    // Get current date
    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();
    
    // Filter out future dates - only keep dates up to the current month
    const pastData = data.filter(item => {
      const itemDate = new Date(item.Date);
      const itemYear = itemDate.getFullYear();
      const itemMonth = itemDate.getMonth();
      
      return (itemYear < currentYear) || 
             (itemYear === currentYear && itemMonth <= currentMonth);
    });
    
    // Get the last actual end-of-month date and price
    const lastActualData = pastData[pastData.length - 1];
    const endDate = lastActualData.Date;
    const endPrice = parseFloat(lastActualData.Close);
    const momChangePercent = lastActualData['MoM_Change_%'] ? parseFloat(lastActualData['MoM_Change_%']) : 0;
    
    console.log(`History for ${symbol}: Start=${startDate}, End=${endDate}, Price=${endPrice}`);
    
    // Return simplified data
    const simplifiedData = {
      startDate,
      endDate,
      endPrice,
      momChangePercent
    };
    
    res.json(simplifiedData);
  } catch (error) {
    console.error(`Error fetching price history for ${symbol}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// Function to get end of month date for the past 5 years
const getEndOfMonthDates = () => {
  const dates = [];
  const today = new Date();
  console.log(`Today's date: ${today.toISOString()}`);
  
  const endYear = today.getFullYear();
  let endMonth = today.getMonth() - 1; // Previous month instead of current month
  let adjustedEndYear = endYear;
  
  // Handle January case (when endMonth would be -1)
  if (endMonth < 0) {
    endMonth = 11; // December
    adjustedEndYear = endYear - 1;
  }
  
  console.log(`End year: ${endYear}, End month: ${endMonth}, Adjusted end year: ${adjustedEndYear}`);
  
  const startYear = endYear - 5;
  console.log(`Start year: ${startYear}`);
  
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month++) {
      // Stop if we've reached the previous month
      if ((year === adjustedEndYear && month > endMonth) || year > adjustedEndYear) {
        break;
      }
      
      // Get the last day of the month
      const lastDay = new Date(year, month + 1, 0).getDate();
      const date = new Date(year, month, lastDay);
      
      // Format as YYYY-MM-DD
      const formattedDate = date.toISOString().split('T')[0];
      dates.push(formattedDate);
    }
  }
  
  console.log(`Generated ${dates.length} dates, from ${dates[0]} to ${dates[dates.length - 1]}`);
  
  return dates;
};

// Function to calculate month-over-month percentage change
const calculateMoMChange = (currentPrice, previousPrice) => {
  if (!previousPrice) return null;
  return ((currentPrice - previousPrice) / previousPrice) * 100;
};

// Function to add MoM change to a CSV file
const addMoMChangeToFile = async (filePath) => {
  try {
    // Read the CSV file
    const data = await csvtojson().fromFile(filePath);
    
    if (data.length === 0) {
      console.log(`No data found in ${filePath}`);
      return false;
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
        // For all other entries, calculate MoM change from previous entry
        const previousPrice = parseFloat(data[i-1].Close);
        const momChange = calculateMoMChange(currentPrice, previousPrice);
        data[i]['MoM_Change_%'] = momChange !== null ? momChange.toFixed(2) : '';
      }
    }
    
    // Write the updated data back to CSV
    const csvContent = [
      'Date,Close,MoM_Change_%',
      ...data.map(row => `${row.Date},${row.Close},${row['MoM_Change_%']}`)
    ].join('\n');
    
    await fs.writeFile(filePath, csvContent);
    console.log(`✓ Added MoM change to ${path.basename(filePath)}`);
    
    return true;
  } catch (error) {
    console.error(`Error adding MoM change to ${filePath}:`, error);
    return false;
  }
};

// Function to fetch data from Yahoo Finance
const fetchCryptoDataFromYahoo = async (symbol, dates) => {
  try {
    // Check if the symbol is a special case (has yahooSymbol property)
    let yahooSymbol;
    const cryptoInfo = CRYPTOCURRENCIES.find(c => c.symbol === symbol);
    
    if (cryptoInfo && cryptoInfo.yahooSymbol) {
      // Use the stored Yahoo symbol for API calls
      yahooSymbol = `${cryptoInfo.yahooSymbol}-USD`;
      console.log(`Using special Yahoo symbol for ${symbol}: ${yahooSymbol}`);
    } else {
      // Format the crypto symbol for Yahoo Finance (add -USD suffix)
      yahooSymbol = `${symbol}-USD`;
    }
    
    // Sort dates to get start and end date
    const sortedDates = [...dates].sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    
    console.log(`Fetching data for ${symbol} from ${startDate} to ${endDate} using ${yahooSymbol}`);
    
    // Fetch historical data from Yahoo Finance
    // We need to fetch daily data to ensure we get the end-of-month prices
    const result = await yahooFinance.historical(yahooSymbol, {
      period1: startDate,
      period2: endDate,
      interval: '1d'  // Daily data to ensure we get end-of-month prices
    });
    
    if (!result || result.length === 0) {
      console.error(`No data returned from Yahoo Finance for ${symbol}`);
      return null;
    }
    
    // Convert the result to CSV format
    const headers = ['Date', 'Close'];
    
    // Filter data to only include end-of-month dates
    const endOfMonthData = [];
    
    // Group by year and month to find the last day of each month
    const monthlyData = {};
    
    // First, organize all data points by year-month
    const dataByMonth = {};
    
    // First, organize all data points by year-month
    result.forEach(item => {
      const date = new Date(item.date);
      const year = date.getFullYear();
      const month = date.getMonth();
      const key = `${year}-${month}`;
      
      if (!dataByMonth[key]) {
        dataByMonth[key] = [];
      }
      
      dataByMonth[key].push(item);
    });
    
    // For each month, find the last trading day
    for (const [key, monthItems] of Object.entries(dataByMonth)) {
      // Sort by date in ascending order
      monthItems.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Get the last trading day of the month
      const lastTradingDay = monthItems[monthItems.length - 1];
      monthlyData[key] = lastTradingDay;
    }
    
    // For each month in our target dates, get the corresponding last trading day data
    for (const date of dates) {
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      const key = `${year}-${month}`;
      
      if (monthlyData[key]) {
        endOfMonthData.push(monthlyData[key]);
      }
    }
    
    // Convert to CSV rows
    const csvRows = endOfMonthData.map(item => {
      // Format date as YYYY-MM-DD
      const date = item.date.toISOString().split('T')[0];
      
      // Extract year and month from the date
      const dateObj = new Date(date);
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth();
      
      // Get the last day of the month
      const lastDay = new Date(year, month + 1, 0).getDate();
      
      // Create the end-of-month date string
      const endOfMonthDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      return [endOfMonthDate, item.close.toFixed(2)].join(',');
    });
    
    // Get the latest price data
    try {
      const latestQuote = await yahooFinance.quote(yahooSymbol);
      if (latestQuote && latestQuote.regularMarketPrice) {
        const today = new Date();
        const formattedToday = today.toISOString().split('T')[0];
        
        // Add the latest price as the most recent data point
        csvRows.push(`${formattedToday},${latestQuote.regularMarketPrice.toFixed(2)}`);
        console.log(`Added latest price for ${symbol}: ${latestQuote.regularMarketPrice.toFixed(2)} on ${formattedToday}`);
      }
    } catch (quoteError) {
      console.error(`Error fetching latest quote for ${symbol}:`, quoteError.message);
      // Continue without the latest price if there's an error
    }
    
    // Sort by date
    csvRows.sort((a, b) => {
      const dateA = new Date(a.split(',')[0]);
      const dateB = new Date(b.split(',')[0]);
      return dateA - dateB;
    });
    
    // Create CSV with headers
    const csvData = [headers.join(','), ...csvRows].join('\n');
    console.log(`Retrieved data for ${symbol}: ${csvRows.length} records, from ${startDate} to ${endDate}`);
    
    return csvData;
  } catch (error) {
    console.error(`Error fetching data for ${symbol} from Yahoo Finance:`, error.message);
    return null;
  }
};

// @desc    Refresh cryptocurrency data (fetch last 5 years EOM prices)
// @route   POST /api/crypto/refresh
export const refreshCryptoData = async (req, res) => {
  try {
    // Get end-of-month dates for the past 5 years
    const dates = getEndOfMonthDates();
    
    // Create data directory if it doesn't exist
    await fs.mkdir(CRYPTO_DATA_DIR, { recursive: true });
    
    const results = {
      success: [],
      failed: [],
    };
    
    // Log start of the refresh process
    console.log('Starting cryptocurrency data refresh process...');
    console.log(`Fetching data for ${CRYPTOCURRENCIES.length} cryptocurrencies`);
    
    // Fetch data for each cryptocurrency
    for (const crypto of CRYPTOCURRENCIES) {
      try {
        console.log(`Processing ${crypto.name} (${crypto.symbol})...`);
        
        const csvData = await fetchCryptoDataFromYahoo(crypto.symbol, dates);
        
        if (csvData) {
          const filePath = getCryptoFilePath(crypto.symbol);
          await fs.writeFile(filePath, csvData);
          console.log(`Successfully saved data for ${crypto.symbol}`);
          
          // Add MoM % change to the CSV file
          await addMoMChangeToFile(filePath);
          
          results.success.push(crypto.symbol);
        } else {
          console.error(`Failed to fetch data for ${crypto.symbol}`);
          results.failed.push(crypto.symbol);
        }
      } catch (error) {
        console.error(`Error processing ${crypto.symbol}:`, error.message);
        results.failed.push(crypto.symbol);
      }
    }
    
    console.log('Cryptocurrency data refresh completed');
    console.log(`Success: ${results.success.length}, Failed: ${results.failed.length}`);
    
    res.json({
      message: 'Cryptocurrency data refresh completed',
      results,
    });
  } catch (error) {
    console.error('Error in refreshCryptoData:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Refresh data for a single cryptocurrency
// @route   POST /api/crypto/:symbol/refresh
export const refreshSingleCrypto = async (req, res) => {
  const { symbol } = req.params;
  
  try {
    // Find the cryptocurrency in our list
    const crypto = CRYPTOCURRENCIES.find(c => c.symbol === symbol);
    if (!crypto) {
      return res.status(404).json({ message: `Cryptocurrency ${symbol} not found` });
    }
    
    console.log(`Starting refresh for single cryptocurrency: ${crypto.name} (${symbol})`);
    
    // Get end-of-month dates for the past 5 years
    const dates = getEndOfMonthDates();
    
    // Create data directory if it doesn't exist
    await fs.mkdir(CRYPTO_DATA_DIR, { recursive: true });
    
    // Fetch data for the cryptocurrency
    const csvData = await fetchCryptoDataFromYahoo(symbol, dates);
    
    if (csvData) {
      const filePath = getCryptoFilePath(symbol);
      await fs.writeFile(filePath, csvData);
      console.log(`Successfully refreshed data for ${symbol}`);
      
      // Add MoM % change to the CSV file
      await addMoMChangeToFile(filePath);
      
      res.json({
        message: `Successfully refreshed data for ${crypto.name} (${symbol})`,
        success: true
      });
    } else {
      console.error(`Failed to fetch data for ${symbol}`);
      res.status(500).json({ 
        message: `Failed to refresh data for ${crypto.name} (${symbol})`,
        success: false
      });
    }
  } catch (error) {
    console.error(`Error refreshing data for ${symbol}:`, error.message);
    res.status(500).json({ 
      message: `Error refreshing data for ${symbol}`,
      error: error.message,
      success: false
    });
  }
};

// @desc    Add a new cryptocurrency using Yahoo Finance URL
// @route   POST /api/crypto/add
export const addCryptocurrency = async (req, res) => {
  try {
    const { yahooUrl } = req.body;
    
    if (!yahooUrl) {
      return res.status(400).json({ message: 'Yahoo Finance URL is required' });
    }
    
    console.log('Received request to add cryptocurrency with URL:', yahooUrl);
    
    // Extract the symbol from the Yahoo Finance URL
    // Handle different URL formats:
    // - https://finance.yahoo.com/quote/BTC-USD/
    // - https://finance.yahoo.com/quote/BTC-USD
    // - https://finance.yahoo.com/quote/TAO22974-USD/
    // - https://finance.yahoo.com/quote/TAO22974-USD
    const urlPattern = /\/quote\/([A-Za-z0-9]+(?:\d+)?)-USD\/?/;
    const match = yahooUrl.match(urlPattern);
    
    if (!match || !match[1]) {
      return res.status(400).json({ 
        message: 'Invalid Yahoo Finance URL format. Expected format: https://finance.yahoo.com/quote/SYMBOL-USD/' 
      });
    }
    
    let symbol = match[1];
    console.log('Extracted symbol from URL:', symbol);
    
    // Special case handling for symbols with numbers (like TAO22974)
    // Extract the base symbol (e.g., TAO from TAO22974)
    let displaySymbol = symbol;
    let displayName = '';
    
    if (/^([A-Za-z]+)(\d+)$/.test(symbol)) {
      const baseSymbolMatch = symbol.match(/^([A-Za-z]+)(\d+)$/);
      if (baseSymbolMatch && baseSymbolMatch[1]) {
        // For display purposes, we'll use the base symbol (e.g., TAO)
        // but keep the full symbol for API calls
        displaySymbol = baseSymbolMatch[1];
        console.log(`Special case: ${symbol} has base symbol ${displaySymbol}`);
      }
    }
    
    // Check if the cryptocurrency already exists
    const existingCrypto = CRYPTOCURRENCIES.find(crypto => 
      crypto.symbol === symbol || crypto.symbol === displaySymbol
    );
    
    if (existingCrypto) {
      console.log(`Cryptocurrency ${displaySymbol} already exists in the list`);
      return res.status(400).json({ 
        message: `Cryptocurrency ${displaySymbol} already exists in the list. Try a different cryptocurrency.` 
      });
    }
    
    // Verify the symbol by fetching data from Yahoo Finance
    try {
      const yahooSymbol = `${symbol}-USD`;
      const result = await yahooFinance.quote(yahooSymbol);
      
      if (!result || !result.shortName) {
        return res.status(400).json({ message: `Could not verify cryptocurrency ${displaySymbol}` });
      }
      
      // Use the display name from Yahoo Finance, but clean it up
      displayName = result.shortName.replace(' USD', '');
      
      // Add the new cryptocurrency to the list
      const newCrypto = {
        symbol: displaySymbol,
        name: displayName,
        yahooSymbol: symbol // Store the original symbol for API calls
      };
      
      CRYPTOCURRENCIES.push(newCrypto);
      
      // Save the updated cryptocurrencies list to the config file
      await saveCryptocurrencies(CRYPTOCURRENCIES);
      
      // Fetch initial data for the new cryptocurrency
      const dates = getEndOfMonthDates();
      await fetchCryptoDataFromYahoo(symbol, dates);
      
      return res.status(201).json({ 
        message: `Successfully added ${newCrypto.name} (${displaySymbol})`,
        crypto: newCrypto
      });
    } catch (error) {
      console.error(`Error verifying cryptocurrency ${symbol}:`, error);
      return res.status(400).json({ message: `Could not verify cryptocurrency ${displaySymbol}` });
    }
  } catch (error) {
    console.error('Error adding cryptocurrency:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Get raw CSV data for a specific cryptocurrency
// @route   GET /api/crypto/:symbol/csv
export const getCryptoCSV = async (req, res) => {
  const { symbol } = req.params;
  
  try {
    const crypto = CRYPTOCURRENCIES.find(c => c.symbol === symbol);
    if (!crypto) {
      return res.status(404).json({ message: `Cryptocurrency ${symbol} not found` });
    }
    
    const filePath = getCryptoFilePath(symbol);
    
    // Check if the file exists
    const fileExists = await fs.stat(filePath).then(() => true).catch(() => false);
    if (!fileExists) {
      // If the file doesn't exist, generate a simple CSV with current data
      try {
        // Determine which symbol to use for Yahoo Finance API
        let yahooSymbol;
        if (crypto.yahooSymbol) {
          yahooSymbol = `${crypto.yahooSymbol}-USD`;
          console.log(`Using special Yahoo symbol for ${symbol} CSV: ${yahooSymbol}`);
        } else {
          yahooSymbol = `${symbol}-USD`;
        }
        
        // Fetch real-time data from Yahoo Finance
        const result = await yahooFinance.quote(yahooSymbol);
        
        if (result && result.regularMarketPrice) {
          const today = new Date();
          const formattedDate = today.toISOString().split('T')[0];
          
          // Create a simple CSV with current data
          const csvData = `Date,Open,High,Low,Close,Volume,MoM_Change_%\n${formattedDate},${result.regularMarketPrice},${result.regularMarketDayHigh || result.regularMarketPrice},${result.regularMarketDayLow || result.regularMarketPrice},${result.regularMarketPrice},${result.regularMarketVolume || 0},${result.regularMarketChangePercent || 0}`;
          
          console.log(`Generated CSV data for ${symbol} using Yahoo Finance`);
          res.setHeader('Content-Type', 'text/csv');
          res.setHeader('Content-Disposition', `attachment; filename=${symbol.toLowerCase()}_usd.csv`);
          return res.send(csvData);
        } else {
          console.error(`No price data available from Yahoo Finance for ${symbol}`);
          return res.status(404).json({ message: `No price data available for ${symbol}` });
        }
      } catch (yahooError) {
        console.error(`Error fetching Yahoo Finance data for ${symbol}:`, yahooError);
        return res.status(404).json({ message: `No data file found for ${symbol} and could not fetch from Yahoo Finance` });
      }
    }
    
    // If we get here, the file exists, so send it
    try {
      const data = await fs.readFile(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${symbol.toLowerCase()}_usd.csv`);
      res.send(data);
    } catch (error) {
      console.error(`Error reading CSV file for ${symbol}:`, error);
      res.status(500).json({ message: 'Error reading CSV file', error: error.message });
    }
  } catch (error) {
    console.error(`Error fetching CSV for ${symbol}:`, error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

// @desc    Remove a cryptocurrency
// @route   DELETE /api/crypto/:symbol
export const removeCryptocurrency = async (req, res) => {
  const { symbol } = req.params;
  
  try {
    // Find the cryptocurrency in our list
    const cryptoIndex = CRYPTOCURRENCIES.findIndex(c => c.symbol === symbol);
    if (cryptoIndex === -1) {
      return res.status(404).json({ message: `Cryptocurrency ${symbol} not found` });
    }
    
    // Get the crypto details before removing
    const crypto = CRYPTOCURRENCIES[cryptoIndex];
    
    // Remove the cryptocurrency from the list
    CRYPTOCURRENCIES.splice(cryptoIndex, 1);
    
    // Save the updated list to the config file
    await saveCryptocurrencies(CRYPTOCURRENCIES);
    
    // Try to delete the data file if it exists
    try {
      const filePath = getCryptoFilePath(symbol);
      await fs.unlink(filePath);
      console.log(`Deleted data file for ${symbol}`);
    } catch (err) {
      // File might not exist, which is fine
      console.log(`No data file found for ${symbol} or error deleting: ${err.message}`);
    }
    
    return res.json({ 
      message: `Successfully removed ${crypto.name} (${symbol})`,
      success: true
    });
  } catch (error) {
    console.error(`Error removing cryptocurrency ${symbol}:`, error);
    res.status(500).json({ 
      message: `Error removing cryptocurrency ${symbol}`,
      error: error.message,
      success: false
    });
  }
}; 