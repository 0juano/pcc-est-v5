import { useContext } from 'react';
import { Moon, Sun } from 'lucide-react';
import { ThemeContext } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { isDarkMode, toggleTheme } = useContext(ThemeContext);

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-full transition-colors flex items-center justify-center
        dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white dark:border-gray-600
        light:bg-white light:hover:bg-gray-100 light:text-gray-800 light:border-gray-200
        border shadow-sm"
      aria-label={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDarkMode ? (
        <Sun size={20} className="text-yellow-400" />
      ) : (
        <Moon size={20} className="text-indigo-600" />
      )}
    </button>
  );
};

export default ThemeToggle; 