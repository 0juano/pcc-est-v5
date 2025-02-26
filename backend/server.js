import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import dotenv from 'dotenv';

// Routes
import cryptoRoutes from './routes/cryptoRoutes.js';
import fundDataRoutes from './routes/fundDataRoutes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
/* global process */
const PORT = process.env.PORT || 5001;

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, '../data');
const cryptoDataDir = path.join(dataDir, 'crypto_data');

async function ensureDirectoriesExist() {
  try {
    await fs.mkdir(dataDir, { recursive: true });
    await fs.mkdir(cryptoDataDir, { recursive: true });
    console.log('✓ Data directories created or verified');
    
    // Check if crypto data files exist
    const files = await fs.readdir(cryptoDataDir);
    console.log(`Found ${files.length} cryptocurrency data files`);
    
    if (files.length === 0) {
      console.log('No data files found. You may need to run the data refresh endpoint.');
    }
  } catch (error) {
    console.error('Error creating data directories:', error);
  }
}

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Serve data directory as static files
app.use('/data', express.static(path.join(__dirname, '../data')));

// Routes
app.use('/api/crypto', cryptoRoutes);
app.use('/api/fund-data', fundDataRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, '../dist', 'index.html'));
  });
}

// Start the server
app.listen(PORT, async () => {
  await ensureDirectoriesExist();
  console.log(`Server running on port ${PORT}`);
}); 