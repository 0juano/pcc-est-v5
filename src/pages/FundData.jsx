import React, { useState, useEffect, useMemo } from 'react';
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
import { useTheme } from '../context/ThemeContext';
import {
  ResponsiveContainer,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';

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

// CLAUDE-ANCHOR: fd-component-start 8a7e2d1c-bd45-4e81-9c3c-f52f8b54e7d1
// Purpose: Main FundData component for displaying fund information and charts
// The component fetches fund data from the API and displays it in various formats
const FundData = () => {
  // CLAUDE-ANCHOR: fd-state-management b5c9a3f7-ec68-4f5e-a22d-e28e9bf62a15
  // State variables for the component
  const [funds, setFunds] = useState([]);
  const [selectedFunds, setSelectedFunds] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [timePeriod, setTimePeriod] = useState('month');
  const [sortBy, setSortBy] = useState('changePercent');
  const [sortDirection, setSortDirection] = useState('desc');
  const [view, setView] = useState('table');
  const [fundHistoryData, setFundHistoryData] = useState({});
  const { darkMode } = useTheme();
  
  // CLAUDE-ANCHOR: fd-data-fetching 6d19c847-a1a5-4f34-8b33-1e5fd7e9c0f3
  // Effect hook for fetching initial fund data
  useEffect(() => {
    const fetchFunds = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await axios.get('http://localhost:5000/api/fund-data');
        setFunds(response.data);
        
        // Auto-select first 3 funds if none are selected
        if (selectedFunds.length === 0 && response.data.length > 0) {
          const initialSelected = response.data.slice(0, 3).map(fund => fund.symbol);
          setSelectedFunds(initialSelected);
        }
      } catch (err) {
        setError('Failed to fetch fund data. Please try again later.');
        console.error('Error fetching fund data:', err);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchFunds();
  }, []);
  
  // CLAUDE-ANCHOR: fd-history-fetching c8a4e916-25f6-4bc7-b8ce-db1a3f7ac245
  // Effect hook for fetching historical data for selected funds
  useEffect(() => {
    const fetchFundHistory = async () => {
      if (selectedFunds.length === 0) return;
      
      try {
        const response = await axios.get('http://localhost:5000/api/fund-data/history', {
          params: {
            symbols: selectedFunds.join(','),
            period: timePeriod
          }
        });
        
        setFundHistoryData(response.data);
      } catch (err) {
        console.error('Error fetching fund history:', err);
        // Don't set main error state to avoid disrupting the UI
      }
    };
    
    fetchFundHistory();
  }, [selectedFunds, timePeriod]);
  
  // CLAUDE-ANCHOR: fd-data-processing e1f2a3b4-c5d6-7e8f-9a0b-1c2d3e4f5a6b
  // Process the funds data for sorting and filtering
  const processedFunds = useMemo(() => {
    if (!funds.length) return [];
    
    // Apply sorting
    return [...funds].sort((a, b) => {
      // null checks
      if (a[sortBy] === null) return 1;
      if (b[sortBy] === null) return -1;
      
      // Actual comparison
      if (sortDirection === 'asc') {
        return a[sortBy] > b[sortBy] ? 1 : -1;
      } else {
        return a[sortBy] < b[sortBy] ? 1 : -1;
      }
    });
  }, [funds, sortBy, sortDirection]);
  
  // CLAUDE-ANCHOR: fd-chart-data-processing 7a1b2c3d-8e9f-0a1b-2c3d-4e5f6a7b8c9d
  // Process the historical data for the chart
  const chartData = useMemo(() => {
    if (Object.keys(fundHistoryData).length === 0 || selectedFunds.length === 0) {
      return [];
    }
    
    // Find the fund with the most data points to use as the base
    let baseSymbol = selectedFunds[0];
    let maxLength = 0;
    
    for (const symbol of selectedFunds) {
      const historyData = fundHistoryData[symbol];
      if (historyData && historyData.length > maxLength) {
        maxLength = historyData.length;
        baseSymbol = symbol;
      }
    }
    
    // Use the base fund's dates
    const baseHistory = fundHistoryData[baseSymbol] || [];
    
    return baseHistory.map((point, index) => {
      const dataPoint = {
        date: new Date(point.date).toLocaleDateString(),
        [baseSymbol]: point.value
      };
      
      // Add data for other selected funds
      for (const symbol of selectedFunds) {
        if (symbol !== baseSymbol) {
          const history = fundHistoryData[symbol] || [];
          const matchingPoint = history.find(p => 
            new Date(p.date).toLocaleDateString() === dataPoint.date
          );
          
          dataPoint[symbol] = matchingPoint ? matchingPoint.value : null;
        }
      }
      
      return dataPoint;
    });
  }, [fundHistoryData, selectedFunds]);
  
  // CLAUDE-ANCHOR: fd-event-handlers d1e2f3a4-b5c6-7d8e-9f0a-1b2c3d4e5f6a
  // Event handlers for user interactions
  const handleSort = (column) => {
    if (sortBy === column) {
      // Toggle direction if clicking the same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new sort column and default to descending
      setSortBy(column);
      setSortDirection('desc');
    }
  };
  
  const handleFundSelection = (symbol) => {
    setSelectedFunds(prev => {
      if (prev.includes(symbol)) {
        return prev.filter(s => s !== symbol);
      } else {
        return [...prev, symbol];
      }
    });
  };
  
  const handleTimePeriodChange = (period) => {
    setTimePeriod(period);
  };
  
  const handleViewChange = (newView) => {
    setView(newView);
  };
  
  // CLAUDE-ANCHOR: fd-rendering 5e4d3c2b-1a0f-9e8d-7c6b-5a4b3c2d1e0f
  // Conditional rendering based on component state
  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex flex-col justify-center items-center h-full text-center">
        <div className="text-red-500 mb-4 text-xl">⚠️ {error}</div>
        <button 
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }
  
  if (funds.length === 0) {
    return (
      <div className="flex justify-center items-center h-full">
        <div className="text-gray-500 dark:text-gray-400">No fund data available</div>
      </div>
    );
  }
  
  return (
    <div className={`p-4 ${darkMode ? 'dark:bg-gray-800 dark:text-white' : 'bg-white'}`}>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Fund Data</h1>
        <p className="text-gray-600 dark:text-gray-300">
          Track and compare performance of various funds
        </p>
      </div>
      
      {/* Controls */}
      <div className="flex flex-wrap justify-between mb-6 gap-4">
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1 rounded ${view === 'table' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-700'}`}
            onClick={() => handleViewChange('table')}
          >
            Table View
          </button>
          <button
            className={`px-3 py-1 rounded ${view === 'chart' 
              ? 'bg-blue-500 text-white' 
              : 'bg-gray-200 dark:bg-gray-700'}`}
            onClick={() => handleViewChange('chart')}
          >
            Chart View
          </button>
        </div>
        
        {view === 'chart' && (
          <div className="flex flex-wrap gap-2">
            <button
              className={`px-3 py-1 rounded ${timePeriod === 'day' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => handleTimePeriodChange('day')}
            >
              1D
            </button>
            <button
              className={`px-3 py-1 rounded ${timePeriod === 'week' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => handleTimePeriodChange('week')}
            >
              1W
            </button>
            <button
              className={`px-3 py-1 rounded ${timePeriod === 'month' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => handleTimePeriodChange('month')}
            >
              1M
            </button>
            <button
              className={`px-3 py-1 rounded ${timePeriod === 'year' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => handleTimePeriodChange('year')}
            >
              1Y
            </button>
            <button
              className={`px-3 py-1 rounded ${timePeriod === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 dark:bg-gray-700'}`}
              onClick={() => handleTimePeriodChange('all')}
            >
              All
            </button>
          </div>
        )}
      </div>
      
      {/* Table View */}
      {view === 'table' && (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden">
            <thead className="bg-gray-100 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-2 text-left">
                  <button 
                    className="font-semibold text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white flex items-center"
                    onClick={() => handleSort('name')}
                  >
                    Fund
                    {sortBy === 'name' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button 
                    className="font-semibold text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white flex items-center"
                    onClick={() => handleSort('symbol')}
                  >
                    Symbol
                    {sortBy === 'symbol' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button 
                    className="font-semibold text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white flex items-center"
                    onClick={() => handleSort('value')}
                  >
                    Value
                    {sortBy === 'value' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <button 
                    className="font-semibold text-gray-600 dark:text-gray-200 hover:text-gray-900 dark:hover:text-white flex items-center"
                    onClick={() => handleSort('changePercent')}
                  >
                    Change %
                    {sortBy === 'changePercent' && (
                      <span className="ml-1">
                        {sortDirection === 'asc' ? '↑' : '↓'}
                      </span>
                    )}
                  </button>
                </th>
                <th className="px-4 py-2 text-left">
                  <span className="font-semibold text-gray-600 dark:text-gray-200">Select</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {processedFunds.map((fund) => (
                <tr 
                  key={fund.symbol}
                  className="border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <td className="px-4 py-2">{fund.name}</td>
                  <td className="px-4 py-2">{fund.symbol}</td>
                  <td className="px-4 py-2">${fund.value.toFixed(2)}</td>
                  <td className={`px-4 py-2 ${fund.changePercent >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                    {fund.changePercent >= 0 ? '+' : ''}{fund.changePercent.toFixed(2)}%
                  </td>
                  <td className="px-4 py-2">
                    <input 
                      type="checkbox"
                      checked={selectedFunds.includes(fund.symbol)}
                      onChange={() => handleFundSelection(fund.symbol)}
                      className="form-checkbox h-5 w-5 text-blue-500 dark:border-gray-600"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Chart View */}
      {view === 'chart' && (
        <div>
          <div className="mb-4">
            <h2 className="text-xl font-semibold">Performance Chart</h2>
            <p className="text-gray-600 dark:text-gray-300">
              {selectedFunds.length === 0 
                ? 'Select funds from the table to view their performance' 
                : `Showing performance for ${selectedFunds.join(', ')}`}
            </p>
          </div>
          
          {selectedFunds.length === 0 ? (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
              <p className="text-gray-500 dark:text-gray-400">
                No funds selected. Please select funds from the table view to see their performance chart.
              </p>
            </div>
          ) : chartData.length === 0 ? (
            <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500 dark:text-gray-400">
                Loading chart data...
              </p>
            </div>
          ) : (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow-md h-96">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={chartData}
                  margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke={darkMode ? '#374151' : '#e5e7eb'} />
                  <XAxis 
                    dataKey="date" 
                    stroke={darkMode ? '#9ca3af' : '#6b7280'}
                    tick={{ fill: darkMode ? '#d1d5db' : '#374151' }}
                  />
                  <YAxis 
                    stroke={darkMode ? '#9ca3af' : '#6b7280'}
                    tick={{ fill: darkMode ? '#d1d5db' : '#374151' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: darkMode ? '#1f2937' : '#ffffff',
                      color: darkMode ? '#f9fafb' : '#111827',
                      border: `1px solid ${darkMode ? '#374151' : '#e5e7eb'}`
                    }} 
                  />
                  <Legend />
                  {selectedFunds.map((symbol, index) => {
                    // Array of colors for the lines
                    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
                    return (
                      <Line
                        key={symbol}
                        type="monotone"
                        dataKey={symbol}
                        stroke={colors[index % colors.length]}
                        activeDot={{ r: 8 }}
                        dot={{ r: 0 }}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
// CLAUDE-ANCHOR: fd-component-end 8a7e2d1c-bd45-4e81-9c3c-f52f8b54e7d1

export default FundData; 