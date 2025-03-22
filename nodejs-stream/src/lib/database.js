/**
 * Database operations module
 * Provides database operations for storing employee data
 */

const { Writable } = require('stream');
const db = require('../config/database');
const Employee = require('../models/employee');

/**
 * Database writer stream
 * Writes records to the database with backpressure support
 */
class DatabaseWriter extends Writable {
  constructor(options = {}) {
    super({ 
      objectMode: true,
      highWaterMark: options.highWaterMark || 100 
    });
    
    this.batchSize = options.batchSize || parseInt(process.env.BATCH_SIZE || '100', 10);
    this.stats = {
      totalProcessed: 0,
      successfulInserts: 0,
      failedInserts: 0,
      errors: []
    };
  }

  /**
   * Write implementation for storing records in the database
   * @param {Array} chunk - Batch of records to insert
   * @param {string} encoding - Encoding (not used in objectMode)
   * @param {Function} callback - Callback to signal when processing is complete
   */
  async _write(chunk, encoding, callback) {
    try {
      // If chunk is not an array, wrap it
      const records = Array.isArray(chunk) ? chunk : [chunk];
      
      if (records.length === 0) {
        callback();
        return;
      }
      
      // Extract valid data from the records
      const validEmployees = records
        .filter(record => record.valid)
        .map(record => record.data);
      
      this.stats.totalProcessed += records.length;
      
      if (validEmployees.length === 0) {
        callback();
        return;
      }
      
      try {
        // Insert batch of records
        const insertedIds = await Employee.batchInsert(validEmployees);
        this.stats.successfulInserts += insertedIds.length;
      } catch (dbError) {
        console.error('Database batch insert error:', dbError.message);
        
        // Fallback to individual inserts if batch fails
        for (const employee of validEmployees) {
          try {
            const inserted = await Employee.insert(employee);
            if (inserted) {
              this.stats.successfulInserts++;
            } else {
              this.stats.failedInserts++;
              this.stats.errors.push({
                record: employee,
                error: 'Failed to insert record (likely duplicate email)'
              });
            }
          } catch (singleError) {
            this.stats.failedInserts++;
            this.stats.errors.push({
              record: employee,
              error: singleError.message
            });
          }
        }
      }
      
      callback();
    } catch (error) {
      console.error('Error in database writer:', error);
      // Don't stop the stream on individual record errors
      this.stats.errors.push({
        error: error.message
      });
      callback();
    }
  }

  /**
   * Get current statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return { ...this.stats };
  }
}

/**
 * Initialize the database
 * Creates necessary tables and indexes
 * @returns {Promise} - Promise that resolves when initialization is complete
 */
async function initDatabase() {
  try {
    await Employee.initTable();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

/**
 * Create a database writer stream
 * @param {Object} options - Options for the database writer
 * @returns {Writable} - Writable stream
 */
function createDatabaseWriter(options = {}) {
  return new DatabaseWriter(options);
}

module.exports = {
  initDatabase,
  createDatabaseWriter,
  DatabaseWriter,
  db
}; 