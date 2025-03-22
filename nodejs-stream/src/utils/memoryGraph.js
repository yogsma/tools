/**
 * Memory Graph Utility
 * Provides functions to track and visualize memory usage
 */

const blessed = require('blessed');
const contrib = require('blessed-contrib');
const EventEmitter = require('events');

class MemoryGraph extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      interval: options.interval || parseInt(process.env.MEMORY_MONITOR_INTERVAL_MS || '1000', 10),
      maxDataPoints: options.maxDataPoints || 60,
      height: options.height || 10,
      colors: options.colors || {
        line: 'cyan',
        text: 'green'
      },
      forceTextMode: options.forceTextMode || false
    };

    this.memoryData = {
      heapUsed: [],
      heapTotal: [],
      rss: [],
      external: []
    };
    
    this.running = false;
    this.timer = null;
    this.startTime = null;
    this.maxMemoryUsed = 0;
    
    // Flag to indicate if we're running in a terminal environment
    this.isTerminalAvailable = process.stdout.isTTY;
    
    console.log(`Initializing memory graph (terminal available: ${this.isTerminalAvailable}, force text mode: ${this.options.forceTextMode})`);
    
    // Create screen and line chart if running in terminal and not forcing text mode
    if (this.isTerminalAvailable && !this.options.forceTextMode) {
      try {
        console.log('Attempting to create blessed screen...');
        // Use safer terminal options
        this.screen = blessed.screen({
          smartCSR: true,
          title: 'Memory Usage Monitor',
          // Force using more compatible terminal type
          terminal: 'xterm',
          // Disable features that might cause compatibility issues
          useBCE: true,
          fullUnicode: false,
          // Error handling
          handleUncaughtExceptions: true,
          debug: false,
          // Use simpler colors
          dockBorders: true,
          ignoreLocked: ['C-c']
        });
        
        console.log('Creating line chart...');
        // Use simpler line chart settings
        this.lineChart = contrib.line({
          label: 'Memory Usage (MB)',
          style: {
            line: this.options.colors.line,
            text: this.options.colors.text,
            baseline: 'white'
          },
          xLabelPadding: 3,
          xPadding: 5,
          showLegend: true,
          legend: { width: 20 },
          wholeNumbersOnly: true  // Use whole numbers for a more compatible display
        });
        
        this.screen.append(this.lineChart);
        
        // Exit on Escape, q, or Ctrl+C
        this.screen.key(['escape', 'q', 'C-c'], () => {
          this.stop();
          process.exit(0);
        });
        
        console.log('Successfully initialized graphical mode');
        this.usingGraphicalMode = true;
        
        // Set up a non-blocking refresh interval
        this.refreshTimer = setInterval(() => {
          try {
            if (this.running && this.memoryData.heapUsed.length > 0) {
              this._updateChart();
            }
          } catch (err) {
            console.error('Error refreshing chart:', err.message);
          }
        }, 1000);
        
      } catch (err) {
        // If there's an error with blessed, fall back to text mode
        console.error(`Warning: Could not initialize graphical chart, falling back to text mode: ${err.message}`);
        if (err.stack) console.error(err.stack);
        this.usingGraphicalMode = false;
      }
    } else {
      console.log('Terminal not available or text mode forced, using text mode');
      this.usingGraphicalMode = false;
    }
  }

  /**
   * Start memory monitoring
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.startTime = Date.now();
    this.maxMemoryUsed = 0;
    
    this.timer = setInterval(() => {
      this._captureMemoryUsage();
    }, this.options.interval);
    
    console.log('Memory monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  stop() {
    if (!this.running) return;
    
    clearInterval(this.timer);
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    this.running = false;
    this.emit('stopped');
    
    // If we created a blessed screen, destroy it
    if (this.isTerminalAvailable && this.usingGraphicalMode && this.screen) {
      try {
        this.screen.destroy();
      } catch (err) {
        // Ignore any errors during cleanup
        console.error('Warning: Error cleaning up screen:', err.message);
      }
    }
    
    // Always show a final text summary
    console.log(this.generateChart());
    
    console.log('Memory monitoring stopped');
  }

  /**
   * Capture current memory usage
   * @private
   */
  _captureMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    const heapUsedMB = this._bytesToMB(memoryUsage.heapUsed);
    
    // Keep track of maximum heap usage
    if (heapUsedMB > this.maxMemoryUsed) {
      this.maxMemoryUsed = heapUsedMB;
    }
    
    // Update memory data collections
    this._updateDataCollection('heapUsed', heapUsedMB);
    this._updateDataCollection('heapTotal', this._bytesToMB(memoryUsage.heapTotal));
    this._updateDataCollection('rss', this._bytesToMB(memoryUsage.rss));
    this._updateDataCollection('external', this._bytesToMB(memoryUsage.external));
    
    // We no longer update the chart here to avoid blocking - chart updates happen in the refresh timer
    
    // Emit the current memory usage
    this.emit('memory', {
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      heap: {
        used: heapUsedMB,
        total: this._bytesToMB(memoryUsage.heapTotal)
      },
      rss: this._bytesToMB(memoryUsage.rss),
      external: this._bytesToMB(memoryUsage.external)
    });
  }

  /**
   * Update a specific data collection, keeping the max number of data points
   * @private
   * @param {string} key - The collection key
   * @param {number} value - The value to add
   */
  _updateDataCollection(key, value) {
    this.memoryData[key].push(value);
    
    // Keep only the most recent data points
    if (this.memoryData[key].length > this.options.maxDataPoints) {
      this.memoryData[key].shift();
    }
  }

  /**
   * Convert bytes to megabytes
   * @private
   * @param {number} bytes - Bytes to convert
   * @returns {number} - Value in megabytes (rounded to 2 decimal places)
   */
  _bytesToMB(bytes) {
    return Math.round((bytes / 1024 / 1024) * 100) / 100;
  }

  /**
   * Update the blessed-contrib chart
   * @private
   */
  _updateChart() {
    if (!this.lineChart || this.memoryData.heapUsed.length === 0) return;
    
    // Generate x-axis labels (timestamps) - use fewer labels for compatibility
    const xLabels = [];
    const step = Math.max(1, Math.floor(this.memoryData.heapUsed.length / 10));
    for (let i = 0; i < this.memoryData.heapUsed.length; i += step) {
      xLabels.push((i * this.options.interval / 1000).toFixed(0) + 's');
    }
    
    // To avoid any potential errors, ensure we have valid data
    const validHeapUsed = this.memoryData.heapUsed.map(val => isNaN(val) ? 0 : val);
    const validHeapTotal = this.memoryData.heapTotal.map(val => isNaN(val) ? 0 : val);
    const validRSS = this.memoryData.rss.map(val => isNaN(val) ? 0 : val);
    
    // Data series for the line chart - using simple colors for compatibility
    const series = [
      {
        title: 'Heap Used',
        x: xLabels,
        y: validHeapUsed.filter((_, i) => i % step === 0),  // Only show points matching our step
        style: {
          line: 'red'
        }
      },
      {
        title: 'Heap Total',
        x: xLabels,
        y: validHeapTotal.filter((_, i) => i % step === 0),
        style: {
          line: 'yellow'
        }
      },
      {
        title: 'RSS',
        x: xLabels,
        y: validRSS.filter((_, i) => i % step === 0),
        style: {
          line: 'green'
        }
      }
    ];
    
    // Update the chart safely
    try {
      this.lineChart.setData(series);
      this.screen.render();
    } catch (err) {
      // Log error but don't crash
      console.error('Chart update error:', err.message);
    }
  }

  /**
   * Generate text-based representation of memory usage for non-terminal environments
   * @returns {string} - Text representation of memory usage
   */
  generateChart() {
    if (this.memoryData.heapUsed.length === 0) {
      return 'No memory data collected yet';
    }
    
    // Generate a simple text-based chart for non-terminal environments
    let chart = '\nMemory Usage Summary:\n\n';
    
    // Add current values
    const current = this.memoryData.heapUsed[this.memoryData.heapUsed.length - 1];
    const total = this.memoryData.heapTotal[this.memoryData.heapTotal.length - 1];
    const rss = this.memoryData.rss[this.memoryData.rss.length - 1];
    
    chart += `Current Heap: ${current.toFixed(2)} MB\n`;
    chart += `Max Heap: ${this.maxMemoryUsed.toFixed(2)} MB\n`;
    chart += `Total Heap: ${total.toFixed(2)} MB\n`;
    chart += `RSS: ${rss.toFixed(2)} MB\n\n`;
    
    // Add a simple bar for heap usage - using basic characters for compatibility
    const usagePercentage = (current / total) * 100;
    const barLength = 50;
    const filledLength = Math.round((usagePercentage / 100) * barLength);
    // Use simpler characters for better terminal compatibility
    const bar = '='.repeat(filledLength) + ' '.repeat(barLength - filledLength);
    
    chart += `Heap Usage: ${usagePercentage.toFixed(2)}% [${bar}]\n`;
    
    return chart;
  }

  /**
   * Print the memory usage chart to console
   */
  printChart() {
    if (!this.isTerminalAvailable || !this.usingGraphicalMode) {
      // For non-terminal environments or when graphical mode failed,
      // just log the text-based chart
      console.clear();
      console.log(this.generateChart());
    }
    // For terminal environments with graphical mode, chart is updated by _updateChart
  }

  /**
   * Get memory usage statistics
   * @returns {Object} - Memory usage statistics
   */
  getStats() {
    if (this.memoryData.heapUsed.length === 0) {
      return {
        current: 0,
        max: 0,
        average: 0
      };
    }
    
    const current = this.memoryData.heapUsed[this.memoryData.heapUsed.length - 1];
    const sum = this.memoryData.heapUsed.reduce((acc, val) => acc + val, 0);
    const average = sum / this.memoryData.heapUsed.length;
    
    return {
      current,
      max: this.maxMemoryUsed,
      average
    };
  }
}

module.exports = MemoryGraph; 