/**
 * Test Data Generator
 * Generates a CSV file with sample employee data for testing
 */

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../src/utils/logger');

// Create a logger
const logger = createLogger({
  level: 'info',
  prefix: 'Data Generator'
});

// Possible values for random data generation
const firstNames = [
  'John', 'Jane', 'Michael', 'Emily', 'David', 'Sarah', 'Robert', 'Lisa',
  'William', 'Elizabeth', 'James', 'Mary', 'Joseph', 'Patricia', 'Thomas',
  'Jennifer', 'Charles', 'Linda', 'Daniel', 'Barbara', 'Matthew', 'Susan',
  'Anthony', 'Jessica', 'Mark', 'Sandra', 'Donald', 'Ashley', 'Steven', 'Kimberly'
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Jones', 'Brown', 'Davis', 'Miller', 'Wilson',
  'Moore', 'Taylor', 'Anderson', 'Thomas', 'Jackson', 'White', 'Harris', 'Martin',
  'Thompson', 'Garcia', 'Martinez', 'Robinson', 'Clark', 'Rodriguez', 'Lewis', 'Lee',
  'Walker', 'Hall', 'Allen', 'Young', 'Hernandez', 'King', 'Wright', 'Lopez'
];

const departments = [
  'Engineering', 'Sales', 'Marketing', 'Finance', 'Human Resources',
  'Product', 'Customer Support', 'Operations', 'Legal', 'Research'
];

const jobTitles = {
  'Engineering': ['Software Engineer', 'DevOps Engineer', 'QA Engineer', 'Engineering Manager', 'CTO'],
  'Sales': ['Sales Representative', 'Account Executive', 'Sales Manager', 'VP of Sales'],
  'Marketing': ['Marketing Specialist', 'Content Writer', 'Social Media Manager', 'CMO'],
  'Finance': ['Accountant', 'Financial Analyst', 'Controller', 'CFO'],
  'Human Resources': ['HR Specialist', 'Recruiter', 'HR Manager', 'VP of HR'],
  'Product': ['Product Manager', 'Product Designer', 'VP of Product'],
  'Customer Support': ['Support Specialist', 'Support Manager', 'Customer Success Manager'],
  'Operations': ['Operations Specialist', 'Operations Manager', 'COO'],
  'Legal': ['Legal Counsel', 'Paralegal', 'Legal Manager', 'General Counsel'],
  'Research': ['Research Scientist', 'Data Analyst', 'Research Director']
};

/**
 * Generate a random date within a range
 * @param {Date} start - Start date
 * @param {Date} end - End date
 * @returns {Date} - Random date within the range
 */
function randomDate(start, end) {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}

/**
 * Generate a random integer within a range
 * @param {number} min - Minimum value (inclusive)
 * @param {number} max - Maximum value (inclusive)
 * @returns {number} - Random integer
 */
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Generate a random employee record
 * @param {boolean} valid - Whether to generate a valid record (for testing validation)
 * @returns {Object} - Employee data object
 */
function generateEmployee(valid = true) {
  // Generate basic info
  const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
  const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
  
  // Randomly decide to make this record invalid for testing validation
  const makeInvalid = !valid && Math.random() < 0.7;
  
  // Generate department and job
  const department = departments[Math.floor(Math.random() * departments.length)];
  const possibleTitles = jobTitles[department];
  const jobTitle = possibleTitles[Math.floor(Math.random() * possibleTitles.length)];
  
  // Generate hire date (within last 10 years)
  const now = new Date();
  const tenYearsAgo = new Date(now.getFullYear() - 10, now.getMonth(), now.getDate());
  const hireDate = randomDate(tenYearsAgo, now).toISOString().split('T')[0];
  
  // Generate salary based on job title (higher index = higher position = higher salary)
  const titleIndex = possibleTitles.indexOf(jobTitle);
  const baseSalary = 50000;
  const salaryMultiplier = 1 + (titleIndex / possibleTitles.length);
  const salary = Math.round(baseSalary * salaryMultiplier * (0.9 + Math.random() * 0.2));
  
  // Create employee object
  const employee = {
    first_name: makeInvalid && Math.random() < 0.3 ? '' : firstName,
    last_name: makeInvalid && Math.random() < 0.3 ? '' : lastName,
    email: makeInvalid && Math.random() < 0.4 ? 
      `${firstName.toLowerCase()}${lastName.toLowerCase()}` : 
      `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`,
    department,
    job_title: jobTitle,
    hire_date: hireDate,
    salary
  };
  
  return employee;
}

/**
 * Generate a CSV file with random employee data
 * @param {string} filePath - Path to save the CSV file
 * @param {number} numRecords - Number of records to generate
 * @param {number} invalidPercent - Percentage of invalid records (0-100)
 */
function generateCSV(filePath, numRecords, invalidPercent = 10) {
  logger.info(`Generating CSV with ${numRecords} records (${invalidPercent}% invalid)...`);
  
  // Ensure directory exists
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  // Create write stream
  const writeStream = fs.createWriteStream(filePath);
  
  // Write header
  writeStream.write('first_name,last_name,email,department,job_title,hire_date,salary\n');
  
  // Generate and write records
  for (let i = 0; i < numRecords; i++) {
    const makeInvalid = Math.random() * 100 < invalidPercent;
    const employee = generateEmployee(!makeInvalid);
    
    // Convert to CSV row
    const row = [
      employee.first_name,
      employee.last_name,
      employee.email,
      employee.department,
      employee.job_title,
      employee.hire_date,
      employee.salary
    ].map(value => `"${value}"`).join(',');
    
    writeStream.write(`${row}\n`);
    
    // Log progress for large files
    if (numRecords >= 10000 && i % 10000 === 0) {
      logger.info(`Generated ${i} records...`);
    }
  }
  
  // Close stream
  writeStream.end();
  logger.info(`Generated ${numRecords} records and saved to ${filePath}`);
}

/**
 * Main function
 */
function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  const numRecords = parseInt(args[0], 10) || 1000;
  const invalidPercent = parseInt(args[1], 10) || 10;
  const filePath = args[2] || path.join(__dirname, '..', 'data', `employees_${numRecords}.csv`);
  
  // Generate CSV file
  generateCSV(filePath, numRecords, invalidPercent);
}

// Run if executed directly
if (require.main === module) {
  main();
}

module.exports = {
  generateCSV,
  generateEmployee
}; 