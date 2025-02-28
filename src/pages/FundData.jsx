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
  const { isDarkMode } = useContext(ThemeContext);
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
        label: 'PCC Fund NAV (Base 100)',
        data: Array.isArray(fundData) ? (() => {
          // Get reversed values (oldest first)
          const reversedData = [...fundData].reverse();
          let navValue = 100; // Start with base 100
          const navValues = [navValue]; // Store the starting value
          
          // Calculate cumulative NAV for each month, starting from the first month
          for (let i = 0; i < reversedData.length - 1; i++) {
            // Calculate: previous NAV * (1 + MoM change)
            navValue = navValue * (1 + reversedData[i + 1].value);
            navValues.push(parseFloat(navValue.toFixed(2)));
          }
          
          return navValues;
        })() : [],
        borderColor: isDarkMode ? 'rgba(209, 213, 219, 1)' : 'rgba(55, 65, 81, 1)',
        backgroundColor: isDarkMode ? 'rgba(209, 213, 219, 0.5)' : 'rgba(55, 65, 81, 0.5)',
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
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
          callback: function(value) {
            return value.toFixed(0);
          }
        }
      },
      x: {
        grid: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
        },
        ticks: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
        }
      }
    },
    plugins: {
      legend: {
        labels: {
          color: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)'
        }
      },
      tooltip: {
        backgroundColor: isDarkMode ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)',
        titleColor: isDarkMode ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.9)',
        bodyColor: isDarkMode ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.7)',
        borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            return `NAV: ${context.raw.toFixed(2)}`;
          }
        }
      }
    }
  };

  return (
    <div className={`p-4 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-900'}`}>
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Fund Data</h1>
        <button 
          onClick={fetchFundData}
          className="flex items-center px-4 py-2 rounded-lg bg-gray-900 hover:bg-black text-white transition-colors"
        >
          <RefreshCw size={18} className="mr-2" />
          Refresh Data
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        {/* Add Fund Data Form */}
        <div className={`p-5 rounded-xl shadow-sm h-[500px] flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center mb-4">
            <PlusCircle size={18} className={`mr-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
            <h2 className="text-lg font-semibold">Add Fund Data</h2>
          </div>
          
          <form onSubmit={handleSubmit} className="flex-grow flex flex-col justify-between">
            <div>
              <div className="mb-4">
                <label className="block mb-2 font-medium">Date</label>
                <input
                  type="month"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={`w-full p-2 border rounded-md appearance-none ${
                    isDarkMode 
                      ? 'bg-gray-700 border-gray-600 text-white' 
                      : 'bg-white border-gray-300 text-gray-900'
                  }`}
                  required
                  style={{ colorScheme: isDarkMode ? 'dark' : 'light' }}
                />
                <p className="mt-1 text-sm text-gray-400">Select month and year</p>
              </div>
              
              <div className="mb-4">
                <label className="block mb-2 font-medium">Fund MoM % Chg</label>
                <div className="relative">
                  <span className={`absolute left-3 top-2 ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                    %
                  </span>
                  <input
                    type="number"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    step="0.001"
                    placeholder="0.00"
                    className={`w-full p-2 pl-8 border rounded-md ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    required
                  />
                </div>
                <p className="mt-1 text-sm text-gray-400">Enter the month-over-month percentage change (e.g., 5.89 for +5.89%)</p>
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
            </div>
            
            <div className="mt-4">
              <button
                type="submit"
                className="w-full py-2 px-4 rounded-md bg-gray-900 hover:bg-black text-white font-medium transition-colors"
              >
                Submit
              </button>
            </div>
          </form>
        </div>
        
        {/* Fund Data History */}
        <div className={`p-5 rounded-xl shadow-sm h-[500px] flex flex-col ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
          <div className="flex items-center mb-4">
            <LineChart size={18} className={`mr-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
            <h2 className="text-lg font-semibold">Fund Data History</h2>
          </div>
          
          {loading ? (
            <div className="flex justify-center items-center h-64">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-500"></div>
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
            <div className="overflow-y-auto overflow-x-auto flex-grow relative scrollbar-thin scrollbar-thumb-gray-400 scrollbar-track-transparent">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className={`${isDarkMode ? 'bg-gray-700' : 'bg-gray-100'} sticky top-0 z-10`}>
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
                      DATE
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider">
                      MOM % CHANGE
                    </th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${isDarkMode ? 'divide-gray-700' : 'divide-gray-200'}`}>
                  {Array.isArray(fundData) && fundData.map((item, index) => (
                    <tr key={index} className={isDarkMode ? 'bg-gray-800 hover:bg-gray-700' : 'bg-white hover:bg-gray-50'}>
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
      <div className={`p-5 rounded-xl shadow-sm ${isDarkMode ? 'bg-gray-800' : 'bg-white'}`}>
        <div className="flex items-center mb-4">
          <LineChart size={18} className={`mr-2 ${isDarkMode ? 'text-gray-300' : 'text-gray-700'}`} />
          <h2 className="text-lg font-semibold">Fund Performance Chart (NAV)</h2>
        </div>
        
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-500"></div>
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