import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import { Loader2, Share2, Download, Info, AlertCircle, AreaChart } from 'lucide-react';
import Spinner from '../components/Spinner';
import Error from '../components/Error';

const Predictions = () => {
  const { theme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState(null);
  const [report, setReport] = useState(null);
  const [visualizations, setVisualizations] = useState([]);
  const [activeTab, setActiveTab] = useState('weights');

  // Function to run analysis
  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    
    try {
      const response = await axios.get('http://localhost:5001/api/predictions/weight-analysis');
      console.log('Weight analysis response:', response);
      
      if (response.data && response.data.success) {
        setReport(response.data.data);
        fetchVisualizations();
      } else if (Array.isArray(response.data)) {
        // Handle case where API returns an array instead of expected object
        console.error('API returned an array instead of expected object:', response.data);
        setError('Unexpected response format from server. Please check server logs.');
      } else {
        setError(response.data?.message || 'Analysis failed with unknown error');
        console.error('Analysis failed:', response.data);
      }
    } catch (err) {
      console.error('Analysis error details:', err);
      setError(err.response?.data?.message || err.message || 'Error running analysis');
    } finally {
      setAnalyzing(false);
    }
  };

  // Fetch visualizations
  const fetchVisualizations = async () => {
    try {
      const response = await axios.get('http://localhost:5001/api/predictions/visualizations');
      if (response.data.success) {
        setVisualizations(response.data.visualizations);
      }
    } catch (err) {
      console.error('Error fetching visualizations:', err);
    }
  };

  // Load initial data
  const loadInitialData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Try to get existing report
      const reportResponse = await axios.get('http://localhost:5001/api/predictions/report');
      if (reportResponse.data.success) {
        setReport(reportResponse.data.data);
      }
      
      // Get visualizations
      await fetchVisualizations();
    } catch (err) {
      // If report doesn't exist, that's ok - we'll just show the run analysis button
      if (err.response?.status !== 404) {
        setError(err.response?.data?.message || err.message || 'Error loading data');
        console.error('Data loading error:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return new Date(dateString).toLocaleDateString(undefined, options);
  };

  const formatPercentage = (value) => {
    return value !== null && value !== undefined ? (value * 100).toFixed(2) + '%' : 'N/A';
  };

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return <Error message={error} onRetry={loadInitialData} />;
  }

  return (
    <div className={`container mx-auto p-4 ${theme === 'dark' ? 'text-white' : 'text-gray-800'}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-2">Crypto Fund Weight Predictions</h1>
          <p className="text-sm md:text-base opacity-75">
            Estimate the weights of cryptocurrencies in the fund based on historical performance
          </p>
        </div>
        
        <button
          onClick={runAnalysis}
          disabled={analyzing}
          className={`mt-4 md:mt-0 px-4 py-2 rounded-lg flex items-center ${
            theme === 'dark' 
              ? 'bg-purple-600 hover:bg-purple-700 text-white' 
              : 'bg-purple-500 hover:bg-purple-600 text-white'
          } ${analyzing ? 'opacity-75 cursor-not-allowed' : ''}`}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <AreaChart className="w-5 h-5 mr-2" />
              Run Weight Analysis
            </>
          )}
        </button>
      </div>
      
      {report ? (
        <div className="grid grid-cols-1 gap-6">
          <div className={`p-5 rounded-lg shadow-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4">
              <div>
                <h2 className="text-xl font-semibold">Analysis Results</h2>
                <p className="text-sm opacity-75">
                  Generated on {formatDate(report.generated_at)} • 
                  Data range: {formatDate(report.data_range.start)} to {formatDate(report.data_range.end)} • 
                  {report.data_range.months} months
                </p>
              </div>
              <div className="flex mt-2 md:mt-0">
                <button className={`p-2 rounded-lg mr-2 ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  <Share2 className="w-5 h-5" />
                </button>
                <button className={`p-2 rounded-lg ${theme === 'dark' ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-100 hover:bg-gray-200'}`}>
                  <Download className="w-5 h-5" />
                </button>
              </div>
            </div>
            
            <div className="border-b border-gray-200 dark:border-gray-700 mb-4">
              <ul className="flex flex-wrap -mb-px">
                <li className="mr-2">
                  <button
                    onClick={() => setActiveTab('weights')}
                    className={`inline-block p-4 border-b-2 rounded-t-lg ${
                      activeTab === 'weights'
                        ? theme === 'dark'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-purple-600 text-purple-600'
                        : theme === 'dark'
                        ? 'border-transparent hover:text-gray-300 hover:border-gray-300'
                        : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Estimated Weights
                  </button>
                </li>
                <li className="mr-2">
                  <button
                    onClick={() => setActiveTab('correlations')}
                    className={`inline-block p-4 border-b-2 rounded-t-lg ${
                      activeTab === 'correlations'
                        ? theme === 'dark'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-purple-600 text-purple-600'
                        : theme === 'dark'
                        ? 'border-transparent hover:text-gray-300 hover:border-gray-300'
                        : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Correlations
                  </button>
                </li>
                <li className="mr-2">
                  <button
                    onClick={() => setActiveTab('visualizations')}
                    className={`inline-block p-4 border-b-2 rounded-t-lg ${
                      activeTab === 'visualizations'
                        ? theme === 'dark'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-purple-600 text-purple-600'
                        : theme === 'dark'
                        ? 'border-transparent hover:text-gray-300 hover:border-gray-300'
                        : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Visualizations
                  </button>
                </li>
              </ul>
            </div>
            
            {activeTab === 'weights' && (
              <div>
                <div className="mb-6">
                  <div className={`p-4 mb-4 rounded-lg flex items-start ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Info className={`w-5 h-5 mt-0.5 mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <div>
                      <p className="text-sm">
                        These are the estimated weights of each cryptocurrency in the fund based on a composite of multiple models.
                        The weights sum to 100% and are calculated using historical correlation patterns and portfolio optimization techniques.
                      </p>
                      <p className="text-sm mt-2">
                        Tracking Error: <span className="font-semibold">{(report.tracking_error * 100).toFixed(4)}%</span>
                      </p>
                    </div>
                  </div>
                
                  <div className="overflow-x-auto">
                    <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Cryptocurrency</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Estimated Weight</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">95% Confidence Range</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        {Object.entries(report.ensemble_weights)
                          .sort((a, b) => b[1].Weight - a[1].Weight)
                          .map(([crypto, data]) => (
                            <tr key={crypto}>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="font-medium">{crypto}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {formatPercentage(data.Weight)}
                                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                                  <div
                                    className="bg-purple-600 dark:bg-purple-500 h-2 rounded-full"
                                    style={{ width: `${data.Weight * 100}%` }}
                                  ></div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                {formatPercentage(data.Lower_CI)} - {formatPercentage(data.Upper_CI)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'correlations' && (
              <div>
                <div className="mb-6">
                  <div className={`p-4 mb-4 rounded-lg flex items-start ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Info className={`w-5 h-5 mt-0.5 mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <div>
                      <p className="text-sm mb-2">
                        This analysis shows how well each cryptocurrency&apos;s price movements align with the fund&apos;s performance.
                        Use these metrics to identify which assets are the best candidates for inclusion in the regression model:
                      </p>
                      <ul className="text-sm list-disc list-inside space-y-1 ml-2">
                        <li><span className="font-semibold">Pearson Correlation:</span> Measures linear relationship (-1 to 1) • Strong: &gt;0.7 • Ok: &gt;0.5 • Weak: &gt;0.3 • Bad: ≤0.3</li>
                        <li><span className="font-semibold">Spearman Correlation:</span> Measures monotonic relationship (-1 to 1) • Strong: &gt;0.7 • Ok: &gt;0.5 • Weak: &gt;0.3 • Bad: ≤0.3</li>
                        <li><span className="font-semibold">R² Value:</span> Percentage of fund variance explained • Strong: &gt;50% • Ok: &gt;30% • Weak: &gt;10% • Bad: ≤10%</li>
                      </ul>
                    </div>
                  </div>
                
                  <div className="overflow-x-auto">
                    <table className={`min-w-full divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                      <thead className={theme === 'dark' ? 'bg-gray-700' : 'bg-gray-50'}>
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Cryptocurrency</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Pearson Correlation</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Spearman Correlation</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">R² Value</th>
                          <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">Recommendation</th>
                        </tr>
                      </thead>
                      <tbody className={`divide-y ${theme === 'dark' ? 'divide-gray-700' : 'divide-gray-200'}`}>
                        {Object.entries(report.individual_analysis)
                          .sort((a, b) => b[1].R_Squared - a[1].R_Squared)
                          .map(([crypto, data]) => {
                            // Calculate recommendation based on metrics
                            const pearsonStrength = Math.abs(data.Pearson_Correlation || 0);
                            const spearmanStrength = Math.abs(data.Spearman_Correlation || 0);
                            const r2Strength = data.R_Squared || 0;
                            
                            let recommendation;
                            let recommendationColor;
                            
                            if (r2Strength > 0.5 && pearsonStrength > 0.7 && spearmanStrength > 0.7) {
                              recommendation = "Strong Include";
                              recommendationColor = "text-green-500 dark:text-green-400";
                            } else if (r2Strength > 0.3 && pearsonStrength > 0.5 && spearmanStrength > 0.5) {
                              recommendation = "Consider Including";
                              recommendationColor = "text-blue-500 dark:text-blue-400";
                            } else if (r2Strength > 0.1 && pearsonStrength > 0.3 && spearmanStrength > 0.3) {
                              recommendation = "Weak Relationship";
                              recommendationColor = "text-yellow-500 dark:text-yellow-400";
                            } else {
                              recommendation = "Not Recommended";
                              recommendationColor = "text-red-500 dark:text-red-400";
                            }

                            return (
                              <tr key={crypto}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="font-medium">{crypto}</div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="mb-1">
                                      {data.Pearson_Correlation !== null ? data.Pearson_Correlation.toFixed(4) : 'N/A'}
                                    </span>
                                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          data.Pearson_Correlation > 0 
                                            ? 'bg-green-500 dark:bg-green-600' 
                                            : 'bg-red-500 dark:bg-red-600'
                                        }`}
                                        style={{ 
                                          width: `${Math.abs((data.Pearson_Correlation || 0) * 100)}%`,
                                          marginLeft: data.Pearson_Correlation < 0 ? 'auto' : '0'
                                        }}
                                      />
                                    </div>
                                    {data.Pearson_Correlation !== null && (
                                      <span className={`text-xs mt-1 font-medium ${
                                        Math.abs(data.Pearson_Correlation) > 0.7 
                                          ? 'text-green-500 dark:text-green-400'
                                          : Math.abs(data.Pearson_Correlation) > 0.5
                                          ? 'text-blue-500 dark:text-blue-400'
                                          : Math.abs(data.Pearson_Correlation) > 0.3
                                          ? 'text-yellow-500 dark:text-yellow-400'
                                          : 'text-red-500 dark:text-red-400'
                                      }`}>
                                        {Math.abs(data.Pearson_Correlation) > 0.7 
                                          ? 'Strong' 
                                          : Math.abs(data.Pearson_Correlation) > 0.5
                                          ? 'Ok'
                                          : Math.abs(data.Pearson_Correlation) > 0.3
                                          ? 'Weak'
                                          : 'Bad'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="mb-1">
                                      {data.Spearman_Correlation !== null ? data.Spearman_Correlation.toFixed(4) : 'N/A'}
                                    </span>
                                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${
                                          data.Spearman_Correlation > 0 
                                            ? 'bg-green-500 dark:bg-green-600' 
                                            : 'bg-red-500 dark:bg-red-600'
                                        }`}
                                        style={{ 
                                          width: `${Math.abs((data.Spearman_Correlation || 0) * 100)}%`,
                                          marginLeft: data.Spearman_Correlation < 0 ? 'auto' : '0'
                                        }}
                                      />
                                    </div>
                                    {data.Spearman_Correlation !== null && (
                                      <span className={`text-xs mt-1 font-medium ${
                                        Math.abs(data.Spearman_Correlation) > 0.7 
                                          ? 'text-green-500 dark:text-green-400'
                                          : Math.abs(data.Spearman_Correlation) > 0.5
                                          ? 'text-blue-500 dark:text-blue-400'
                                          : Math.abs(data.Spearman_Correlation) > 0.3
                                          ? 'text-yellow-500 dark:text-yellow-400'
                                          : 'text-red-500 dark:text-red-400'
                                      }`}>
                                        {Math.abs(data.Spearman_Correlation) > 0.7 
                                          ? 'Strong' 
                                          : Math.abs(data.Spearman_Correlation) > 0.5
                                          ? 'Ok'
                                          : Math.abs(data.Spearman_Correlation) > 0.3
                                          ? 'Weak'
                                          : 'Bad'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4">
                                  <div className="flex flex-col">
                                    <span className="mb-1">{(data.R_Squared * 100).toFixed(2)}%</span>
                                    <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full">
                                      <div
                                        className="h-full bg-purple-500 dark:bg-purple-600 rounded-full"
                                        style={{ width: `${data.R_Squared * 100}%` }}
                                      />
                                    </div>
                                    {data.R_Squared !== null && (
                                      <span className={`text-xs mt-1 font-medium ${
                                        data.R_Squared > 0.5 
                                          ? 'text-green-500 dark:text-green-400'
                                          : data.R_Squared > 0.3
                                          ? 'text-blue-500 dark:text-blue-400'
                                          : data.R_Squared > 0.1
                                          ? 'text-yellow-500 dark:text-yellow-400'
                                          : 'text-red-500 dark:text-red-400'
                                      }`}>
                                        {data.R_Squared > 0.5 
                                          ? 'Strong' 
                                          : data.R_Squared > 0.3
                                          ? 'Ok'
                                          : data.R_Squared > 0.1
                                          ? 'Weak'
                                          : 'Bad'}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${recommendationColor}`}>
                                    {recommendation}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`mt-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <h3 className="text-lg font-semibold mb-3">Model Performance Summary</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {Object.entries(report.model_performance).map(([model, r2]) => (
                      <div key={model} className={`p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
                        <div className="text-sm opacity-75 mb-1">{model.replace(/_/g, ' ')}</div>
                        <div className="text-xl font-semibold">{(r2 * 100).toFixed(2)}%</div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-2">
                          <div
                            className="h-full bg-purple-500 dark:bg-purple-600 rounded-full"
                            style={{ width: `${r2 * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
            
            {activeTab === 'visualizations' && (
              <div>
                <div className="mb-6">
                  <div className={`p-4 mb-4 rounded-lg flex items-start ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                    <Info className={`w-5 h-5 mt-0.5 mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                    <div>
                      <p className="text-sm">
                        These visualizations help interpret the analysis results and show different aspects of the 
                        relationship between cryptocurrency performance and fund returns.
                      </p>
                    </div>
                  </div>
                  
                  {visualizations.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-8">
                      <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
                      <p className="text-center text-gray-500 dark:text-gray-400">
                        No visualizations available. Try running the analysis again.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {visualizations.map((viz) => (
                        <div key={viz.path} className={`rounded-lg overflow-hidden shadow-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-white'}`}>
                          <div className="p-3 font-medium text-sm">{viz.name}</div>
                          <div className={`border-t ${theme === 'dark' ? 'border-gray-600' : 'border-gray-200'}`}>
                            <img 
                              src={viz.path} 
                              alt={viz.name}
                              className="w-full h-auto object-contain"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className={`p-8 rounded-lg shadow-lg flex flex-col items-center justify-center ${theme === 'dark' ? 'bg-gray-800' : 'bg-white'}`}>
          <AreaChart className="w-16 h-16 text-purple-500 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Analysis Results Yet</h2>
          <p className="text-center mb-6 max-w-lg">
            Run the crypto fund weight analysis to see estimated weights and correlations between cryptocurrencies and fund returns.
          </p>
          <button
            onClick={runAnalysis}
            disabled={analyzing}
            className={`px-6 py-3 rounded-lg flex items-center ${
              theme === 'dark' 
                ? 'bg-purple-600 hover:bg-purple-700 text-white' 
                : 'bg-purple-500 hover:bg-purple-600 text-white'
            } ${analyzing ? 'opacity-75 cursor-not-allowed' : ''}`}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <AreaChart className="w-5 h-5 mr-2" />
                Run Weight Analysis
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default Predictions; 