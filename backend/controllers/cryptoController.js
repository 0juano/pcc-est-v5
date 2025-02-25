import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import csvtojson from 'csvtojson';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const CRYPTO_DATA_DIR = path.join(DATA_DIR, 'crypto_data');

// List of cryptocurrencies to track
const CRYPTOCURRENCIES = [
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
];

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
    
    // Special handling for cryptocurrencies with very small values
    if (SMALL_VALUE_CRYPTOS.includes(symbol)) {
      try {
        // Fetch real-time data from Yahoo Finance
        const yahooSymbol = `${symbol}-USD`;
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
    
    // Special handling for cryptocurrencies with very small values
    if (SMALL_VALUE_CRYPTOS.includes(symbol)) {
      try {
        // Fetch real-time data from Yahoo Finance
        const yahooSymbol = `${symbol}-USD`;
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
  const endYear = today.getFullYear();
  const startYear = endYear - 5;
  
  for (let year = startYear; year <= endYear; year++) {
    for (let month = 0; month < 12; month++) {
      // Stop if we've reached the current month
      if (year === endYear && month > today.getMonth()) {
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
  
  return dates;
};

// Function to fetch data from Yahoo Finance
const fetchCryptoDataFromYahoo = async (symbol, dates) => {
  try {
    // Format the crypto symbol for Yahoo Finance (add -USD suffix)
    const yahooSymbol = `${symbol}-USD`;
    
    // Sort dates to get start and end date
    const sortedDates = [...dates].sort();
    const startDate = sortedDates[0];
    const endDate = sortedDates[sortedDates.length - 1];
    
    console.log(`Fetching data for ${symbol} from ${startDate} to ${endDate}`);
    
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