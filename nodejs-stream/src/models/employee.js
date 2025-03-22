/**
 * Employee model
 * Handles database operations for employee records
 */

const db = require('../config/database');

class Employee {
  /**
   * Initialize the employee table if it doesn't exist
   */
  static async initTable() {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS employees (
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
    `;

    try {
      await db.query(createTableQuery);
      console.log('Employee table initialized');
    } catch (error) {
      console.error('Error initializing employee table:', error);
      throw error;
    }
  }

  /**
   * Insert a single employee record
   * @param {Object} employee - Employee data
   * @returns {Object} - Inserted employee data with ID
   */
  static async insert(employee) {
    const { 
      first_name, 
      last_name, 
      email, 
      department, 
      job_title, 
      hire_date, 
      salary 
    } = employee;

    const query = `
      INSERT INTO employees (
        first_name, last_name, email, department, job_title, hire_date, salary, raw_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING id
    `;

    try {
      const result = await db.query(query, [
        first_name,
        last_name,
        email,
        department || null,
        job_title || null,
        hire_date || null,
        salary || null,
        JSON.stringify(employee)
      ]);

      return { id: result.rows[0].id, ...employee };
    } catch (error) {
      if (error.code === '23505') { // Unique violation error code
        console.error(`Duplicate email found: ${email}`);
        return null;
      }
      throw error;
    }
  }

  /**
   * Insert multiple employee records in a batch
   * @param {Array} employees - Array of employee data objects
   * @returns {Array} - Array of inserted employee IDs
   */
  static async batchInsert(employees) {
    if (!employees.length) return [];

    // Get a client from the pool for transaction
    const client = await db.getClient();
    const insertedIds = [];
    
    try {
      await client.query('BEGIN');
      
      // Prepare batch query
      const values = [];
      const placeholders = [];
      let paramCount = 1;
      
      employees.forEach(employee => {
        const { 
          first_name, 
          last_name, 
          email, 
          department, 
          job_title, 
          hire_date, 
          salary 
        } = employee;
        
        placeholders.push(`($${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++}, $${paramCount++})`);
        
        values.push(
          first_name,
          last_name,
          email,
          department || null,
          job_title || null,
          hire_date || null,
          salary || null,
          JSON.stringify(employee)
        );
      });
      
      const query = `
        INSERT INTO employees (
          first_name, last_name, email, department, job_title, hire_date, salary, raw_data
        ) VALUES ${placeholders.join(', ')}
        RETURNING id
      `;
      
      const result = await client.query(query, values);
      await client.query('COMMIT');
      
      return result.rows.map(row => row.id);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error in batch insert:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get the total count of employee records
   * @returns {Number} - Total count of employees
   */
  static async count() {
    const query = 'SELECT COUNT(*) FROM employees';
    const result = await db.query(query);
    return parseInt(result.rows[0].count, 10);
  }
}

module.exports = Employee; 