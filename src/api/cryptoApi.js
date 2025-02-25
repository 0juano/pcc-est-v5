import axios from 'axios';

// Base URL for backend API
const API_URL = 'http://localhost:5001/api';

// Fetch all cryptocurrencies
export const getAllCryptocurrencies = async () => {
  try {
    const response = await axios.get(`${API_URL}/crypto`);
    return response.data;
  } catch (error) {
    console.error('Error fetching cryptocurrencies:', error);
    throw error;
  }
};

// Fetch details for a specific cryptocurrency
export const getCryptoDetails = async (symbol) => {
  try {
    const response = await axios.get(`${API_URL}/crypto/${symbol}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching details for ${symbol}:`, error);
    throw error;
  }
};

// Check/refresh cryptocurrency data (fetch last 5 years EOM prices)
export const refreshCryptoData = async () => {
  try {
    const response = await axios.post(`${API_URL}/crypto/refresh`);
    return response.data;
  } catch (error) {
    console.error('Error refreshing crypto data:', error);
    throw error;
  }
};

// Refresh data for a single cryptocurrency
export const refreshSingleCrypto = async (symbol) => {
  try {
    const response = await axios.post(`${API_URL}/crypto/${symbol}/refresh`);
    return response.data;
  } catch (error) {
    console.error(`Error refreshing data for ${symbol}:`, error);
    throw error;
  }
};

// Get price history for a specific cryptocurrency
export const getPriceHistory = async (symbol) => {
  try {
    const response = await axios.get(`${API_URL}/crypto/${symbol}/history`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching price history for ${symbol}:`, error);
    throw error;
  }
};

// Get end-of-month price history for a specific cryptocurrency
export const getEOMPriceHistory = async (symbol) => {
  try {
    const response = await axios.get(`${API_URL}/crypto/${symbol}/eom-csv`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching end-of-month price history for ${symbol}:`, error);
    throw error;
  }
};

// Add a new cryptocurrency using Yahoo Finance URL
export const addCryptocurrency = async (yahooUrl) => {
  try {
    const response = await axios.post(`${API_URL}/crypto/add`, { yahooUrl });
    return response.data;
  } catch (error) {
    console.error('Error adding cryptocurrency:', error);
    throw error;
  }
};

// Remove a cryptocurrency
export const removeCryptocurrency = async (symbol) => {
  try {
    const response = await axios.delete(`${API_URL}/crypto/${symbol}`);
    return response.data;
  } catch (error) {
    console.error(`Error removing cryptocurrency ${symbol}:`, error);
    throw error;
  }
};

// Generate end-of-month data for all cryptocurrencies
export const generateEOMData = async () => {
  try {
    const response = await axios.post(`${API_URL}/crypto/generate-eom`);
    return response.data;
  } catch (error) {
    console.error('Error generating end-of-month data:', error);
    throw error;
  }
}; 