import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import csvtojson from 'csvtojson';
import process from 'process';

// Get the directory paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '../../data');
const CRYPTO_DATA_DIR = path.join(DATA_DIR, 'crypto_data');
const CRYPTO_CONFIG_FILE = path.join(DATA_DIR, 'crypto_config.json');

// Ensure the data directories exist
async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CRYPTO_DATA_DIR, { recursive: true });
    console.log('Data directories created or already exist');
  } catch (error) {
    console.error('Error creating directories:', error);
    throw error;
  }
}

// Load cryptocurrencies from config file
async function loadCryptocurrencies() {
  try {
    const data = await fs.readFile(CRYPTO_CONFIG_FILE, 'utf8');
    const cryptos = JSON.parse(data);
    console.log(`Loaded ${cryptos.length} cryptocurrencies from config file`);
    return cryptos;
  } catch (error) {
    console.error('Error loading cryptocurrencies:', error);
    throw error;
  }
}

// Helper function to write data to CSV
async function writeCSV(filePath, data) {
  const csvHeader = 'Date,Price,MoM_%_Chg';
  const csvRows = data.map(item => `${item.Date},${item.Price.toFixed(2)},${item.MoMChange || ''}`);
  const csvContent = [csvHeader, ...csvRows].join('\n');
  await fs.writeFile(filePath, csvContent);
}

// Function to extract end-of-month data from daily data
async function generateEOMData(crypto, dailyDataPath, eomDataPath) {
  try {
    // Read daily data from CSV
    const dailyData = await csvtojson().fromFile(dailyDataPath);
    if (!dailyData || dailyData.length === 0) {
      console.log(`No data found for ${crypto}`);
      return;
    }
    console.log(`Found ${dailyData.length} daily records for ${crypto}`);

    // Get today's date and set to start of day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    console.log(`Today's date: ${today.toISOString().split('T')[0]}`);

    // Filter out future dates and current month
    const historicalData = dailyData.filter(row => {
      const date = new Date(row.Date);
      return date < today;
    });
    console.log(`Filtered to ${historicalData.length} historical records (removed future dates)`);

    // Create a map for quick lookup by date
    const priceMap = new Map();
    historicalData.forEach(row => {
      priceMap.set(row.Date, parseFloat(row.Close));
    });

    // Group data by year-month
    const monthlyData = new Map();
    historicalData.forEach(row => {
      const date = new Date(row.Date);
      const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (!monthlyData.has(yearMonth)) {
        monthlyData.set(yearMonth, []);
      }
      monthlyData.get(yearMonth).push(row);
    });

    // Get end-of-month dates and prices
    const eomData = [];
    for (const [yearMonth] of monthlyData) {
      const [year, month] = yearMonth.split('-').map(Number);
      const lastDay = new Date(year, month, 0).getDate();
      const targetDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      
      // Skip if this date is in the future or in the current month
      const targetDateTime = new Date(targetDate);
      if (targetDateTime >= today || 
          (targetDateTime.getFullYear() === today.getFullYear() && 
           targetDateTime.getMonth() === today.getMonth())) {
        console.log(`Skipping date: ${targetDate} (future or current month)`);
        continue;
      }

      if (priceMap.has(targetDate)) {
        console.log(`For ${yearMonth}: Found exact match for ${targetDate} with price ${priceMap.get(targetDate)}`);
        eomData.push({
          Date: targetDate,
          Price: priceMap.get(targetDate),
        });
      }
    }

    // Sort by date
    eomData.sort((a, b) => new Date(a.Date) - new Date(b.Date));

    // Calculate month-over-month changes
    for (let i = 1; i < eomData.length; i++) {
      const currentPrice = eomData[i].Price;
      const previousPrice = eomData[i - 1].Price;
      const momChange = ((currentPrice - previousPrice) / previousPrice) * 100;
      eomData[i].MoM_Pct_Chg = momChange.toFixed(2) + '%';
    }
    eomData[0].MoM_Pct_Chg = '';

    console.log(`Found ${eomData.length} end-of-month dates for ${crypto}`);
    console.log(`Generated ${eomData.length} end-of-month records for ${crypto}`);

    // Write to CSV
    await writeCSV(eomDataPath, eomData);
    console.log(`Successfully saved end-of-month data for ${crypto} to ${eomDataPath}`);
  } catch (error) {
    console.error(`Error generating end-of-month data for ${crypto}:`, error);
    throw error;
  }
}

// Main function to generate end-of-month data for all cryptocurrencies
async function generateAllEOMData() {
  try {
    // Ensure data directories exist
    await ensureDirectories();

    // Load cryptocurrencies from config
    const cryptos = await loadCryptocurrencies();
    console.log(`Loaded ${cryptos.length} cryptocurrencies from config file`);
    console.log(`Generating end-of-month data for ${cryptos.length} cryptocurrencies: ${cryptos.map(c => c.symbol).join(', ')}`);

    // Process each cryptocurrency
    for (const crypto of cryptos) {
      await generateEOMData(
        crypto.symbol,
        path.join(CRYPTO_DATA_DIR, `${crypto.symbol.toLowerCase()}_usd.csv`),
        path.join(CRYPTO_DATA_DIR, `${crypto.symbol.toLowerCase()}_usd_eom.csv`)
      );
    }

    console.log('\nEnd-of-month data generation completed.');
    console.log(`Successfully processed: ${cryptos.map(c => c.symbol).join(', ')}`);
    console.log('End-of-month data generation completed successfully.');
  } catch (error) {
    console.error('Error generating end-of-month data:', error);
    throw error;
  }
}

// Run the main function
generateAllEOMData()
  .then(() => {
    console.log('End-of-month data generation completed successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error generating end-of-month data:', error);
    process.exit(1);
  }); 