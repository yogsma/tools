/**
 * Validator utility
 * Validates employee data fields
 */

/**
 * Validates email format
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether the email is valid
 */
function isValidEmail(email) {
  if (!email) return false;
  
  // Simple email validation regex
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validates employee data
 * @param {Object} employee - Employee data to validate
 * @returns {Object} - Validation result with isValid flag and error messages
 */
function validateEmployee(employee) {
  const errors = [];

  // Check if employee is an object
  if (!employee || typeof employee !== 'object') {
    return { 
      isValid: false, 
      errors: ['Invalid employee data format'] 
    };
  }

  // Required fields validation
  if (!employee.first_name || employee.first_name.trim() === '') {
    errors.push('First name is required');
  }

  if (!employee.last_name || employee.last_name.trim() === '') {
    errors.push('Last name is required');
  }

  if (!employee.email) {
    errors.push('Email is required');
  } else if (!isValidEmail(employee.email)) {
    errors.push('Email format is invalid');
  }

  // Optional field validations
  if (employee.hire_date && isNaN(Date.parse(employee.hire_date))) {
    errors.push('Hire date is invalid');
  }

  if (employee.salary && (isNaN(parseFloat(employee.salary)) || parseFloat(employee.salary) < 0)) {
    errors.push('Salary must be a positive number');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = {
  validateEmployee,
  isValidEmail
}; 