/**
 * Main entry point for the Employee Data Processing System
 * Orchestrates the process of reading, validating, and storing employee data
 */

require('dotenv').config();
const path = require('path');
const { pipeline } = require('stream/promises');
const { createReadStream, createCSVParser, getFileType } = require('./lib/fileReader');
const { createEmployeeTransformer, createBatchTransformer } = require('./lib/transformer');
const { initDatabase, createDatabaseWriter } = require('./lib/database');
const { createMemoryMonitor } = require('./lib/memoryMonitor');
const { createLogger } = require('./utils/logger');
const cliProgress = require('cli-progress');

// Create a logger
const logger = createLogger({
  level: 'info',
  prefix: 'Employee Processor'
});

// Check for DISABLE_MEMORY_MONITOR environment variable
const shouldMonitorMemory = process.env.DISABLE_MEMORY_MONITOR !== 'true';

// Create a memory monitor - use text mode only for compatibility
const memoryMonitor = createMemoryMonitor({
  displayGraph: shouldMonitorMemory,
  graphRefreshInterval: 5000,
  textModeOnly: true  // Force text-only mode for reliability
});

// Create a progress bar
const progressBar = new cliProgress.SingleBar({
  format: 'Processing: [{bar}] {percentage}% | {value}/{total} records | {duration_formatted} | Speed: {speed} records/s',
  barCompleteChar: '=',
  barIncompleteChar: '-',
  hideCursor: true,
  clearOnComplete: true,
  fps: 5  // Update max 5 times per second to reduce CPU usage
}, cliProgress.Presets.shades_classic);

// Process statistics
const stats = {
  totalRecords: 0,
  validRecords: 0,
  invalidRecords: 0,
  storedRecords: 0,
  startTime: null,
  endTime: null,
  filePath: null,
  fileSize: 0
};

/**
 * Process an employee data file
 * @param {string} filePath - Path to the employee data file
 * @param {Object} options - Processing options
 * @returns {Promise} - Promise that resolves when processing is complete
 */
async function processEmployeeFile(filePath, options = {}) {
  // Validate file path
  if (!filePath) {
    throw new Error('File path is required');
  }

  // Set default options
  const defaultOptions = {
    batchSize: parseInt(process.env.BATCH_SIZE || '100', 10),
    showProgress: true
  };
  
  const processingOptions = { ...defaultOptions, ...options };
  
  logger.info(`Starting to process employee data file: ${filePath}`);
  logger.info(`Batch size: ${processingOptions.batchSize}`);
  
  try {
    // Initialize database
    await initDatabase();
    
    // Get file type
    const fileType = getFileType(filePath);
    logger.info(`Detected file type: ${fileType}`);
    
    // Create source stream and get file size
    let sourceStream;
    let csvParser;
    
    if (fileType === 'csv') {
      // Create CSV parser with object mode
      csvParser = createCSVParser({
        skipLines: 0,
        skipRows: 0
      });
      
      // Create source stream
      sourceStream = createReadStream(filePath);
    } else if (fileType === 'json') {
      // JSON file handling would go here
      throw new Error('JSON file processing not implemented yet');
    } else {
      throw new Error(`Unsupported file type: ${fileType}`);
    }
    
    // Start memory monitoring only if not disabled
    if (shouldMonitorMemory) {
      memoryMonitor.start();
      
      // Set up throttling based on memory usage
      memoryMonitor.on('threshold-exceeded', (info) => {
        logger.warn(`Memory threshold exceeded: ${info.current.toFixed(2)}MB / ${info.threshold}MB - Throttling processing`);
      });
      
      memoryMonitor.on('threshold-restored', (info) => {
        logger.info(`Memory usage restored to normal: ${info.current.toFixed(2)}MB / ${info.threshold}MB - Resuming normal processing`);
      });
    } else {
      logger.info('Memory monitoring is disabled');
    }
    
    logger.info('Starting processing...');
    // Initialize statistics
    stats.startTime = Date.now();
    stats.filePath = filePath;
    
    // Create transform streams
    const employeeTransformer = createEmployeeTransformer({
      highWaterMark: processingOptions.batchSize
    });
    
    const batchTransformer = createBatchTransformer({
      batchSize: processingOptions.batchSize,
      validOnly: true
    });
    
    // Create database writer
    const dbWriter = createDatabaseWriter({
      batchSize: processingOptions.batchSize
    });
    
    // Set up progress tracking
    let recordCount = 0;
    
    // Create a transform stream to count records
    const recordCounter = new (require('stream').Transform)({
      objectMode: true,
      transform(chunk, encoding, callback) {
        recordCount++;
        
        if (processingOptions.showProgress) {
          progressBar.update(recordCount);
        }
        
        // Check if we should throttle based on memory usage
        if (shouldMonitorMemory && memoryMonitor.isThrottling()) {
          // Introduce a small delay to reduce processing speed when memory usage is high
          setTimeout(() => {
            this.push(chunk);
            callback();
          }, 10); // 10ms delay when throttling
        } else {
          this.push(chunk);
          callback();
        }
      }
    });
    
    logger.info('Counting records...');
    
    // Count total records first using a Promise
    const totalRecords = await new Promise((resolve, reject) => {
      let count = 0;
      const countingParser = createCSVParser({
        skipLines: 0,
        skipRows: 0
      });
      
      const countingStream = createReadStream(filePath);
      
      countingStream
        .pipe(countingParser)
        .on('data', () => {
          count++;
        })
        .on('end', () => {
          resolve(count);
        })
        .on('error', (err) => {
          reject(err);
        });
    });
    
    logger.info(`Total records counted: ${totalRecords}`);
    
    // Initialize progress bar if enabled
    if (processingOptions.showProgress) {
      progressBar.start(totalRecords, 0);
      logger.info(`Total records to process: ${totalRecords}`);
    }
    
    // Process records
    await pipeline(
      sourceStream,
      csvParser,
      recordCounter,
      employeeTransformer,
      batchTransformer,
      dbWriter
    );
    
    // Update stats
    stats.endTime = Date.now();
    stats.totalRecords = recordCount;
    stats.validRecords = employeeTransformer.getStats().valid;
    stats.invalidRecords = employeeTransformer.getStats().invalid;
    stats.storedRecords = dbWriter.getStats().successfulInserts;
    
    // Stop progress bar if enabled
    if (processingOptions.showProgress) {
      progressBar.stop();
    }
    
    // Stop memory monitoring if enabled - give it a bit of time to finalize
    if (shouldMonitorMemory) {
      setTimeout(() => {
        try {
          memoryMonitor.stop();
        } catch (error) {
          logger.error(`Error stopping memory monitor: ${error.message}`);
        }
        
        // Print processing summary
        printSummary();
      }, 1000);
    } else {
      // Print processing summary immediately if memory monitoring is disabled
      printSummary();
    }
    
    return stats;
  } catch (error) {
    logger.error(`Error processing employee data file: ${error.message}`);
    
    // Stop progress bar if enabled
    if (processingOptions.showProgress) {
      progressBar.stop();
    }
    
    // Stop memory monitoring if enabled
    if (shouldMonitorMemory) {
      try {
        memoryMonitor.stop();
      } catch (stopError) {
        logger.error(`Error stopping memory monitor: ${stopError.message}`);
      }
    }
    
    throw error;
  }
}

/**
 * Print processing summary
 */
function printSummary() {
  const duration = (stats.endTime - stats.startTime) / 1000; // in seconds
  const recordsPerSecond = stats.totalRecords / duration;
  
  console.log('\n======= Processing Summary =======');
  console.log(`File: ${stats.filePath}`);
  console.log(`Duration: ${duration.toFixed(2)} seconds`);
  console.log(`Records processed: ${stats.totalRecords}`);
  console.log(`Valid records: ${stats.validRecords}`);
  console.log(`Invalid records: ${stats.invalidRecords}`);
  console.log(`Records stored in database: ${stats.storedRecords}`);
  console.log(`Processing speed: ${recordsPerSecond.toFixed(2)} records/second`);
  console.log('=================================');
  
  // Print memory usage if monitoring is enabled
  if (shouldMonitorMemory) {
    try {
      const memStats = memoryMonitor.getStats();
      console.log('\n======= Memory Usage Summary =======');
      console.log(`Peak memory usage: ${memStats.max.toFixed(2)} MB`);
      console.log(`Average memory usage: ${memStats.average.toFixed(2)} MB`);
      console.log('=====================================');
    } catch (error) {
      console.log('\n======= Memory Usage Summary =======');
      console.log('Could not retrieve memory statistics');
      console.log('=====================================');
    }
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Get file path from command line arguments
    const filePath = process.argv[2];
    
    if (!filePath) {
      logger.error('Please provide a file path as a command line argument');
      process.exit(1);
    }
    
    // Process the file
    await processEmployeeFile(filePath);
    
    // Exit with success
    // Exit after a short delay to allow for cleanup
    setTimeout(() => {
      process.exit(0);
    }, 100);
  } catch (error) {
    logger.error(`Error in main process: ${error.message}`);
    process.exit(1);
  }
}

// Run the main function if this file is executed directly
if (require.main === module) {
  main();
}

// Export for testing and importing in other modules
module.exports = {
  processEmployeeFile
}; 