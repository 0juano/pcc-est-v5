import { createContext, useState, useEffect } from 'react';
import PropTypes from 'prop-types';

// Create the context
export const ThemeContext = createContext();

// Create the provider component
const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(true); // Default dark mode
  
  useEffect(() => {
    // Apply the theme class to the document
    document.documentElement.classList.toggle('dark', isDarkMode);
    document.documentElement.classList.toggle('light', !isDarkMode);
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  return (
    <ThemeContext.Provider value={{ isDarkMode, toggleTheme }}>
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