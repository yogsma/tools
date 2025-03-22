/**
 * Logger utility
 * Provides logging functionality with timestamps and color-coding
 */

/**
 * Logger class for formatted console logging
 */
class Logger {
  constructor(options = {}) {
    this.options = {
      level: options.level || 'info',
      timestamp: options.timestamp !== undefined ? options.timestamp : true,
      colors: options.colors !== undefined ? options.colors : true,
      prefix: options.prefix || '',
    };

    // ANSI color codes
    this.colors = {
      reset: '\x1b[0m',
      bright: '\x1b[1m',
      dim: '\x1b[2m',
      underscore: '\x1b[4m',
      blink: '\x1b[5m',
      reverse: '\x1b[7m',
      hidden: '\x1b[8m',
      
      fg: {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
        crimson: '\x1b[38m'
      },
      
      bg: {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m',
        crimson: '\x1b[48m'
      }
    };
    
    // Level priority (higher number = more important)
    this.levels = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3,
      fatal: 4
    };
    
    // Level color mapping
    this.levelColors = {
      debug: this.colors.fg.cyan,
      info: this.colors.fg.green,
      warn: this.colors.fg.yellow,
      error: this.colors.fg.red,
      fatal: `${this.colors.fg.red}${this.colors.bright}`
    };
  }

  /**
   * Format a log message with timestamp and color
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   * @returns {string} - Formatted log message
   */
  _format(level, message) {
    let formatted = '';
    
    // Add timestamp if enabled
    if (this.options.timestamp) {
      const now = new Date();
      const timestamp = now.toISOString();
      formatted += `[${timestamp}] `;
    }
    
    // Add prefix if provided
    if (this.options.prefix) {
      formatted += `[${this.options.prefix}] `;
    }
    
    // Add log level
    formatted += `[${level.toUpperCase()}] `;
    
    // Add message
    formatted += message;
    
    // Add color if enabled
    if (this.options.colors && this.levelColors[level]) {
      formatted = `${this.levelColors[level]}${formatted}${this.colors.reset}`;
    }
    
    return formatted;
  }

  /**
   * Log a message if the level is high enough
   * @private
   * @param {string} level - Log level
   * @param {string} message - Log message
   */
  _log(level, message) {
    // Only log if the level is high enough
    if (this.levels[level] >= this.levels[this.options.level]) {
      const formatted = this._format(level, message);
      
      // Use the appropriate console method
      switch (level) {
        case 'debug':
        case 'info':
          console.log(formatted);
          break;
        case 'warn':
          console.warn(formatted);
          break;
        case 'error':
        case 'fatal':
          console.error(formatted);
          break;
        default:
          console.log(formatted);
      }
    }
  }

  /**
   * Log a debug message
   * @param {string} message - Message to log
   */
  debug(message) {
    this._log('debug', message);
  }

  /**
   * Log an info message
   * @param {string} message - Message to log
   */
  info(message) {
    this._log('info', message);
  }

  /**
   * Log a warning message
   * @param {string} message - Message to log
   */
  warn(message) {
    this._log('warn', message);
  }

  /**
   * Log an error message
   * @param {string} message - Message to log
   */
  error(message) {
    this._log('error', message);
  }

  /**
   * Log a fatal error message
   * @param {string} message - Message to log
   */
  fatal(message) {
    this._log('fatal', message);
  }
}

/**
 * Create a logger instance
 * @param {Object} options - Logger options
 * @returns {Logger} - Logger instance
 */
function createLogger(options = {}) {
  return new Logger(options);
}

module.exports = {
  createLogger,
  Logger
}; 