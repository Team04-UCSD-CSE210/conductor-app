import { parse } from 'csv-parse/sync';
import { stringify } from 'csv-stringify/sync';
import { UserModel } from '../models/user-model.js';

/**
 * RosterService handles bulk import and export operations for user rosters
 * Supports CSV and JSON formats for efficient roster management
 */
export class RosterService {
  /**
   * Maximum number of users to retrieve in a single export operation
   * Set to accommodate large-scale courses (10,000+ students)
   */
  static MAX_EXPORT_LIMIT = 10000;

  /**
   * Maximum file size in bytes (10MB)
   */
  static MAX_FILE_SIZE = 10 * 1024 * 1024;

  /**
   * Progress callback type for tracking import progress
   * @callback ProgressCallback
   * @param {Object} progress - Progress information
   * @param {number} progress.processed - Number of records processed
   * @param {number} progress.total - Total number of records
   * @param {number} progress.imported - Number successfully imported
   * @param {number} progress.failed - Number failed
   */

  /**
   * Default CSV column mappings for flexible import
   * Supports common variations in CSV file headers
   */
  static CSV_COLUMN_MAPPINGS = {
    name: ['name', 'Name', 'full_name', 'Full Name', 'student_name'],
    email: ['email', 'Email', 'e_mail', 'E-Mail', 'student_email'],
    role: ['role', 'Role', 'user_role', 'User Role'],
    status: ['status', 'Status', 'user_status', 'User Status'],
  };

  /**
   * Retrieves all users from the database for export operations
   * @returns {Promise<Array>} Array of user objects
   */
  static async retrieveAllUsers() {
    const users = await UserModel.findAll(RosterService.MAX_EXPORT_LIMIT, 0);
    return users;
  }

  /**
   * Maps CSV record to standardized user data structure
   * Handles case-insensitive column matching and defaults
   * @param {Object} csvRecord - Raw CSV record object
   * @returns {Object} Normalized user data object
   */
  static normalizeCsvRecord(csvRecord) {
    const findColumnValue = (keyVariations) => {
      for (const key of keyVariations) {
        if (csvRecord[key] !== undefined && csvRecord[key] !== null && csvRecord[key] !== '') {
          return String(csvRecord[key]).trim();
        }
      }
      return null;
    };

    return {
      name: findColumnValue(RosterService.CSV_COLUMN_MAPPINGS.name) || '',
      email: findColumnValue(RosterService.CSV_COLUMN_MAPPINGS.email) || '',
      role: findColumnValue(RosterService.CSV_COLUMN_MAPPINGS.role) || 'user',
      status: findColumnValue(RosterService.CSV_COLUMN_MAPPINGS.status) || 'active',
    };
  }

  /**
   * Flattens nested JSON structures to extract user data
   * Handles various nested formats like {user: {name, email}} or {data: [{...}]}
   * @param {*} data - Potentially nested data structure
   * @returns {Array} Flattened array of user objects
   */
  static flattenNestedJson(data) {
    if (Array.isArray(data)) {
      return data;
    }

    if (typeof data === 'object' && data !== null) {
      // Check for common nested structures
      if (data.users && Array.isArray(data.users)) {
        return data.users;
      }
      if (data.data && Array.isArray(data.data)) {
        return data.data;
      }
      if (data.items && Array.isArray(data.items)) {
        return data.items;
      }
      if (data.roster && Array.isArray(data.roster)) {
        return data.roster;
      }
      // If it's a single object, wrap it in an array
      if (data.name || data.email) {
        return [data];
      }
      // Try to find any array property
      for (const key in data) {
        if (Array.isArray(data[key])) {
          return data[key];
        }
      }
    }

    throw new Error('Invalid JSON structure: expected array or object with array property');
  }

  /**
   * Validates user data before import
   * @param {Object} userData - User data to validate
   * @throws {Error} If validation fails
   */
  static validateUserData(userData) {
    if (!userData.name || userData.name.trim().length < 2) {
      throw new Error('Name must be at least 2 characters long');
    }
    if (!userData.email || !userData.email.includes('@')) {
      throw new Error('Valid email address is required');
    }
  }

  /**
   * Processes a single user import with error handling
   * @param {Object} userData - User data to import
   * @returns {Object} Result object with user info or error
   */
  static async processUserImport(userData) {
    try {
      RosterService.validateUserData(userData);
      const user = await UserModel.create(userData);
      return {
        success: true,
        user: { id: user.id, email: user.email, name: user.name },
      };
    } catch (error) {
      return {
        success: false,
        email: userData.email || 'unknown',
        error: error.message,
      };
    }
  }

  /**
   * Imports users from a JSON array or nested structure
   * @param {Array<Object>|Object} userData - Array of user objects or nested structure
   * @param {ProgressCallback} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Import results with success/error breakdown
   */
  static async importRosterFromJson(userData, progressCallback = null) {
    // Handle nested structures
    const userArray = RosterService.flattenNestedJson(userData);

    if (userArray.length === 0) {
      throw new Error('User data cannot be empty');
    }

    const results = {
      imported: [],
      failed: [],
      total: userArray.length,
      importedIds: [], // Track IDs for rollback
    };

    for (let i = 0; i < userArray.length; i++) {
      const userDataItem = userArray[i];
      const result = await RosterService.processUserImport(userDataItem);
      
      if (result.success) {
        results.imported.push(result.user);
        results.importedIds.push(result.user.id);
      } else {
        results.failed.push({
          email: result.email,
          error: result.error,
        });
      }

      // Progress callback
      if (progressCallback) {
        progressCallback({
          processed: i + 1,
          total: userArray.length,
          imported: results.imported.length,
          failed: results.failed.length,
        });
      }
    }

    return results;
  }

  /**
   * Parses CSV text into structured records
   * @param {string} csvText - Raw CSV text content
   * @returns {Array<Object>} Parsed CSV records
   * @throws {Error} If CSV parsing fails
   */
  static parseCsvText(csvText) {
    if (typeof csvText !== 'string') {
      throw new Error('CSV content must be a non-empty string');
    }

    if (!csvText || csvText.trim().length === 0) {
      throw new Error('CSV content cannot be empty');
    }

    try {
      const records = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        cast: false, // Keep as strings for validation
      });

      if (records.length === 0) {
        throw new Error('CSV file contains no valid data rows');
      }

      return records;
    } catch (error) {
      throw new Error(`CSV parsing failed: ${error.message}`);
    }
  }

  /**
   * Rolls back imported users by deleting them
   * @param {Array<string>} userIds - Array of user IDs to delete
   * @returns {Promise<Object>} Rollback results
   */
  static async rollbackImport(userIds) {
    const results = {
      rolledBack: [],
      failed: [],
      total: userIds.length,
    };

    for (const id of userIds) {
      try {
        const deleted = await UserModel.delete(id);
        if (deleted) {
          results.rolledBack.push(id);
        } else {
          results.failed.push({ id, error: 'User not found or already deleted' });
        }
      } catch (error) {
        results.failed.push({ id, error: error.message });
      }
    }

    return results;
  }

  /**
   * Imports users from CSV text
   * @param {string} csvText - CSV content as string
   * @param {ProgressCallback} progressCallback - Optional callback for progress updates
   * @returns {Promise<Object>} Import results with success/error breakdown
   */
  static async importRosterFromCsv(csvText, progressCallback = null) {
    // Validate input first - these should throw
    if (typeof csvText !== 'string') {
      throw new Error('CSV content must be a non-empty string');
    }

    if (!csvText || csvText.trim().length === 0) {
      throw new Error('CSV content cannot be empty');
    }

    // Parse CSV - handle parsing errors gracefully
    let records;
    try {
      records = RosterService.parseCsvText(csvText);
    } catch (error) {
      // Only catch actual CSV parsing errors (malformed CSV), not validation errors
      // Validation errors (empty, no data rows) should throw
      // Parsing errors (quote not closed, etc.) should be handled gracefully
      if (error.message.includes('CSV parsing failed') && 
          !error.message.includes('no valid data rows')) {
        // Handle malformed CSV gracefully (e.g., unclosed quotes)
        return {
          imported: [],
          failed: [{ email: 'unknown', error: error.message }],
          total: 0,
        };
      }
      // Re-throw validation errors (empty, no data rows, etc.)
      throw error;
    }

    const results = {
      imported: [],
      failed: [],
      total: records.length,
      importedIds: [], // Track IDs for rollback
    };

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      const normalizedData = RosterService.normalizeCsvRecord(record);
      const result = await RosterService.processUserImport(normalizedData);
      
      if (result.success) {
        results.imported.push(result.user);
        results.importedIds.push(result.user.id);
      } else {
        results.failed.push({
          email: normalizedData.email || record.email || 'unknown',
          error: result.error,
        });
      }

      // Progress callback
      if (progressCallback) {
        progressCallback({
          processed: i + 1,
          total: records.length,
          imported: results.imported.length,
          failed: results.failed.length,
        });
      }
    }

    return results;
  }

  /**
   * Exports all users as JSON array
   * @returns {Promise<Array>} Array of user objects
   */
  static async exportRosterToJson() {
    const users = await RosterService.retrieveAllUsers();
    return users;
  }

  /**
   * Exports all users as CSV string
   * @returns {Promise<string>} CSV formatted string with headers
   */
  static async exportRosterToCsv() {
    const users = await RosterService.retrieveAllUsers();

    if (users.length === 0) {
      return 'name,email,role,status,created_at,updated_at\n';
    }

    const csvRows = users.map((user) => ({
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      created_at: user.created_at,
      updated_at: user.updated_at,
    }));

    return stringify(csvRows, {
      header: true,
      columns: ['name', 'email', 'role', 'status', 'created_at', 'updated_at'],
    });
  }
}

