# Employee Data Processing System

A Node.js application that efficiently processes large employee data files using streams and stores the validated data in a PostgreSQL database.

## Features

- **Streaming Processing**: Handles files of any size by processing them as streams
- **Memory Optimization**: Uses Node.js streams and backpressure to optimize memory usage
- **Memory Monitoring**: Memory usage tracking with optional visualization
- **Data Validation**: Validates employee records (email, first name, last name)
- **Database Integration**: Stores valid records in PostgreSQL
- **Progress Tracking**: Visual progress bar and detailed statistics
- **Performance Optimization**: Batch processing for database operations
- **Error Handling**: Robust error handling and reporting

## Prerequisites

- Node.js (v14 or higher)
- PostgreSQL database

## Installation

1. Clone the repository:
   ```
   git clone <repository-url>
   cd employee-data-processor
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Run the setup script:
   ```
   npm run setup
   ```
   This will:
   - Create the data directory
   - Set up the PostgreSQL database
   - Generate a small test file
   - Guide you through running your first test

4. Alternatively, you can manually configure:
   - Create a `.env` file with your configuration (see `.env` file in the repository for an example)
   - Set up the database: `npm run setup-db`
   - Generate test data: `npm run generate-small`

## Usage

### Processing a File

To process an employee data file:

```
npm start <file-path>
```

Example:
```
npm start ./data/employees.csv
```

### Using Convenience Scripts

We've provided some convenience scripts:

```
# Generate test data
npm run generate-small    # 1,000 records
npm run generate-medium   # 10,000 records
npm run generate-large    # 100,000 records

# Process test data
npm run process-small
npm run process-medium
npm run process-large
```

### Generating Custom Test Data

To generate test data with custom parameters:

```
npm run generate-data [number-of-records] [percent-invalid] [output-file]
```

Example to generate 10,000 records with 15% invalid records:
```
npm run generate-data 10000 15 ./data/test_employees.csv
```

## Architecture

The application uses a pipeline of Node.js streams for efficient processing:

1. **File Reading**: Reads the input file line by line
2. **Parsing**: Transforms raw data into structured objects
3. **Validation**: Validates each record
4. **Batching**: Groups records for efficient database operations
5. **Database Writing**: Stores valid records in PostgreSQL

## Memory Management

The system includes a memory monitor that:
- Tracks memory usage while processing
- Implements throttling when memory usage exceeds configured thresholds
- Reports detailed memory statistics after processing

By default, the application now uses text-only memory monitoring for maximum compatibility across different terminal environments. 

### Memory Monitoring Options

You can control memory monitoring behavior with environment variables:

- Set `MEMORY_TEXT_MODE_ONLY=true` to force text-only monitoring (this is now the default)
- Set `DISABLE_MEMORY_MONITOR=true` to completely disable memory monitoring if you encounter issues

If you want to try graphical mode (for compatible terminals), you can modify the `textModeOnly` parameter in `src/index.js`.

## Database Structure

The employee records are stored in a `employees` table with the following structure:

```sql
CREATE TABLE employees (
  id SERIAL PRIMARY KEY,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  department VARCHAR(100),
  job_title VARCHAR(100),
  hire_date DATE,
  salary NUMERIC(12, 2),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  raw_data JSONB
)
```

## Performance Tuning

You can tune the performance by adjusting the following environment variables:

- `BATCH_SIZE`: Number of records to process in a batch (default: 100)
- `MAX_MEMORY_USAGE_MB`: Memory threshold for throttling (default: 512)
- `MEMORY_MONITOR_INTERVAL_MS`: Memory monitoring interval (default: 1000)

## Troubleshooting

### Terminal Compatibility Issues

If you experience issues with the terminal display or the application freezing:

1. The application now defaults to text-only mode for memory monitoring to avoid compatibility issues
2. If you still encounter problems, completely disable memory monitoring with `DISABLE_MEMORY_MONITOR=true`
3. You can add this to your `.env` file or run with:
   ```
   DISABLE_MEMORY_MONITOR=true npm start ./data/employees_small.csv
   ```

## License

This project is licensed under the ISC License. 