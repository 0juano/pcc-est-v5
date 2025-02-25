import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import PropTypes from 'prop-types';
import { getAllCryptocurrencies } from '../api/cryptoApi';

const CryptoList = ({ onSelectCrypto, selectedCrypto }) => {
  const [cryptos, setCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCryptocurrencies = async () => {
    try {
      setLoading(true);
      const data = await getAllCryptocurrencies();
      setCryptos(data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch cryptocurrencies');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCryptocurrencies();
  }, []);

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center">
          <span>Available Cryptocurrencies</span>
        </h2>
        <button
          onClick={fetchCryptocurrencies}
          className="flex items-center bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded transition-colors"
        >
          <RefreshCw size={16} className="mr-1" />
          <span>Refresh List</span>
        </button>
      </div>

      {loading ? (
        <div className="py-8 text-center">
          <div className="animate-spin inline-block w-6 h-6 border-2 border-current border-t-transparent text-blue-500 rounded-full"></div>
          <p className="mt-2 text-gray-400">Loading cryptocurrencies...</p>
        </div>
      ) : error ? (
        <div className="bg-red-900/30 text-red-400 p-3 rounded">
          <p>{error}</p>
          <button 
            onClick={fetchCryptocurrencies}
            className="mt-2 text-white bg-red-600 hover:bg-red-700 py-1 px-3 rounded text-sm"
          >
            Try Again
          </button>
        </div>
      ) : (
        <div className="w-full">
          <table className="w-full">
            <thead className="bg-gray-700 text-left">
              <tr>
                <th className="py-2 px-4">Name</th>
                <th className="py-2 px-4 text-right">Data Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {cryptos.map((crypto) => (
                <tr 
                  key={crypto.symbol}
                  className={`hover:bg-gray-700 cursor-pointer transition-colors ${
                    crypto.symbol === selectedCrypto ? 'bg-blue-900/50' : ''
                  }`}
                  onClick={() => onSelectCrypto(crypto.symbol)}
                >
                  <td className="py-3 px-4">{crypto.name}</td>
                  <td className="py-3 px-4 text-right">
                    <span className={`inline-block rounded-full px-2 py-1 text-xs ${
                      crypto.dataPoints > 0 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-gray-600 text-gray-300'
                    }`}>
                      {crypto.dataPoints} data points
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

CryptoList.propTypes = {
  onSelectCrypto: PropTypes.func.isRequired,
  selectedCrypto: PropTypes.string
};

export default CryptoList; 