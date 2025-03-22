/**
 * Setup script
 * Initializes the system and runs a test
 */
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const { promisify } = require('util');

const execPromise = promisify(exec);

async function setup() {
  console.log('=== Setting up Employee Data Processing System ===');
  
  // Ensure data directory exists
  if (!fs.existsSync(path.join(__dirname, 'data'))) {
    console.log('Creating data directory...');
    fs.mkdirSync(path.join(__dirname, 'data'));
  }
  
  try {
    // Try to create the database (will fail silently if it already exists)
    console.log('Setting up PostgreSQL database...');
    await execPromise('npm run setup-db');
    
    // Generate a small test file
    console.log('Generating test data...');
    await execPromise('npm run generate-small');
    
    console.log('\nSystem setup complete!');
    console.log('\nYou can now run the following commands:');
    console.log('  npm run process-small     - Process the small test file (1,000 records)');
    console.log('  npm run generate-medium   - Generate a medium test file (10,000 records)');
    console.log('  npm run generate-large    - Generate a large test file (100,000 records)');
    console.log('\nOr process any file with:');
    console.log('  npm start <file-path>');
    
    // Ask if user wants to run a test
    console.log('\nWould you like to run a test with the small data file? (Y/n)');
    
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    
    process.stdin.on('data', async (data) => {
      const input = data.toString().trim().toLowerCase();
      
      if (input === 'y' || input === 'yes' || input === '') {
        console.log('\nRunning test with small data file...');
        try {
          await execPromise('npm run process-small', { stdio: 'inherit' });
        } catch (err) {
          console.error('Error running test:', err.message);
        }
      } else {
        console.log('Test skipped. You can run it later with: npm run process-small');
      }
      
      process.exit(0);
    });
    
  } catch (err) {
    console.error('Error during setup:', err.message);
    process.exit(1);
  }
}

setup(); 