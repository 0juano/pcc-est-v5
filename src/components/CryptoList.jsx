import { useState, useEffect } from 'react';
import { RefreshCw, Plus, X, Trash2 } from 'lucide-react';
import PropTypes from 'prop-types';
import { getAllCryptocurrencies, addCryptocurrency, removeCryptocurrency } from '../api/cryptoApi';

const CryptoList = ({ onSelectCrypto, selectedCrypto }) => {
  const [cryptos, setCryptos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [yahooUrl, setYahooUrl] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState(null);
  const [addSuccess, setAddSuccess] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [cryptoToDelete, setCryptoToDelete] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState(null);
  const [deleteSuccess, setDeleteSuccess] = useState(null);

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

  const handleAddCrypto = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    setAddSuccess(null);

    try {
      const result = await addCryptocurrency(yahooUrl);
      setAddSuccess(result.message);
      setYahooUrl('');
      // Refresh the list to show the new cryptocurrency
      await fetchCryptocurrencies();
      // Close the form after successful addition
      setTimeout(() => {
        setShowAddForm(false);
        setAddSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error adding cryptocurrency:', err);
      // Display the specific error message from the server
      setAddError(err.response?.data?.message || 'Failed to add cryptocurrency');
    } finally {
      setAddLoading(false);
    }
  };

  const handleDeleteClick = (e, crypto) => {
    e.stopPropagation(); // Prevent row click event
    setCryptoToDelete(crypto);
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (!cryptoToDelete) return;
    
    setDeleteLoading(true);
    setDeleteError(null);
    setDeleteSuccess(null);
    
    try {
      const result = await removeCryptocurrency(cryptoToDelete.symbol);
      setDeleteSuccess(result.message || `Successfully removed ${cryptoToDelete.name}`);
      
      // If the deleted crypto was selected, deselect it
      if (selectedCrypto === cryptoToDelete.symbol) {
        onSelectCrypto(null);
      }
      
      // Refresh the list
      await fetchCryptocurrencies();
      
      // Close the confirmation after success
      setTimeout(() => {
        setShowDeleteConfirm(false);
        setCryptoToDelete(null);
        setDeleteSuccess(null);
      }, 3000);
    } catch (err) {
      console.error('Error removing cryptocurrency:', err);
      setDeleteError(err.response?.data?.message || 'Failed to remove cryptocurrency');
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(false);
    setCryptoToDelete(null);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-semibold flex items-center">
          <span>Available Cryptocurrencies</span>
        </h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center bg-green-600 hover:bg-green-700 text-white py-1 px-3 rounded transition-colors"
          >
            {showAddForm ? <X size={16} className="mr-1" /> : <Plus size={16} className="mr-1" />}
            <span>{showAddForm ? 'Cancel' : 'Add Crypto'}</span>
          </button>
          <button
            onClick={fetchCryptocurrencies}
            className="flex items-center bg-blue-600 hover:bg-blue-700 text-white py-1 px-3 rounded transition-colors"
          >
            <RefreshCw size={16} className="mr-1" />
            <span>Refresh List</span>
          </button>
        </div>
      </div>

      {showAddForm && (
        <div className="mb-4 p-3 bg-gray-700 rounded-lg">
          <h3 className="text-sm font-medium mb-2">Add Cryptocurrency from Yahoo Finance</h3>
          <form onSubmit={handleAddCrypto} className="flex flex-col space-y-2">
            <div className="flex flex-col space-y-1">
              <label htmlFor="yahooUrl" className="text-xs text-gray-400">
                Yahoo Finance URL
              </label>
              <input
                type="text"
                id="yahooUrl"
                value={yahooUrl}
                onChange={(e) => setYahooUrl(e.target.value)}
                placeholder="https://finance.yahoo.com/quote/SYMBOL-USD/"
                className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
              <p className="text-xs text-gray-400 mt-1">
                Enter a Yahoo Finance URL for a cryptocurrency. Examples:
                <br />
                • Bitcoin: https://finance.yahoo.com/quote/BTC-USD/
                <br />
                • Bittensor: https://finance.yahoo.com/quote/TAO22974-USD/
                <br />
                • Solana: https://finance.yahoo.com/quote/SOL-USD/
              </p>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={addLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white py-1 px-4 rounded text-sm flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {addLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent text-white rounded-full mr-2"></div>
                    <span>Adding...</span>
                  </>
                ) : (
                  <span>Add Cryptocurrency</span>
                )}
              </button>
            </div>
            {addError && (
              <div className="mt-2 text-sm text-red-400 bg-red-900/30 p-2 rounded">
                {addError}
              </div>
            )}
            {addSuccess && (
              <div className="mt-2 text-sm text-green-400 bg-green-900/30 p-2 rounded">
                {addSuccess}
              </div>
            )}
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && cryptoToDelete && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-lg shadow-xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold mb-4">Confirm Deletion</h3>
            <p className="mb-6">
              Are you sure you want to remove <span className="font-bold text-red-400">{cryptoToDelete.name} ({cryptoToDelete.symbol})</span>? 
              This will delete all associated data and cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={handleDeleteCancel}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded"
                disabled={deleteLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded flex items-center"
                disabled={deleteLoading}
              >
                {deleteLoading ? (
                  <>
                    <div className="animate-spin w-4 h-4 border-2 border-current border-t-transparent text-white rounded-full mr-2"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={16} className="mr-2" />
                    <span>Delete</span>
                  </>
                )}
              </button>
            </div>
            {deleteError && (
              <div className="mt-4 text-sm text-red-400 bg-red-900/30 p-2 rounded">
                {deleteError}
              </div>
            )}
            {deleteSuccess && (
              <div className="mt-4 text-sm text-green-400 bg-green-900/30 p-2 rounded">
                {deleteSuccess}
              </div>
            )}
          </div>
        </div>
      )}

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
                <th className="py-2 px-4 text-center">Actions</th>
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
                      {Math.round(crypto.dataPoints)} data points
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={(e) => handleDeleteClick(e, crypto)}
                      className="text-red-500 hover:text-red-400 hover:bg-red-900/30 p-1 rounded transition-colors"
                      title={`Remove ${crypto.name}`}
                    >
                      <X size={18} />
                    </button>
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