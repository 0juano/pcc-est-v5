import { useState, useEffect } from 'react';
import { ExternalLink, RefreshCcw } from 'lucide-react';
import { getCryptoDetails, getPriceHistory, refreshSingleCrypto } from '../api/cryptoApi';
import PropTypes from 'prop-types';
import { formatCurrency, formatPercentage } from '../utils/formatNumbers';

const CryptoDetails = ({ symbol }) => {
  const [details, setDetails] = useState(null);
  const [priceHistory, setPriceHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCryptoData = async () => {
    if (!symbol) return;
    
    try {
      setLoading(true);
      const detailsData = await getCryptoDetails(symbol);
      setDetails(detailsData);
      
      const historyData = await getPriceHistory(symbol);
      setPriceHistory(historyData);
      
      setError(null);
    } catch (err) {
      setError(`Failed to fetch data for ${symbol}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshData = async () => {
    try {
      setLoading(true);
      await refreshSingleCrypto(symbol);
      await fetchCryptoData();
    } catch (err) {
      setError(`Failed to refresh data for ${symbol}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCryptoData();
  }, [symbol]);

  if (!symbol) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center">
        <p className="text-gray-400">Select a cryptocurrency to view details</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="bg-gray-800 p-8 rounded-lg shadow-lg text-center">
        <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-blue-500 rounded-full"></div>
        <p className="mt-4 text-gray-400">Loading {symbol} data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <div className="bg-red-900/30 text-red-400 p-4 rounded mb-4">
          <p>{error}</p>
        </div>
        <button 
          onClick={fetchCryptoData}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center"
        >
          <RefreshCcw size={16} className="mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  if (!details || !priceHistory) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <p className="text-gray-400">No data available for {symbol}</p>
      </div>
    );
  }

  // Check if priceHistory has a message property (no data available)
  if (priceHistory.message) {
    return (
      <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
        <h2 className="text-2xl font-bold text-gray-100 mb-4">{symbol}</h2>
        <p className="text-gray-400">{priceHistory.message}</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-800 p-6 rounded-lg shadow-lg">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-100">{symbol}</h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div>
            <h3 className="text-gray-400 mb-2">Current Price</h3>
            <p className="text-4xl font-bold text-white">{formatCurrency(details?.currentPrice, details?.currentPrice < 0.01)}</p>
            <p className={`text-sm mt-2 ${(details?.changePercent || 0) >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {formatPercentage(details?.changePercent || 0)} ({details?.changeText || 'No change'})
            </p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <h3 className="text-xl font-semibold text-gray-100 mb-4">Price History Summary</h3>
        <div className="bg-gray-700/50 p-4 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <h4 className="text-gray-400 text-sm">Start Date</h4>
              <p className="text-white font-medium">{priceHistory?.startDate || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-gray-400 text-sm">End Date</h4>
              <p className="text-white font-medium">{priceHistory?.endDate || 'N/A'}</p>
            </div>
            <div>
              <h4 className="text-gray-400 text-sm">End Price</h4>
              <p className="text-white font-medium">{formatCurrency(priceHistory?.endPrice, priceHistory?.endPrice < 0.01)}</p>
            </div>
            <div>
              <h4 className="text-gray-400 text-sm">MoM % Change</h4>
              <p className={`font-medium ${(priceHistory?.momChangePercent || 0) > 0 ? 'text-green-500' : (priceHistory?.momChangePercent || 0) < 0 ? 'text-red-500' : 'text-white'}`}>
                {formatPercentage(priceHistory?.momChangePercent || 0)}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-between items-center">
        <button 
          onClick={handleRefreshData}
          className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded flex items-center"
        >
          <RefreshCcw size={16} className="mr-2" />
          Refresh Data
        </button>
        
        <a 
          href={`https://finance.yahoo.com/quote/${symbol}-USD`} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300 flex items-center text-sm"
        >
          View on Yahoo Finance <ExternalLink size={14} className="ml-1" />
        </a>
      </div>
    </div>
  );
};

CryptoDetails.propTypes = {
  symbol: PropTypes.string
};

export default CryptoDetails; 