const fs = require('fs');
const Papa = require('papaparse');

/**
 * Pre-processes the CSV
 * @param {string|object} csv - the contents of the CSV. May be a filename,
 *   string contents of a CSV file with one header row, or a processed csv file
 *   in the form:
 *   { headers: ['Col 1 Header', ...], rows: [['Row 1 Cell 1', ...], ['R2 C2']]}
 * @return {object} a processed csv file (see description above)
 */
module.exports = (oldCSV) => {
  let csv = oldCSV;

  // Extract original CSV value
  if (!csv) {
    throw new Error('No CSV included');
  }

  // Check if we need to pre-process
  if (typeof csv === 'string') {
    // Yes, we need to pre-process

    // Check for file reading
    if (
      !csv.includes(',')
      && !csv.includes('\n')
      && (
        csv
          .trim()
          .toLowerCase()
          .endsWith('.csv')
      )
    ) {
      // CSV must be a filename
      const filename = csv;

      // Read the file
      csv = fs.readFileSync(filename, 'utf-8');
    }

    // Parse the file
    const { data, errors } = Papa.parse(csv, {
      header: false,
      delimiter: ',',
    });

    // Detect CSV parsing errors
    if (errors && errors.length > 0) {
      throw new Error(`An error occurred while parsing the CSV: ${JSON.stringify(errors)}`);
    }

    // Detect empty CSV
    if (!data || data.length === 0 || data[0].length === 0) {
      throw new Error('We cannot process an empty CSV');
    }

    // Separate out header
    const headers = data.shift();
    const rows = data;
    csv = { headers, rows };
  }

  // Invalid object
  if (!csv || !csv.rows || !csv.headers) {
    throw new Error('CSV is in the wrong format. Must be { rows, headers}');
  }

  // Remove empty rows
  csv.rows = csv.rows.filter((row) => {
    // Skip empty or falsy rows
    if (!row || row.length === 0) {
      return false;
    }

    // Only keep this row if at least one cell is not empty
    return row.some((cell) => {
      return (cell.trim().length > 0);
    });
  });

  // Remove rows that are the wrong length
  csv.rows = csv.rows.filter((row) => {
    return (row.length === csv.headers.length);
  });

  return csv;
};
