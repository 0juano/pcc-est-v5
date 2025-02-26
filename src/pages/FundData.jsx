import { useState, useEffect, useContext } from 'react';
import { RefreshCw, PlusCircle, LineChart } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const FundData = () => {
  const { darkMode } = useContext(ThemeContext);
  const [fundData, setFundData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [date, setDate] = useState('');
  const [value, setValue] = useState('');
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(null);

  // Fetch fund data
  const fetchFundData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await axios.get('http://localhost:5001/api/fund-data');
      console.log('API Response:', response.data);
      
      if (Array.isArray(response.data)) {
        setFundData(response.data);
      } else {
        console.error('API did not return an array:', response.data);
        setFundData([]);
        setError('Invalid data format received from server');
      }
    } catch (err) {
      console.error('Error fetching fund data:', err);
      setFundData([]);
      setError(err.message || 'Failed to fetch fund data');
    } finally {
      setLoading(false);
    }
  };

  // Load fund data on component mount
  useEffect(() => {
    fetchFundData();
  }, []);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Reset messages
    setSubmitError(null);
    setSubmitSuccess(null);
    
    // Validate inputs
    if (!date) {
      setSubmitError('Please select a date');
      return;
    }
    
    // Parse the date input (format: YYYY-MM)
    console.log('Raw date input:', date);
    const [inputYear, inputMonth] = date.split('-');
    
    if (!inputYear || !inputMonth) {
      setSubmitError('Invalid date format. Please use the date picker.');
      return;
    }
    
    // Format date as DD-MMM-YY (e.g., 31-Dec-23)
    const monthIndex = parseInt(inputMonth, 10) - 1; // Convert from 1-indexed to 0-indexed
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    if (monthIndex < 0 || monthIndex > 11) {
      setSubmitError(`Invalid month: ${inputMonth}`);
      return;
    }
    
    const day = '31'; // Always use end of month
    const month = monthNames[monthIndex];
    
    // Get the year in 2-digit format
    const year = inputYear.slice(2);
    
    const formattedDate = `${day}-${month}-${year}`;
    
    // Log the date being submitted for debugging
    console.log('Submitting date:', formattedDate, 'Full year:', inputYear, 'Month index:', monthIndex, 'Month name:', month);
    
    try {
      // Convert percentage to decimal with proper precision
      const percentValue = parseFloat(value);
      const decimalValue = (percentValue / 100).toFixed(6); // Use fixed precision
      
      await axios.post('http://localhost:5001/api/fund-data', {
        date: formattedDate,
        value: decimalValue
      });
      
      // Reset form
      setDate('');
      setValue('');
      setSubmitSuccess('Fund data added successfully');
      
      // Refresh data
      fetchFundData();
    } catch (err) {
      console.error('Error adding fund data:', err);
      setSubmitError(err.response?.data?.error || 'Failed to add fund data');
    }
  };

  // Format percentage for display
  const formatPercentage = (value) => {
    if (value === undefined || value === null) return '-';
    
    const absValue = Math.abs(value);
    let formattedValue;
    
    if (absValue < 1) {
      formattedValue = value.toFixed(2);
    } else if (absValue < 100) {
      formattedValue = value.toFixed(1);
    } else {
      formattedValue = value.toFixed(0);
    }
    
    return `${value >= 0 ? '+' : ''}${formattedValue}%`;
  };

  // Prepare chart data
  const chartData = {
    labels: Array.isArray(fundData) ? fundData.map(item => {
      const date = new Date(item.formattedDate);
      return `${date.getMonth() + 1}/${date.getFullYear().toString().slice(2)}`;
    }).reverse() : [],
    datasets: [
      {
        label: 'PCC Fund MoM % Change',
        data: Array.isArray(fundData) ? fundData.map(item => item.value * 100).reverse() : [],
        borderColor: darkMode ? 'rgba(59, 130, 246, 1)' : 'rgba(37, 99, 235, 1)',
        backgroundColor: darkMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(37, 99, 235, 0.5)',
        tension: 0.1
      }
    ]
  };

  // Chart options
  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          callback: function(value) {
            return value.toFixed(2) + '%';
          }
        }
      },
      x: {
        grid: {
          color: darkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
        }
      },
      tooltip: {
        backgroundColor: darkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        titleColor: darkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        bodyColor: darkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
        borderColor: darkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1
      }
    }
  };

  return (
    <div className={`p-6 ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Fund Data</h1>
        <button 
          onClick={fetchFundData}
          className={`flex items-center px-4 py-2 rounded-lg ${
            darkMode 
              ? 'bg-blue-600 hover:bg-blue-700' 
              : 'bg-blue-500 hover:bg-blue-600'
          } text-white transition-colors`}
        >
          <RefreshCw size={18} className="mr-2" />
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Add Fund Data Form */}
        <div className={`p-6 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center mb-4">
            <PlusCircle size={20} className="mr-2 text-blue-500" />
            <h2 className="text-xl font-semibold">Add Fund Data</h2>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block mb-2 font-medium">Date</label>
              <input
                type="month"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={`w-full p-2 border rounded-md ${
                  darkMode 
                    ? 'bg-gray-700 border-gray-600 text-white' 
                    : 'bg-white border-gray-300 text-gray-900'
                }`}
                required
              />
              <p className="mt-1 text-sm text-gray-500">Select month and year</p>
            </div>
            
            <div className="mb-4">
              <label className="block mb-2 font-medium">Fund MoM % Chg</label>
              <div className="relative">
                <span className={`absolute left-3 top-2 ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                  %
                </span>
                <input
                  type="number"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  step="0.001"
                  placeholder="0.00"
                  className={`w-full p-2 pl-8 border rounded-md ${
                    darkMode 
                      ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                      : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                  }`}
                  required
                />
              </div>
              <p className="mt-1 text-sm text-gray-500">Enter the month-over-month percentage change (e.g., 5.89 for +5.89%)</p>
            </div>
            
            {submitError && (
              <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md">
                {submitError}
              </div>
            )}
            
            {submitSuccess && (
              <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-md">
                {submitSuccess}
              </div>
            )}
            
            <button
              type="submit"
              className={`w-full py-2 px-4 rounded-md ${
                darkMode 
                  ? 'bg-blue-600 hover:bg-blue-700' 
                  : 'bg-blue-500 hover:bg-blue-600'
              } text-white font-medium transition-colors`}
            >
              Submit
            </button>
          </form>
        </div>
        
        {/* Fund Data History */}
        <div className={`p-6 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center mb-4">
            <LineChart size={20} className="mr-2 text-blue-500" />
            <h2 className="text-xl font-semibold">Fund Data History</h2>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="p-4 bg-red-100 text-red-700 rounded-md">
              {error}
            </div>
          ) : !Array.isArray(fundData) || fundData.length === 0 ? (
            <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md">
              No fund data available.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                      MoM % Change
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${darkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {Array.isArray(fundData) && fundData.map((item, index) => (
                    <tr key={index} className={darkMode ? 'bg-gray-800' : 'bg-white'}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.date}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm text-right ${
                        item.value > 0 
                          ? 'text-green-500' 
                          : item.value < 0 
                            ? 'text-red-500' 
                            : ''
                      }`}>
                        {formatPercentage(item.value * 100)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      
      {/* Fund Performance Chart */}
      <div className={`p-6 rounded-lg shadow-md ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center mb-4">
          <LineChart size={20} className="mr-2 text-blue-500" />
          <h2 className="text-xl font-semibold">Fund Performance Chart</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : error ? (
          <div className="p-4 bg-red-100 text-red-700 rounded-md">
            {error}
          </div>
        ) : !Array.isArray(fundData) || fundData.length === 0 ? (
          <div className="p-4 bg-yellow-100 text-yellow-700 rounded-md">
            No fund data available for chart.
          </div>
        ) : (
          <div className="h-96">
            <Line data={chartData} options={chartOptions} />
          </div>
        )}
      </div>
    </div>
  );
};

export default FundData; 