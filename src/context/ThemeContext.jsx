import { createContext, useState, useEffect, useContext } from 'react';
import PropTypes from 'prop-types';

// Create the context
export const ThemeContext = createContext();

// Custom hook to use the theme context
export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// Create the provider component
const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default dark mode
  
  useEffect(() => {
    // Apply the theme class to the document
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.classList.toggle('light', !isDarkMode);
    
    // Also set a data attribute for additional CSS targeting
    document.documentElement.setAttribute('data-theme', isDarkMode ? 'dark' : 'light');
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme, theme: isDarkMode ? 'dark' : 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
};

// Add prop types
ThemeProvider.propTypes = {
  children: PropTypes.node.isRequired
};

// Export the provider
export { ThemeProvider }; 