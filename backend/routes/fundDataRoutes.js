import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createReadStream } from 'fs';
import csvParser from 'csv-parser';
import { createObjectCsvWriter } from 'csv-writer';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Path to the fund data CSV file
const fundDataPath = path.join(__dirname, '../../data/fund_data.csv');

// Get all fund data
router.get('/', (req, res) => {
  const results = [];
  
  createReadStream(fundDataPath)
    .pipe(csvParser())
    .on('data', (data) => {
      // Convert the date format from DD-MMM-YY to YYYY-MM-DD for easier sorting
      const dateParts = data.Date.split('-');
      const month = {
        'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06',
        'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'
      };
      
      // Handle both 2-digit and 4-digit year formats
      let year = dateParts[2];
      if (year.length === 2) {
        year = '20' + year; // Assuming all years are in the 2000s
      }
      
      const formattedDate = `${year}-${month[dateParts[1]]}-${dateParts[0].padStart(2, '0')}`;
      
      results.push({
        date: data.Date,
        formattedDate,
        value: parseFloat(data['MoM_%_Chg'])
      });
    })
    .on('end', () => {
      // Sort by date in descending order (newest first)
      results.sort((a, b) => new Date(b.formattedDate) - new Date(a.formattedDate));
      
      // Calculate month-over-month percentage changes
      for (let i = 0; i < results.length - 1; i++) {
        const currentValue = results[i].value;
        const previousValue = results[i + 1].value;
        
        // Calculate percentage change
        if (previousValue !== 0) {
          results[i].percentChange = ((currentValue - previousValue) / Math.abs(previousValue)) * 100;
        } else {
          results[i].percentChange = 0;
        }
      }
      
      // The oldest entry won't have a previous value to compare with
      if (results.length > 0) {
        results[results.length - 1].percentChange = 0;
      }
      
      res.json(results);
    })
    .on('error', (error) => {
      console.error('Error reading fund data:', error);
      res.status(500).json({ error: 'Failed to read fund data' });
    });
});

// Add new fund data
router.post('/', (req, res) => {
  const { date, value } = req.body;
  
  if (!date || value === undefined) {
    return res.status(400).json({ error: 'Date and value are required' });
  }
  
  // Validate value is a valid number
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return res.status(400).json({ error: 'Value must be a valid number' });
  }
  
  console.log('Received value:', value, 'Parsed as:', numValue);
  
  // Read existing data
  const results = [];
  createReadStream(fundDataPath)
    .pipe(csvParser())
    .on('data', (data) => {
      results.push(data);
    })
    .on('end', () => {
      // Check if the date already exists
      // Parse the input date to extract month and year for comparison
      const dateParts = date.split('-');
      const inputMonth = dateParts[1]; // e.g., 'Jan'
      const inputYear = dateParts[2];  // e.g., '25'
      
      console.log('Input date parts:', dateParts);
      console.log('Checking for existing date with month:', inputMonth, 'and year:', inputYear);
      
      // Check if any existing date has the same month and year
      const matchingDate = results.find(item => {
        const existingParts = item.Date.split('-');
        const existingMonth = existingParts[1];
        const existingYear = existingParts[2];
        
        const monthYearMatch = existingMonth === inputMonth && existingYear === inputYear;
        
        if (monthYearMatch) {
          console.log('Found matching date:', item.Date);
        }
        
        return monthYearMatch;
      });
      
      if (matchingDate) {
        console.log('Date already exists:', date);
        console.log('Matching existing date:', matchingDate.Date);
        return res.status(400).json({ 
          error: `Data for ${inputMonth} ${inputYear.length === 2 ? '20' + inputYear : inputYear} already exists` 
        });
      }
      
      // Add new data
      const newData = {
        Date: date,
        'MoM_%_Chg': numValue.toString()
      };
      
      console.log('Saving new data:', newData);
      
      // Write back to CSV
      const writer = createObjectCsvWriter({
        path: fundDataPath,
        header: [
          { id: 'Date', title: 'Date' },
          { id: 'MoM_%_Chg', title: 'MoM_%_Chg' }
        ]
      });
      
      writer.writeRecords([newData, ...results])
        .then(() => {
          res.status(201).json({ message: 'Fund data added successfully', data: newData });
        })
        .catch(error => {
          console.error('Error writing fund data:', error);
          res.status(500).json({ error: 'Failed to write fund data' });
        });
    })
    .on('error', (error) => {
      console.error('Error reading fund data:', error);
      res.status(500).json({ error: 'Failed to read fund data' });
    });
});

export default router; 