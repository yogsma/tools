/**
 * Transformer module
 * Provides transform streams for data processing with backpressure support
 */

const { Transform } = require('stream');
const { validateEmployee } = require('../utils/validator');

/**
 * Custom transform stream to validate and process employee data
 * Supports backpressure by implementing _transform with proper callback
 */
class EmployeeTransformer extends Transform {
  constructor(options = {}) {
    // Call Transform constructor with objectMode for working with objects instead of buffers
    super({ 
      objectMode: true,
      highWaterMark: options.highWaterMark || 100
    });
    
    this.validationOptions = options.validationOptions || {};
    this.stats = {
      processed: 0,
      valid: 0,
      invalid: 0,
      errors: []
    };
  }

  /**
   * Transform implementation for processing each employee record
   * @param {Object} chunk - Input record
   * @param {string} encoding - Encoding (not used in objectMode)
   * @param {Function} callback - Callback to signal when processing is complete
   */
  _transform(chunk, encoding, callback) {
    try {
      this.stats.processed++;
      
      // Validate employee data
      const validation = validateEmployee(chunk);
      
      if (validation.isValid) {
        this.stats.valid++;
        
        // Push transformed record to output
        this.push({
          data: chunk,
          valid: true,
          errors: []
        });
      } else {
        this.stats.invalid++;
        
        // Store error information
        const error = {
          record: chunk,
          errors: validation.errors
        };
        
        this.stats.errors.push(error);
        
        // Push error record to output
        this.push({
          data: chunk,
          valid: false,
          errors: validation.errors
        });
      }
      
      // Call callback to signal completion
      callback();
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Flush any remaining data (called when input is finished)
   * @param {Function} callback - Callback to signal completion
   */
  _flush(callback) {
    // This could be used to finalize any processing or emit final statistics
    callback();
  }

  /**
   * Get current processing statistics
   * @returns {Object} - Statistics object
   */
  getStats() {
    return { ...this.stats };
  }
}

/**
 * Create a batch transform stream
 * Groups records into batches for more efficient database operations
 */
class BatchTransformer extends Transform {
  constructor(options = {}) {
    super({ objectMode: true });
    
    this.batchSize = options.batchSize || 100;
    this.currentBatch = [];
    this.validOnly = options.validOnly === undefined ? true : options.validOnly;
  }

  /**
   * Transform implementation for batching records
   * @param {Object} chunk - Input record
   * @param {string} encoding - Encoding (not used in objectMode)
   * @param {Function} callback - Callback to signal when processing is complete
   */
  _transform(chunk, encoding, callback) {
    try {
      // Skip invalid records if validOnly is true
      if (this.validOnly && !chunk.valid) {
        callback();
        return;
      }
      
      // Add to current batch
      this.currentBatch.push(chunk);
      
      // If batch is full, push it and reset
      if (this.currentBatch.length >= this.batchSize) {
        this.push(this.currentBatch);
        this.currentBatch = [];
      }
      
      callback();
    } catch (error) {
      callback(error);
    }
  }

  /**
   * Flush any remaining records in the batch
   * @param {Function} callback - Callback to signal completion
   */
  _flush(callback) {
    if (this.currentBatch.length > 0) {
      this.push(this.currentBatch);
      this.currentBatch = [];
    }
    callback();
  }
}

/**
 * Create an employee validator transform stream
 * @param {Object} options - Options for the transformer
 * @returns {Transform} - Transform stream
 */
function createEmployeeTransformer(options = {}) {
  return new EmployeeTransformer(options);
}

/**
 * Create a batch transform stream
 * @param {Object} options - Options for the batch transformer
 * @returns {Transform} - Transform stream
 */
function createBatchTransformer(options = {}) {
  return new BatchTransformer(options);
}

module.exports = {
  createEmployeeTransformer,
  createBatchTransformer,
  EmployeeTransformer,
  BatchTransformer
}; 