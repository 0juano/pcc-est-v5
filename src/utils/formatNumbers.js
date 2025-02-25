/**
 * Format numbers according to the specified rules:
 * - Always include thousands separator (,)
 * - Numbers < 100: 1 decimal place
 * - Numbers < 1: 2 decimal places
 * - Other numbers: no decimal places
 * 
 * @param {number} value - The number to format
 * @param {boolean} forceDecimals - Force showing decimals even for large numbers
 * @returns {string} - Formatted number string
 */
export const formatNumber = (value, forceDecimals = false) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0';
  }

  const absValue = Math.abs(value);
  
  // Determine decimal places based on the value
  let decimalPlaces = 0;
  if (forceDecimals || absValue < 1) {
    decimalPlaces = absValue < 1 ? 2 : 1;
  } else if (absValue < 100) {
    decimalPlaces = 1;
  }

  // Format with thousands separator and appropriate decimal places
  return value.toLocaleString('en-US', {
    minimumFractionDigits: decimalPlaces,
    maximumFractionDigits: decimalPlaces,
  });
};

/**
 * Format currency values with $ prefix
 * 
 * @param {number} value - The currency value to format
 * @param {boolean} forceDecimals - Force showing decimals even for large numbers
 * @returns {string} - Formatted currency string
 */
export const formatCurrency = (value, forceDecimals = false) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '$0';
  }
  
  return '$' + formatNumber(value, forceDecimals);
};

/**
 * Format percentage values with % suffix and +/- sign
 * 
 * @param {number} value - The percentage value to format
 * @returns {string} - Formatted percentage string
 */
export const formatPercentage = (value) => {
  if (value === null || value === undefined || isNaN(value)) {
    return '0.0%';
  }
  
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero'
  });
  
  return `${formatted}%`;
}; 