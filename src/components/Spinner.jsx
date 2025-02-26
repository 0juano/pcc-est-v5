import { Loader2 } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const Spinner = ({ size = 'medium', fullScreen = false }) => {
  const { theme } = useTheme();
  
  const sizes = {
    small: 'w-6 h-6',
    medium: 'w-12 h-12',
    large: 'w-16 h-16'
  };
  
  const sizeClass = sizes[size] || sizes.medium;
  
  return (
    <div className={`flex flex-col items-center justify-center ${fullScreen ? 'min-h-screen' : 'min-h-[60vh]'} ${
      theme === 'dark' ? 'text-white' : 'text-gray-800'
    }`}>
      <Loader2 className={`${sizeClass} animate-spin text-blue-500`} />
      <p className="mt-4 text-sm opacity-75">Loading...</p>
    </div>
  );
};

export default Spinner; 