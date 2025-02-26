import { AlertCircle, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Error = ({ message, onRetry }) => {
  const { theme } = useTheme();
  
  return (
    <div className={`flex flex-col items-center justify-center min-h-[60vh] p-6 ${
      theme === 'dark' ? 'text-white' : 'text-gray-800'
    }`}>
      <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
      <h2 className="text-2xl font-bold mb-2">Something Went Wrong</h2>
      <p className="text-center mb-6 max-w-md opacity-75">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className={`px-4 py-2 rounded-lg flex items-center ${
            theme === 'dark' 
              ? 'bg-blue-600 hover:bg-blue-700 text-white' 
              : 'bg-blue-500 hover:bg-blue-600 text-white'
          }`}
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </button>
      )}
    </div>
  );
};

export default Error; 