/**
 * Memory Monitor module
 * Monitors memory usage and provides throttling capabilities
 */

const MemoryGraph = require('../utils/memoryGraph');
const EventEmitter = require('events');

/**
 * Memory Monitor class
 * Monitors memory usage and emits events when thresholds are reached
 */
class MemoryMonitor extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.options = {
      interval: options.interval || parseInt(process.env.MEMORY_MONITOR_INTERVAL_MS || '1000', 10),
      thresholdMB: options.thresholdMB || parseInt(process.env.MAX_MEMORY_USAGE_MB || '512', 10),
      autoThrottle: options.autoThrottle === undefined ? true : options.autoThrottle,
      displayGraph: options.displayGraph === undefined ? true : options.displayGraph,
      graphRefreshInterval: options.graphRefreshInterval || 5000, // How often to refresh the graph
      textModeOnly: options.textModeOnly === undefined ? !!process.env.MEMORY_TEXT_MODE_ONLY : options.textModeOnly
    };
    
    // Create the memory graph with our options
    this.memoryGraph = new MemoryGraph({
      interval: this.options.interval,
      maxDataPoints: 120, // 2 minutes with 1 second interval
      colors: {
        line: 'cyan',
        text: 'white'
      },
      forceTextMode: this.options.textModeOnly
    });
    
    this.running = false;
    this.throttling = false;
    this.displayTimer = null;
    
    // Bind class methods
    this._onMemoryUpdate = this._onMemoryUpdate.bind(this);
  }

  /**
   * Start monitoring memory usage
   */
  start() {
    if (this.running) return;
    
    this.running = true;
    this.memoryGraph.on('memory', this._onMemoryUpdate);
    this.memoryGraph.start();
    
    // If displayGraph is enabled and we're not using graphical mode,
    // we manually refresh the text chart at intervals
    if (this.options.displayGraph && 
        (!process.stdout.isTTY || !this.memoryGraph.usingGraphicalMode)) {
      this.displayTimer = setInterval(() => {
        this.memoryGraph.printChart();
      }, this.options.graphRefreshInterval);
    }
    
    console.log(`Memory monitoring started (threshold: ${this.options.thresholdMB} MB, mode: ${this.options.textModeOnly ? 'text-only' : 'auto'})`);
  }

  /**
   * Stop monitoring memory usage
   */
  stop() {
    if (!this.running) return;
    
    this.running = false;
    this.memoryGraph.removeListener('memory', this._onMemoryUpdate);
    this.memoryGraph.stop();
    
    if (this.displayTimer) {
      clearInterval(this.displayTimer);
      this.displayTimer = null;
    }
    
    // Final memory summary is now handled in memoryGraph.stop()
    
    console.log('Memory monitoring stopped');
  }

  /**
   * Handle memory usage update event
   * @private
   * @param {Object} memoryInfo - Memory usage information
   */
  _onMemoryUpdate(memoryInfo) {
    const currentUsageMB = memoryInfo.heap.used;
    const thresholdMB = this.options.thresholdMB;
    
    // Check if usage is above threshold
    if (currentUsageMB > thresholdMB) {
      if (!this.throttling && this.options.autoThrottle) {
        this.throttling = true;
        this.emit('threshold-exceeded', {
          current: currentUsageMB,
          threshold: thresholdMB,
          action: 'throttle'
        });
      }
    } else if (this.throttling && currentUsageMB < (thresholdMB * 0.8)) {
      // Resume normal operation when usage drops below 80% of threshold
      this.throttling = false;
      this.emit('threshold-restored', {
        current: currentUsageMB,
        threshold: thresholdMB,
        action: 'resume'
      });
    }
    
    // Emit regular memory update event
    this.emit('memory-update', memoryInfo);
  }

  /**
   * Check if the system is currently throttling
   * @returns {boolean} - Whether the system is throttling
   */
  isThrottling() {
    return this.throttling;
  }

  /**
   * Get memory usage statistics
   * @returns {Object} - Memory usage statistics
   */
  getStats() {
    return this.memoryGraph.getStats();
  }

  /**
   * Generate memory usage chart
   * @returns {string} - ASCII chart of memory usage
   */
  generateChart() {
    return this.memoryGraph.generateChart();
  }
}

/**
 * Create a memory monitor
 * @param {Object} options - Memory monitor options
 * @returns {MemoryMonitor} - Memory monitor instance
 */
function createMemoryMonitor(options = {}) {
  return new MemoryMonitor(options);
}

module.exports = {
  createMemoryMonitor,
  MemoryMonitor
}; 