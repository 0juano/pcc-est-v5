import express from 'express';
import asyncHandler from 'express-async-handler';
import { 
  getAllCryptocurrencies, 
  getCryptoDetails, 
  refreshCryptoData, 
  getPriceHistory,
  addCryptocurrency,
  getCryptoCSV,
  getCryptoEOMCSV,
  generateEOMData,
  refreshSingleCrypto,
  removeCryptocurrency
} from '../controllers/cryptoController.js';

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
router.get('/:symbol/csv', asyncHandler(getCryptoCSV));

// @route   GET /api/crypto/:symbol/eom-csv
// @desc    Get end-of-month CSV data for a specific cryptocurrency
// @access  Public
router.get('/:symbol/eom-csv', asyncHandler(getCryptoEOMCSV));

// @route   POST /api/crypto/generate-eom
// @desc    Generate end-of-month data for all cryptocurrencies
// @access  Public
router.post('/generate-eom', asyncHandler(generateEOMData));

// @route   POST /api/crypto/refresh
// @desc    Refresh cryptocurrency data (fetch last 1,500 daily prices)
// @access  Public
router.post('/refresh', asyncHandler(refreshCryptoData));

// @route   POST /api/crypto/:symbol/refresh
// @desc    Refresh data for a single cryptocurrency
// @access  Public
router.post('/:symbol/refresh', asyncHandler(refreshSingleCrypto));

// @route   POST /api/crypto/add
// @desc    Add a new cryptocurrency using Yahoo Finance URL
// @access  Public
router.post('/add', asyncHandler(addCryptocurrency));

// Route to remove a cryptocurrency
router.delete('/:symbol', removeCryptocurrency);

export default router; 