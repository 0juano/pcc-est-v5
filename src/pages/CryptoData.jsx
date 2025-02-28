import { useState, useEffect } from 'react';
import { Info, RefreshCw, ExternalLink } from 'lucide-react';
import CryptoList from '../components/CryptoList';
import CryptoDetails from '../components/CryptoDetails';
import { refreshCryptoData, getEOMPriceHistory } from '../api/cryptoApi';
import ThemeToggle from '../components/ThemeToggle';
import { formatCurrency, formatPercentage } from '../utils/formatNumbers';
import { useTheme } from '../context/ThemeContext';

const CryptoData = () => {
  const { isDarkMode } = useTheme();
  const [selectedCrypto, setSelectedCrypto] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState(null);
  
  const handleRefreshData = async () => {
    try {
      setRefreshing(true);
      setRefreshError(null);
      await refreshCryptoData();
    } catch (error) {
      setRefreshError('Failed to refresh cryptocurrency data');
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleSelectCrypto = (symbol) => {
    setSelectedCrypto(symbol);
    // Reset error state when selecting a new crypto
    setHistoryError(null);
  };

  useEffect(() => {
    const fetchPriceHistory = async () => {
      if (!selectedCrypto) return;
      
      try {
        setLoadingHistory(true);
        setHistoryError(null);
        
        console.log(`Fetching end-of-month price history for: ${selectedCrypto}`);
        
        // Use the API function to get end-of-month data
        const csvData = await getEOMPriceHistory(selectedCrypto);
        
        // Check if we got a valid CSV response
        if (typeof csvData !== 'string' || !csvData.includes(',')) {
          console.log('Invalid CSV data format, possibly an error response');
          setHistoryError(`No valid end-of-month data available for ${selectedCrypto}`);
          setPriceHistory([]);
          return;
        }
        
        console.log(`Received data: ${csvData.substring(0, 100)}...`);
        
        // Parse CSV data
        const rows = csvData.trim().split('\n');
        
        console.log(`Found ${rows.length} rows in CSV`);
        
        if (rows.length <= 1) {
          setHistoryError(`No end-of-month data rows found for ${selectedCrypto}`);
          setPriceHistory([]);
          return;
        }
        
        const parsedData = rows.slice(1).map(row => {
          const values = row.split(',');
          
          // Handle potential parsing errors
          let price = 0;
          try {
            price = parseFloat(values[1]);
            if (isNaN(price)) price = 0;
          } catch (e) {
            console.error('Error parsing price:', e);
            price = 0;
          }
          
          let momChange = null;
          try {
            momChange = values[2] ? parseFloat(values[2]) : null;
            if (isNaN(momChange)) momChange = null;
          } catch (e) {
            console.error('Error parsing MoM change:', e);
            momChange = null;
          }
          
          return {
            date: values[0],
            price,
            momChange
          };
        });
        
        // Sort by date in descending order (newest first)
        parsedData.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log(`Parsed ${parsedData.length} data points`);
        
        setPriceHistory(parsedData);
      } catch (error) {
        console.error(`Error fetching end-of-month price history for ${selectedCrypto}:`, error);
        setHistoryError(`Failed to load end-of-month price history: ${error.message}`);
        setPriceHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    };
    
    fetchPriceHistory();
  }, [selectedCrypto]);

  return (
    <div className={`min-h-screen ${isDarkMode 
      ? 'bg-gradient-to-b from-gray-900 to-black text-white' 
      : 'bg-gradient-to-b from-gray-100 to-white text-gray-900'}`}>
      <header className={`p-6 border-b ${isDarkMode ? 'border-gray-800' : 'border-gray-200'} flex justify-between items-center`}>
        <h1 className="text-2xl font-bold">Crypto Data</h1>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleRefreshData}
            disabled={refreshing}
            className={`flex items-center py-2 px-4 rounded transition-colors ${
              isDarkMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                : 'bg-blue-500 hover:bg-blue-600 text-white'
            } ${refreshing ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {refreshing ? (
              <>
                <RefreshCw size={18} className="mr-2 animate-spin" />
                Refreshing Data...
              </>
            ) : (
              <>
                <RefreshCw size={18} className="mr-2" />
                Refresh Data
              </>
            )}
          </button>
          <ThemeToggle />
        </div>
      </header>

      {refreshError && (
        <div className={`mx-6 mt-4 p-3 rounded ${
          isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
        }`}>
          <p className="flex items-center">
            <Info size={18} className="mr-2" />
            {refreshError}
          </p>
          <button
            onClick={handleRefreshData}
            className={`mt-2 py-1 px-3 rounded text-sm ${
              isDarkMode ? 'text-white bg-red-600 hover:bg-red-700' : 'text-white bg-red-500 hover:bg-red-600'
            }`}
          >
            Try Again
          </button>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CryptoList onSelectCrypto={handleSelectCrypto} selectedCrypto={selectedCrypto} />
        <div className="flex flex-col">
          <div className="mb-1">
            <CryptoDetails symbol={selectedCrypto} />
          </div>
          
          {selectedCrypto && (
            <div className={`p-6 rounded-lg shadow-lg ${
              isDarkMode ? 'bg-gray-800' : 'bg-white border border-gray-200'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">{selectedCrypto} Monthly Price History</h2>
                <a 
                  href={`https://finance.yahoo.com/quote/${selectedCrypto}-USD/history/`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className={`flex items-center text-sm ${
                    isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-500'
                  }`}
                >
                  View on Yahoo Finance <ExternalLink size={14} className="ml-1" />
                </a>
              </div>
              
              {loadingHistory ? (
                <div className="py-8 text-center">
                  <div className={`animate-spin inline-block w-6 h-6 border-2 border-t-transparent rounded-full ${
                    isDarkMode ? 'border-current text-blue-500' : 'border-current text-blue-600'
                  }`}></div>
                  <p className={`mt-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>Loading monthly price history...</p>
                </div>
              ) : historyError ? (
                <div className={`py-4 px-4 rounded ${
                  isDarkMode ? 'bg-red-900/30 text-red-400' : 'bg-red-100 text-red-700'
                }`}>
                  <p className="flex items-center">
                    <Info size={18} className="mr-2" />
                    {historyError}
                  </p>
                </div>
              ) : priceHistory.length === 0 ? (
                <div className="py-8 text-center">
                  <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>No monthly price history available for {selectedCrypto}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={`text-left ${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'}`}>
                      <tr>
                        <th className="py-2 px-4">Month End</th>
                        <th className="py-2 px-4 text-right">Price (USD)</th>
                        <th className="py-2 px-4 text-right">MoM % Change</th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      {priceHistory.map((item, index) => (
                        <tr key={index} className={`transition-colors ${
                          isDarkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50'
                        }`}>
                          <td className="py-3 px-4">{item.date || 'N/A'}</td>
                          <td className="py-3 px-4 text-right">{formatCurrency(item.price, item.price < 0.01)}</td>
                          <td className={`py-3 px-4 text-right ${
                            (item.momChange || 0) > 0 
                              ? 'text-green-500' 
                              : (item.momChange || 0) < 0 
                                ? 'text-red-500' 
                                : isDarkMode ? 'text-gray-400' : 'text-gray-500'
                          }`}>
                            {item.momChange !== null && item.momChange !== undefined ? (
                              <>
                                {formatPercentage(item.momChange)}
                              </>
                            ) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CryptoData; 