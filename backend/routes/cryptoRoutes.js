import express from 'express';
import asyncHandler from 'express-async-handler';
import { 
  getAllCryptocurrencies, 
  getCryptoDetails, 
  refreshCryptoData, 
  getPriceHistory 
} from '../controllers/cryptoController.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import yahooFinance from 'yahoo-finance2';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CRYPTO_DATA_DIR = path.join(__dirname, '../../data/crypto_data');

// List of cryptocurrencies that need special handling due to very small values
const SMALL_VALUE_CRYPTOS = ['SHIB', 'SUI', 'PEPE'];

const router = express.Router();

// @route   GET /api/crypto
// @desc    Get all cryptocurrencies
// @access  Public
router.get('/', asyncHandler(getAllCryptocurrencies));

// @route   GET /api/crypto/:symbol
// @desc    Get details for a specific cryptocurrency
// @access  Public
router.get('/:symbol', asyncHandler(getCryptoDetails));

// @route   GET /api/crypto/:symbol/history
// @desc    Get price history for a specific cryptocurrency
// @access  Public
router.get('/:symbol/history', asyncHandler(getPriceHistory));

// @route   GET /api/crypto/:symbol/csv
// @desc    Get raw CSV data for a specific cryptocurrency
// @access  Public
router.get('/:symbol/csv', async (req, res) => {
  const { symbol } = req.params;
  const filePath = path.join(CRYPTO_DATA_DIR, `${symbol.toLowerCase()}_usd.csv`);
  
  try {
    // Special handling for cryptocurrencies with very small values
    if (SMALL_VALUE_CRYPTOS.includes(symbol)) {
      try {
        // Fetch real-time data from Yahoo Finance
        const yahooSymbol = `${symbol}-USD`;
        const result = await yahooFinance.quote(yahooSymbol);
        
        if (result && result.regularMarketPrice) {
          const today = new Date();
          const formattedDate = today.toISOString().split('T')[0];
          
          // Create a simple CSV with current data
          const csvData = `Date,Close,MoM_Change_%\n${formattedDate},${result.regularMarketPrice},${result.regularMarketChangePercent || 0}`;
          
          console.log(`Using Yahoo Finance data for CSV of ${symbol}: Price=${result.regularMarketPrice}`);
          res.set('Content-Type', 'text/csv');
          return res.send(csvData);
        }
      } catch (yahooError) {
        console.error(`Error fetching Yahoo Finance data for ${symbol} CSV:`, yahooError);
        // Continue with file-based approach if Yahoo Finance fails
      }
    }
    
    if (fs.existsSync(filePath)) {
      const csvData = fs.readFileSync(filePath, 'utf8');
      res.set('Content-Type', 'text/csv');
      res.send(csvData);
    } else {
      res.status(404).json({ message: `CSV data for ${symbol} not found` });
    }
  } catch (error) {
    console.error(`Error serving CSV for ${symbol}:`, error);
    res.status(500).json({ message: 'Server error' });
  }
});

// @route   POST /api/crypto/refresh
// @desc    Refresh cryptocurrency data (fetch last 5 years EOM prices)
// @access  Public
router.post('/refresh', asyncHandler(refreshCryptoData));

export default router; 