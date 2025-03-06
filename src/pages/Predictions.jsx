import { useState, useEffect } from 'react';
import { useTheme } from '../context/ThemeContext';
import axios from 'axios';
import { Loader2, Share2, Download, Info, AlertCircle, AreaChart, Check } from 'lucide-react';
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
  const [selectedAssets, setSelectedAssets] = useState({});
  const [analysisStage, setAnalysisStage] = useState('idle');
  const [analysisComplete, setAnalysisComplete] = useState(false);

  // Initialize selected assets when report loads
  useEffect(() => {
    const initializeAssets = async () => {
      try {
        // Get list of all available assets
        const cryptoResponse = await axios.get('http://localhost:5001/api/crypto');
        if (Array.isArray(cryptoResponse.data)) {
          const initialSelectedAssets = {};
          cryptoResponse.data.forEach(crypto => {
            initialSelectedAssets[crypto.symbol] = true; // All selected by default
          });
          
          // If we have a report, merge its assets with the crypto list
          if (report?.individual_analysis) {
            Object.keys(report.individual_analysis).forEach(crypto => {
              if (!(crypto in initialSelectedAssets)) {
                initialSelectedAssets[crypto] = true;
              }
            });
          }
          
          setSelectedAssets(initialSelectedAssets);
        }
      } catch (err) {
        console.error('Error initializing assets:', err);
      }
    };
    
    initializeAssets();
  }, [report]);

  // Function to get recommendation and color for an asset
  const getAssetRecommendation = (data) => {
    const pearsonStrength = Math.abs(data.Pearson_Correlation || 0);
    const spearmanStrength = Math.abs(data.Spearman_Correlation || 0);
    const r2Strength = data.R_Squared || 0;
    
    if (r2Strength > 0.5 && pearsonStrength > 0.7 && spearmanStrength > 0.7) {
      return { text: "Strong Include", color: "text-green-500 dark:text-green-400" };
    } else if (r2Strength > 0.3 && pearsonStrength > 0.5 && spearmanStrength > 0.5) {
      return { text: "Consider Including", color: "text-blue-500 dark:text-blue-400" };
    } else if (r2Strength > 0.1 && pearsonStrength > 0.3 && spearmanStrength > 0.3) {
      return { text: "Weak Relationship", color: "text-yellow-500 dark:text-yellow-400" };
    } else {
      return { text: "Not Recommended", color: "text-red-500 dark:text-red-400" };
    }
  };

  // Function to toggle asset selection
  const toggleAsset = (crypto) => {
    setSelectedAssets(prev => ({
      ...prev,
      [crypto]: !prev[crypto]
    }));
  };

  // Function to select/deselect all assets
  const toggleAll = (select) => {
    const newSelection = Object.keys(selectedAssets).reduce((acc, crypto) => {
      acc[crypto] = select;
      return acc;
    }, {});
    setSelectedAssets(newSelection);
  };

  // Common button styles
  const buttonBaseStyles = `
    transition-all duration-200 
    font-medium 
    shadow-sm 
    hover:shadow-md 
    active:shadow-sm 
    active:transform 
    active:translate-y-0.5
  `;

  const primaryButtonStyles = `
    ${buttonBaseStyles}
    px-6 py-3 
    rounded-xl
    flex items-center 
    justify-center
    gap-2
    ${theme === 'dark' 
      ? 'bg-purple-500 hover:bg-purple-400 text-white disabled:bg-gray-800 disabled:text-gray-400' 
      : 'bg-purple-600 hover:bg-purple-500 text-white disabled:bg-gray-100 disabled:text-gray-400'}
    disabled:cursor-not-allowed 
    disabled:hover:shadow-sm
    disabled:transform-none
  `;

  const secondaryButtonStyles = `
    ${buttonBaseStyles}
    px-4 py-2 
    rounded-lg
    flex items-center 
    justify-center
    gap-2
    ${theme === 'dark'
      ? 'bg-gray-800 hover:bg-gray-700 text-gray-100 border border-gray-600'
      : 'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200'}
  `;

  const toggleButtonStyles = `
    ${buttonBaseStyles}
    w-7 h-7 
    rounded-md
    flex items-center 
    justify-center 
    transition-colors
    mr-3
    border-2
  `;

  // Function to run analysis
  const runAnalysis = async () => {
    setAnalyzing(true);
    setError(null);
    setAnalysisComplete(false);
    setAnalysisStage('starting');
    
    try {
      // Get list of selected assets
      const selectedAssetsList = Object.entries(selectedAssets)
        .filter(([, isSelected]) => isSelected)
        .map(([crypto]) => crypto)
        .join(',');

      setAnalysisStage('preprocessing');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Small delay to show status
      
      // Log selected assets for debugging
      console.log('Running analysis with selected assets:', selectedAssetsList);
      
      setAnalysisStage('correlation');
      const response = await axios.get('http://localhost:5001/api/predictions/weight-analysis', {
        params: {
          assets: selectedAssetsList
        }
      });
      
      console.log('Weight analysis response:', response);
      
      if (response.data && response.data.success) {
        setAnalysisStage('visualization');
        // Update report with new analysis results
        setReport(response.data.data);
        // Fetch updated visualizations
        await fetchVisualizations();
        
        setAnalysisStage('finalizing');
        // Keep all existing assets and their selection state
        const updatedSelectedAssets = { ...selectedAssets };
        // Add any new assets from the analysis as unselected by default
        Object.keys(response.data.data.individual_analysis).forEach(crypto => {
          if (!(crypto in updatedSelectedAssets)) {
            updatedSelectedAssets[crypto] = false;
          }
        });
        setSelectedAssets(updatedSelectedAssets);
        
        setAnalysisStage('complete');
        setAnalysisComplete(true);
      } else if (Array.isArray(response.data)) {
        console.error('API returned an array instead of expected object:', response.data);
        setError('Unexpected response format from server. Please check server logs.');
        setAnalysisStage('error');
      } else {
        setError(response.data?.message || 'Analysis failed with unknown error');
        console.error('Analysis failed:', response.data);
        setAnalysisStage('error');
      }
    } catch (err) {
      console.error('Analysis error details:', err);
      
      // Check if this is a missing crypto data error
      if (err.response?.data?.details?.error === "Missing crypto data for latest fund dates") {
        const details = err.response.data.details;
        const missingDates = details.missing_dates || [];
        const latestComplete = details.latest_complete_date;
        const fundMaxDate = details.fund_data_max_date;
        
        setError(
          <div className="space-y-2">
            <p>The fund data has been updated with new dates, but the crypto data is not up to date.</p>
            <p>
              <span className="font-semibold">Latest complete data:</span> {latestComplete}
              <br />
              <span className="font-semibold">Fund data max date:</span> {fundMaxDate}
            </p>
            {missingDates.length > 0 && (
              <div>
                <p className="font-semibold">Missing data for dates:</p>
                <ul className="list-disc pl-5">
                  {missingDates.map(date => (
                    <li key={date}>{date}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-2 font-semibold">Please update the crypto data files with the latest data before running the analysis.</p>
          </div>
        );
      } else {
        setError(err.response?.data?.message || err.message || 'Error running analysis');
      }
      
      setAnalysisStage('error');
    } finally {
      setAnalyzing(false);
      // Analysis complete message will stay visible for 5 seconds
      if (analysisStage === 'complete') {
        setTimeout(() => {
          setAnalysisComplete(false);
          setAnalysisStage('idle');
        }, 5000);
      }
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
      // Get list of all available assets
      const cryptoResponse = await axios.get('http://localhost:5001/api/crypto');
      console.log('Available assets:', cryptoResponse.data); // Debug log
      
      if (Array.isArray(cryptoResponse.data)) {
        const initialSelectedAssets = {};
        cryptoResponse.data.forEach(crypto => {
          console.log('Adding asset:', crypto.symbol); // Debug each asset being added
          initialSelectedAssets[crypto.symbol] = true; // All selected by default
        });
        console.log('Initial selected assets:', initialSelectedAssets); // Debug selected assets
        setSelectedAssets(initialSelectedAssets);
      } else {
        console.error('Crypto response is not an array:', cryptoResponse.data);
      }
      
      // Try to get existing report
      const reportResponse = await axios.get('http://localhost:5001/api/predictions/report');
      if (reportResponse.data.success) {
        console.log('Report data:', reportResponse.data.data); // Debug report data
        setReport(reportResponse.data.data);
        
        // Ensure all assets from the report are included in selectedAssets
        if (reportResponse.data.data?.individual_analysis) {
          const updatedSelectedAssets = { ...selectedAssets };
          Object.keys(reportResponse.data.data.individual_analysis).forEach(crypto => {
            console.log('Adding report asset:', crypto); // Debug each report asset
            if (!(crypto in updatedSelectedAssets)) {
              updatedSelectedAssets[crypto] = true;
            }
          });
          console.log('Updated selected assets with report assets:', updatedSelectedAssets); // Debug final state
          setSelectedAssets(updatedSelectedAssets);
        }
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
    return `${(value * 100).toFixed(2)}%`;
  };

  const renderModelImportance = (modelName, r2Value) => {
    const hasModelImportance = report.model_importance && modelName in report.model_importance;
    const isIncluded = r2Value > 0.3;
    
    if (!isIncluded) {
      return <span className="text-xs text-gray-400 dark:text-gray-500">Excluded</span>;
    }
    
    const importanceValue = hasModelImportance 
      ? report.model_importance[modelName] 
      : ((r2Value ** 2) / 1.5); // Fallback calculation if model_importance is not available
    
    const barWidth = Math.min(100, Math.max(10, importanceValue * 100));
    
    return (
      <div className="flex items-center">
        <div className="w-16 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
          <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${barWidth}%` }}></div>
        </div>
        <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
          {hasModelImportance ? `${(importanceValue * 100).toFixed(1)}%` : "Included"}
        </span>
      </div>
    );
  };

  const renderR2Value = (modelName, r2Value) => {
    if (r2Value === undefined) {
      return <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>;
    }
    
    const colorClass = r2Value > 0.7 ? 'text-green-500 dark:text-green-400' :
                       r2Value > 0.5 ? 'text-blue-500 dark:text-blue-400' :
                       r2Value > 0.3 ? 'text-yellow-500 dark:text-yellow-400' :
                       r2Value < 0 ? 'text-red-500 dark:text-red-400' :
                       'text-gray-400 dark:text-gray-500';
    
    return <span className={`font-medium ${colorClass}`}>{formatPercentage(r2Value)}</span>;
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
          className={primaryButtonStyles}
        >
          {analyzing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Running Analysis...
            </>
          ) : (
            <>
              <AreaChart className="w-5 h-5" />
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
                <li className="mr-2">
                  <button
                    onClick={() => setActiveTab('asset-selection')}
                    className={`inline-block p-4 border-b-2 rounded-t-lg ${
                      activeTab === 'asset-selection'
                        ? theme === 'dark'
                          ? 'border-purple-500 text-purple-400'
                          : 'border-purple-600 text-purple-600'
                        : theme === 'dark'
                        ? 'border-transparent hover:text-gray-300 hover:border-gray-300'
                        : 'border-transparent hover:text-gray-600 hover:border-gray-300'
                    }`}
                  >
                    Asset Selection
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

                <div className={`mt-8 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <h3 className="text-lg font-semibold mb-3">Model Comparison</h3>
                  <p className="text-sm mb-4">
                    This table shows the weights recommended by each model for each cryptocurrency, along with each model&apos;s R² value.
                  </p>
                  
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Model
                          </th>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <th key={crypto} className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              {crypto} Weight
                            </th>
                          ))}
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            R² Value
                          </th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Ensemble Contribution
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
                        {/* OLS Model */}
                        <tr>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">OLS</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap">
                              {report.model_weights?.OLS && `${crypto}_Return` in report.model_weights.OLS ? 
                                formatPercentage(report.model_weights.OLS[`${crypto}_Return`]) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderR2Value('OLS', report.model_performance?.OLS_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderModelImportance('OLS', report.model_performance?.OLS_R2)}
                          </td>
                        </tr>
                        
                        {/* Constrained Model */}
                        <tr>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">Constrained</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap">
                              {report.model_weights?.Constrained && `${crypto}_Return` in report.model_weights.Constrained ? 
                                formatPercentage(report.model_weights.Constrained[`${crypto}_Return`]) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderR2Value('Constrained', report.model_performance?.Constrained_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderModelImportance('Constrained', report.model_performance?.Constrained_R2)}
                          </td>
                        </tr>
                        
                        {/* Ridge Model */}
                        <tr>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">Ridge</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap">
                              {report.model_weights?.Ridge && `${crypto}_Return` in report.model_weights.Ridge ? 
                                formatPercentage(report.model_weights.Ridge[`${crypto}_Return`]) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderR2Value('Ridge', report.model_performance?.Ridge_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderModelImportance('Ridge', report.model_performance?.Ridge_R2)}
                          </td>
                        </tr>
                        
                        {/* Lasso Model */}
                        <tr>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">Lasso</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap">
                              {report.model_weights?.Lasso && `${crypto}_Return` in report.model_weights.Lasso ? 
                                formatPercentage(report.model_weights.Lasso[`${crypto}_Return`]) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderR2Value('Lasso', report.model_performance?.Lasso_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderModelImportance('Lasso', report.model_performance?.Lasso_R2)}
                          </td>
                        </tr>
                        
                        {/* ElasticNet Model */}
                        <tr>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">ElasticNet</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap">
                              {report.model_weights?.ElasticNet && `${crypto}_Return` in report.model_weights.ElasticNet ? 
                                formatPercentage(report.model_weights.ElasticNet[`${crypto}_Return`]) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderR2Value('ElasticNet', report.model_performance?.ElasticNet_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderModelImportance('ElasticNet', report.model_performance?.ElasticNet_R2)}
                          </td>
                        </tr>
                        
                        {/* RandomForest Model */}
                        <tr>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">RandomForest</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap">
                              {report.model_weights?.RandomForest && `${crypto}_Return` in report.model_weights.RandomForest ? 
                                formatPercentage(report.model_weights.RandomForest[`${crypto}_Return`]) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderR2Value('RandomForest', report.model_performance?.RandomForest_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderModelImportance('RandomForest', report.model_performance?.RandomForest_R2)}
                          </td>
                        </tr>
                        
                        {/* GradientBoosting Model */}
                        <tr>
                          <td className="px-4 py-3 whitespace-nowrap font-medium">GradientBoosting</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap">
                              {report.model_weights?.GradientBoosting && `${crypto}_Return` in report.model_weights.GradientBoosting ? 
                                formatPercentage(report.model_weights.GradientBoosting[`${crypto}_Return`]) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderR2Value('GradientBoosting', report.model_performance?.GradientBoosting_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            {renderModelImportance('GradientBoosting', report.model_performance?.GradientBoosting_R2)}
                          </td>
                        </tr>
                        
                        {/* Ensemble (Final) */}
                        <tr className="bg-gray-100 dark:bg-gray-800">
                          <td className="px-4 py-3 whitespace-nowrap font-bold">Ensemble (Final)</td>
                          {Object.keys(report.ensemble_weights).sort().map(crypto => (
                            <td key={crypto} className="px-4 py-3 whitespace-nowrap font-bold">
                              {report.ensemble_weights[crypto]?.Weight !== undefined ? 
                                formatPercentage(report.ensemble_weights[crypto].Weight) : 
                                <span className="text-gray-400 dark:text-gray-500">Run new analysis</span>}
                            </td>
                          ))}
                          <td className="px-4 py-3 whitespace-nowrap font-bold">
                            {renderR2Value('Ensemble', report.model_performance?.Ensemble_R2)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap font-bold">
                            <span className="text-green-600 dark:text-green-400">Final Result</span>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  
                  <div className="mt-2 mb-4 text-sm text-gray-600 dark:text-gray-400">
                    <p>This table shows the weights recommended by each model for each cryptocurrency, along with each model&apos;s R² value. 
                    The color of the R² value indicates model performance: <span className="text-green-500 dark:text-green-400">good</span>, 
                    <span className="text-blue-500 dark:text-blue-400">moderate</span>, 
                    <span className="text-yellow-500 dark:text-yellow-400">fair</span>, or 
                    <span className="text-red-500 dark:text-red-400">poor</span>.</p>
                    
                    <p className="mt-2">
                      <strong>Ensemble Strategy:</strong> The final ensemble weights are calculated by giving much more weight to better-performing models 
                      (based on R² values) and completely ignoring models with poor performance (R² below 0.3).
                    </p>
                    
                    {(!report.model_weights?.Ridge || !report.model_weights?.Lasso || !report.model_weights?.ElasticNet) && (
                      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-md">
                        <p className="text-amber-700 dark:text-amber-400 font-medium">
                          <strong>Action Required:</strong> Some model weights are missing. Please run a new weight analysis to see all model weights.
                        </p>
                        <p className="mt-1 text-amber-600 dark:text-amber-500 text-sm">
                          The table will show &ldquo;Run new analysis&rdquo; for models that need to be updated.
                        </p>
                      </div>
                    )}
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
                        <div className="text-xl font-semibold">
                          {r2 < 0 ? 
                            <span className="text-red-500 dark:text-red-400">{(r2 * 100).toFixed(2)}%</span> : 
                            <span>{(r2 * 100).toFixed(2)}%</span>
                          }
                          {r2 < 0 && 
                            <span className="ml-2 text-xs text-red-500 dark:text-red-400 font-normal">
                              (Poor fit)
                            </span>
                          }
                        </div>
                        <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full mt-2">
                          <div
                            className={`h-full rounded-full ${r2 < 0 ? 'bg-red-500 dark:bg-red-600' : 'bg-purple-500 dark:bg-purple-600'}`}
                            style={{ width: `${Math.max(0, Math.min(100, r2 * 100))}%` }}
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

            {activeTab === 'asset-selection' && report && (
              <div>
                <div className={`p-4 mb-4 rounded-lg flex items-start ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-100'}`}>
                  <Info className={`w-5 h-5 mt-0.5 mr-2 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`} />
                  <div>
                    <p className="text-sm">
                      Select which assets to include in your analysis. Assets are ordered by their recommendation strength based on correlation and R² values.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-center mb-4 gap-4">
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => toggleAll(true)}
                      className={secondaryButtonStyles}
                    >
                      <div className="w-5 h-5 border rounded flex items-center justify-center mr-2 bg-purple-600 border-purple-600">
                        <span className="text-white text-base font-bold">✓</span>
                      </div>
                      <span>Select All</span>
                    </button>
                    <button
                      onClick={() => toggleAll(false)}
                      className={secondaryButtonStyles}
                    >
                      <div className="w-5 h-5 border rounded flex items-center justify-center mr-2 bg-transparent border-gray-300 dark:border-gray-600"></div>
                      <span>Deselect All</span>
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'}`}>
                        {Object.values(selectedAssets).filter(Boolean).length} of {Object.keys(selectedAssets).length} assets selected
                      </div>
                      {analyzing && (
                        <div className="flex flex-col items-end gap-2 mt-2">
                          <div className={`text-sm font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`}>
                            Running analysis with selected assets...
                          </div>
                          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                            <div className="h-full bg-purple-500 rounded-full animate-pulse" style={{ width: '100%' }}></div>
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={runAnalysis}
                      disabled={analyzing || Object.values(selectedAssets).filter(Boolean).length === 0}
                      className={primaryButtonStyles}
                    >
                      {analyzing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Running Analysis...
                        </>
                      ) : (
                        <>
                          <AreaChart className="w-5 h-5" />
                          Run Analysis with Selected Assets
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {analyzing && (
                  <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-gray-700/50' : 'bg-gray-50'}`}>
                    <div className="flex items-center mb-3">
                      <Loader2 className={`w-5 h-5 mr-2 animate-spin ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`} />
                      <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                        Analysis in Progress
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className={`text-sm ${
                        analysisStage === 'starting' 
                          ? `font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`
                          : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        ○ Initializing analysis...
                        {analysisStage === 'starting' && <span className="animate-pulse">⋯</span>}
                      </div>
                      <div className={`text-sm ${
                        analysisStage === 'preprocessing' 
                          ? `font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`
                          : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        ○ Preprocessing selected assets...
                        {analysisStage === 'preprocessing' && <span className="animate-pulse">⋯</span>}
                      </div>
                      <div className={`text-sm ${
                        analysisStage === 'correlation' 
                          ? `font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`
                          : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        ○ Computing correlations and weights...
                        {analysisStage === 'correlation' && <span className="animate-pulse">⋯</span>}
                      </div>
                      <div className={`text-sm ${
                        analysisStage === 'visualization' 
                          ? `font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`
                          : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        ○ Generating visualizations...
                        {analysisStage === 'visualization' && <span className="animate-pulse">⋯</span>}
                      </div>
                      <div className={`text-sm ${
                        analysisStage === 'finalizing' 
                          ? `font-medium ${theme === 'dark' ? 'text-purple-400' : 'text-purple-600'}`
                          : theme === 'dark' ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        ○ Finalizing results...
                        {analysisStage === 'finalizing' && <span className="animate-pulse">⋯</span>}
                      </div>
                    </div>
                  </div>
                )}

                {analysisComplete && !analyzing && (
                  <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-green-900/20' : 'bg-green-50'}`}>
                    <div className="flex items-center">
                      <Check className={`w-5 h-5 mr-2 ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`} />
                      <div className={`text-sm font-medium ${theme === 'dark' ? 'text-green-400' : 'text-green-600'}`}>
                        Analysis complete! New weights and correlations have been calculated.
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className={`mb-6 p-4 rounded-lg ${theme === 'dark' ? 'bg-red-900/20' : 'bg-red-50'}`}>
                    <div className="flex items-start">
                      <AlertCircle className={`w-5 h-5 mr-2 mt-1 ${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`} />
                      <div className={`${theme === 'dark' ? 'text-red-400' : 'text-red-600'}`}>
                        {typeof error === 'string' ? (
                          <div className="text-sm font-medium">{error}</div>
                        ) : (
                          error
                        )}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {Object.keys(selectedAssets)
                    .sort((a, b) => {
                      // Sort by recommendation strength if available in report
                      if (report?.individual_analysis?.[a] && report?.individual_analysis?.[b]) {
                        const recommendationOrder = {
                          "Strong Include": 4,
                          "Consider Including": 3,
                          "Weak Relationship": 2,
                          "Not Recommended": 1
                        };
                        const aRec = getAssetRecommendation(report.individual_analysis[a]).text;
                        const bRec = getAssetRecommendation(report.individual_analysis[b]).text;
                        return recommendationOrder[bRec] - recommendationOrder[aRec];
                      }
                      // If not in report, sort alphabetically
                      return a.localeCompare(b);
                    })
                    .map((crypto) => {
                      const data = report?.individual_analysis?.[crypto] || {};
                      const recommendation = report?.individual_analysis?.[crypto] 
                        ? getAssetRecommendation(data)
                        : { text: "Not Analyzed", color: "text-gray-500 dark:text-gray-400" };
                      const isSelected = selectedAssets[crypto];

                      return (
                        <div
                          key={crypto}
                          className={`p-4 rounded-lg transition-all duration-200 shadow-sm ${
                            theme === 'dark'
                              ? isSelected ? 'bg-gray-800 border border-purple-500' : 'bg-gray-800/50 border border-gray-700'
                              : isSelected ? 'bg-white border border-purple-500' : 'bg-gray-50 border border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex-grow">
                              <div className="flex items-center">
                                <button
                                  onClick={() => toggleAsset(crypto)}
                                  className={`${toggleButtonStyles} ${
                                    isSelected
                                      ? theme === 'dark'
                                        ? 'bg-purple-600 border-purple-600 ring-2 ring-purple-400 ring-opacity-50'
                                        : 'bg-purple-600 border-purple-600 ring-2 ring-purple-500 ring-opacity-50'
                                      : theme === 'dark'
                                      ? 'bg-transparent border-gray-600'
                                      : 'bg-transparent border-gray-300'
                                  }`}
                                  aria-label={isSelected ? "Deselect asset" : "Select asset"}
                                >
                                  {isSelected && (
                                    <span className="text-white text-xl font-bold">✓</span>
                                  )}
                                </button>
                                <div className="ml-1">
                                  <h3 className={`font-medium text-base ${theme === 'dark' ? 'text-gray-100' : 'text-gray-900'} ${!isSelected && 'opacity-50'}`}>
                                    {crypto}
                                  </h3>
                                  <span className={`text-sm font-medium ${recommendation.color} ${!isSelected && 'opacity-50'}`}>
                                    {recommendation.text}
                                  </span>
                                </div>
                              </div>
                              
                              {report?.individual_analysis?.[crypto] ? (
                                <div className={`mt-3 grid grid-cols-2 gap-x-4 gap-y-2 ${!isSelected && 'opacity-50'}`}>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Pearson Correlation</div>
                                    <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                      {data.Pearson_Correlation ? data.Pearson_Correlation.toFixed(3) : 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Spearman Correlation</div>
                                    <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                      {data.Spearman_Correlation ? data.Spearman_Correlation.toFixed(3) : 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">R² Value</div>
                                    <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                      {data.R_Squared ? data.R_Squared.toFixed(3) : 'N/A'}
                                    </div>
                                  </div>
                                  <div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">Weight</div>
                                    <div className={`text-sm font-medium ${theme === 'dark' ? 'text-gray-200' : 'text-gray-700'}`}>
                                      {data.Weight ? (data.Weight * 100).toFixed(1) + '%' : 'N/A'}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className={`mt-3 ${!isSelected && 'opacity-50'}`}>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    This asset hasn&apos;t been analyzed yet. Run the analysis to see correlation data.
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
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
            className={primaryButtonStyles}
          >
            {analyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Running Analysis...
              </>
            ) : (
              <>
                <AreaChart className="w-5 h-5" />
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