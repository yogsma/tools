/**
 * File Reader module
 * Creates a readable stream from a file with proper error handling and backpressure support
 */

const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream');
const csvParser = require('csv-parser');

/**
 * Create a readable stream from a file
 * @param {string} filePath - Path to the file
 * @param {Object} options - Stream options
 * @returns {stream.Readable} - Readable stream
 */
function createReadStream(filePath, options = {}) {
  const defaultOptions = {
    highWaterMark: 64 * 1024, // Default 64KB chunks for good performance
    encoding: 'utf8'
  };
  
  const streamOptions = { ...defaultOptions, ...options };
  
  // Check if file exists
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }
  
  // Create readable stream
  return fs.createReadStream(filePath, streamOptions);
}

/**
 * Create a CSV parser stream
 * @param {Object} options - CSV parser options
 * @returns {stream.Transform} - Transform stream
 */
function createCSVParser(options = {}) {
  const defaultOptions = {
    strict: true,
    skipLines: 0,
  };
  
  return csvParser({ ...defaultOptions, ...options });
}

/**
 * Process a CSV file using streams with automatic error handling
 * @param {string} filePath - Path to the CSV file
 * @param {Function} processFunction - Function to process each record
 * @param {Object} options - Processing options
 * @returns {Promise} - Promise that resolves when processing is complete
 */
function processCSVFile(filePath, processFunction, options = {}) {
  return new Promise((resolve, reject) => {
    const fileStream = createReadStream(filePath, options.readStream);
    const parser = createCSVParser(options.csvParser);
    
    // Track processing statistics
    const stats = {
      totalRecords: 0,
      errorRecords: 0,
      successRecords: 0,
      startTime: Date.now(),
      endTime: null
    };
    
    // Error handling function
    const handleError = (error) => {
      console.error('Error processing file:', error);
      reject(error);
    };
    
    // Create pipeline
    pipeline(
      fileStream,
      parser,
      async function* (source) {
        for await (const record of source) {
          stats.totalRecords++;
          
          try {
            // Process each record
            const result = await processFunction(record, stats);
            if (result === false) {
              stats.errorRecords++;
            } else {
              stats.successRecords++;
            }
            
            // Yield the result for further processing if needed
            yield { record, result };
          } catch (error) {
            console.error(`Error processing record #${stats.totalRecords}:`, error);
            stats.errorRecords++;
            
            // Optionally yield error information
            yield { record, error };
          }
        }
      },
      (err) => {
        if (err) {
          handleError(err);
        } else {
          stats.endTime = Date.now();
          resolve(stats);
        }
      }
    );
    
    // Handle stream errors
    fileStream.on('error', handleError);
    parser.on('error', handleError);
  });
}

/**
 * Determine the file type based on extension
 * @param {string} filePath - Path to the file
 * @returns {string} - File type (e.g., 'csv', 'json', 'unknown')
 */
function getFileType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.csv':
      return 'csv';
    case '.json':
      return 'json';
    case '.txt':
      return 'text';
    default:
      return 'unknown';
  }
}

module.exports = {
  createReadStream,
  createCSVParser,
  processCSVFile,
  getFileType
}; 