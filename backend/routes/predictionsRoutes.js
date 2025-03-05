import express from 'express';
import path from 'path';
import { spawn } from 'child_process';
import fs from 'fs';
import { fileURLToPath } from 'url';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create static directory for analysis outputs if it doesn't exist
const staticDir = path.join(__dirname, '..', 'static');
const analysisDir = path.join(staticDir, 'analysis');
if (!fs.existsSync(staticDir)) fs.mkdirSync(staticDir, { recursive: true });
if (!fs.existsSync(analysisDir)) fs.mkdirSync(analysisDir, { recursive: true });

/**
 * @route   GET /api/predictions/weight-analysis
 * @desc    Run crypto weight analysis and return results
 * @access  Public
 */
router.get('/weight-analysis', async (req, res) => {
  try {
    const scriptPath = path.join(__dirname, '..', 'scripts', 'crypto_weight_estimator.py');
    
    // Check if script exists
    if (!fs.existsSync(scriptPath)) {
      console.error('Analysis script not found at path:', scriptPath);
      return res.status(404).json({ 
        success: false, 
        message: 'Analysis script not found' 
      });
    }

    // Check if we have a cached result that's less than 1 hour old
    const reportPath = path.join(staticDir, 'weight_analysis_report.json');
    if (fs.existsSync(reportPath)) {
      const stats = fs.statSync(reportPath);
      const fileAge = (new Date() - stats.mtime) / (1000 * 60); // Age in minutes
      
      // If report is less than 60 minutes old, check if it matches the requested assets
      if (fileAge < 60) {
        console.log('Found recent weight analysis report');
        // Read the file as a string
        const reportContent = fs.readFileSync(reportPath, 'utf8');
        
        // Replace NaN values with null before parsing
        const sanitizedContent = reportContent.replace(/:\s*NaN/g, ': null');
        
        try {
          const reportData = JSON.parse(sanitizedContent);
          // Only use cache if the assets match
          const reportAssets = Object.keys(reportData.ensemble_weights).sort().join(',');
          const requestedAssets = (req.query.assets || '').split(',').filter(Boolean).sort().join(',');
          
          if (reportAssets === requestedAssets) {
            console.log('Cached report matches requested assets, returning cached version');
            return res.json({
              success: true,
              message: 'Retrieved cached analysis result',
              data: reportData,
              cached: true,
              cachedTime: stats.mtime
            });
          } else {
            console.log('Cached report has different assets, running new analysis');
          }
        } catch (parseError) {
          console.error('Error parsing cached report JSON:', parseError);
          // If cached report is corrupted, continue to run a new analysis
          console.log('Cached report is corrupted, running new analysis...');
        }
      }
    }

    console.log('Running weight analysis script...');
    
    // Check if required data files exist
    const fundDataPath = path.join(__dirname, '..', '..', 'data', 'fund_data.csv');
    const cryptoConfigPath = path.join(__dirname, '..', '..', 'data', 'crypto_config.json');
    
    if (!fs.existsSync(fundDataPath)) {
      console.error('Fund data file not found at path:', fundDataPath);
      return res.status(404).json({
        success: false,
        message: 'Fund data file not found'
      });
    }
    
    if (!fs.existsSync(cryptoConfigPath)) {
      console.error('Crypto config file not found at path:', cryptoConfigPath);
      return res.status(404).json({
        success: false,
        message: 'Crypto configuration file not found'
      });
    }
    
    // Spawn Python process
    const pythonProcess = spawn('python3', [
      scriptPath,
      ...(req.query.assets ? ['--assets', req.query.assets] : [])
    ]);
    
    let output = '';
    let errorOutput = '';
    
    // Collect data from script
    pythonProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log(`Python output: ${chunk}`);
    });
    
    pythonProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      errorOutput += chunk;
      console.error(`Python Error: ${chunk}`);
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      console.log(`Python process exited with code ${code}`);
      
      if (code !== 0) {
        // Check if the error is about missing crypto data
        if (output.includes('"error": "Missing crypto data for latest fund dates"')) {
          try {
            // Try to parse the JSON error message from the output
            const errorStart = output.indexOf('{');
            const errorEnd = output.lastIndexOf('}') + 1;
            const errorJson = output.substring(errorStart, errorEnd);
            
            const errorData = JSON.parse(errorJson);
            
            return res.status(400).json({
              success: false,
              message: 'Missing crypto data for latest fund dates',
              error: 'The fund data has been updated with new dates, but the crypto data is not up to date.',
              details: errorData,
              action: 'Please update the crypto data files with the latest data before running the analysis.'
            });
          } catch (parseError) {
            console.error('Error parsing missing data JSON:', parseError);
          }
        }
        
        return res.status(500).json({ 
          success: false, 
          message: 'Analysis script failed to execute', 
          error: errorOutput,
          exitCode: code
        });
      }
      
      try {
        // Check if the report file exists after script execution
        if (fs.existsSync(reportPath)) {
          console.log('Reading analysis report from file');
          // Read the file as a string
          const reportContent = fs.readFileSync(reportPath, 'utf8');
          
          // Replace NaN values with null before parsing
          const sanitizedContent = reportContent.replace(/:\s*NaN/g, ': null');
          
          try {
            const reportData = JSON.parse(sanitizedContent);
            return res.json({
              success: true,
              message: 'Analysis completed successfully',
              data: reportData,
              cached: false
            });
          } catch (parseError) {
            console.error('Error parsing report JSON:', parseError);
            return res.status(500).json({
              success: false,
              message: 'Error parsing report data. The report file may be corrupted.',
              error: parseError.message
            });
          }
        } else {
          console.log('Report file not found, trying to parse output as JSON');
          console.log('Raw output:', output);
          
          // Try to parse output as JSON
          try {
            const result = JSON.parse(output);
            return res.json({
              success: true,
              message: 'Analysis completed successfully (from stdout)',
              data: result,
              cached: false
            });
          } catch (jsonError) {
            console.error('Failed to parse output as JSON:', jsonError);
            return res.status(500).json({
              success: false,
              message: 'Failed to parse analysis results',
              error: jsonError.message,
              rawOutput: output
            });
          }
        }
      } catch (parseError) {
        console.error('Error processing analysis results:', parseError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process analysis results',
          error: parseError.message,
          rawOutput: output
        });
      }
    });
  } catch (err) {
    console.error('Error running weight analysis:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
});

/**
 * @route   GET /api/predictions/visualizations
 * @desc    Get list of available visualizations
 * @access  Public
 */
router.get('/visualizations', (req, res) => {
  try {
    const vizDir = path.join(analysisDir);
    
    if (!fs.existsSync(vizDir)) {
      return res.json({
        success: true,
        visualizations: []
      });
    }
    
    const files = fs.readdirSync(vizDir)
      .filter(file => file.endsWith('.png'))
      .map(file => ({
        name: file.replace('.png', '').split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' '),
        path: `http://localhost:5001/static/analysis/${file}`
      }));
    
    res.json({
      success: true,
      visualizations: files
    });
  } catch (err) {
    console.error('Error fetching visualizations:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
});

/**
 * @route   GET /api/predictions/report
 * @desc    Get the latest analysis report
 * @access  Public
 */
router.get('/report', (req, res) => {
  try {
    const reportPath = path.join(staticDir, 'weight_analysis_report.json');
    
    if (!fs.existsSync(reportPath)) {
      return res.status(404).json({
        success: false,
        message: 'No analysis report found. Please run the analysis first.'
      });
    }
    
    // Read the file as a string
    const reportContent = fs.readFileSync(reportPath, 'utf8');
    
    // Replace NaN values with null before parsing
    const sanitizedContent = reportContent.replace(/:\s*NaN/g, ': null');
    
    try {
      const reportData = JSON.parse(sanitizedContent);
      
      res.json({
        success: true,
        data: reportData
      });
    } catch (parseError) {
      console.error('Error parsing report JSON:', parseError);
      return res.status(500).json({
        success: false,
        message: 'Error parsing report data. The report file may be corrupted.',
        error: parseError.message
      });
    }
  } catch (err) {
    console.error('Error fetching report:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Server error', 
      error: err.message 
    });
  }
});

export default router; 