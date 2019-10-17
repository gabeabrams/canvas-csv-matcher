// Import Pre-processors
const preProcessCSV = require('./preProcess/csv');
const preProcessUsers = require('./preProcess/users');

// Import Search/Matching Functionality
const genSearchFunctions = require('./genSearchFunctions');

// Import helpers
const genPropToCellToUser = require('./helpers/genPropToCellToUser');

// Constants
const ANY_NUMBER = 'any';
const AT_LEAST_ONE = 'at-least-one';
const AUTO_DETECT = 'auto-detect';

const COL_TYPES = {
  DATA: 'data', // just data, no matchable parameters
  STUDENT: 'student', // student information
  TEACHING_TEAM_MEMBER: 'teaching team member', // teaching team member
};

/**
 * Checks if the actual number of users per row matches the expected number
 * @param {string} type - the type of user we are checking for
 * @param {string|number} expected - the expected number of users per row or
 *   ANY_NUMBER if any number is allowed or AT_LEAST_ONE if the number must be
 *   positive
 * @param {number} actual - the actual number of users in the row
 * @return {boolean} true if the actual number matches the expected
 */
const genNumPerRowErrorMessage = (type, expected, actual) => {
  if (expected === ANY_NUMBER) {
    // No error
    return null;
  }
  if (expected === AT_LEAST_ONE) {
    return (
      (actual && actual > 0)
        ? null // No error
        : `There should be at least one ${type} in this row but we couldn't find any.`
    );
  }
  return (
    (expected === actual)
      ? null // No error
      : `There should be ${expected} ${type}${expected === 1 ? '' : 's'} in this row but instead, but we found ${actual} instead.`
  );
};

/**
 * Parse, match, and process a CSV. In each CSV row, a user may only occur once
 * @param {string|object} csv - the contents of the CSV. May be a filename,
 *   string contents of a CSV file with one header row, or a processed csv file
 *   in the form:
 *   { headers: ['Col 1 Header', ...], rows: [['Row 1 Cell 1', ...], ['R2 C2']]}
 * @param {User[]} [students] - a list of Canvas student objects to match
 *   with. Must be included if matching students
 * @param {User[]} [teachingTeamMembers] - a list of Canvas teaching team
 *   members to match with. Must be included if matching teaching team members
 * @param {boolean} [studentOnlyOnce] - if true, each student can only show up
 *   once in each CSV
 * @param {boolean} [teachingTeamMemberOnlyOnce] - if true, each teaching team
 *   member can only show up once in each CSV
 * @param {number|string} [numStudentsPerRow=auto detect] - the number of
 *   students to expect per row, or "any" for any number of students, or
 *   "at-least-one" for at least one student per row, or leave out to auto
 *   detect the number of students per row based on the average number of
 *   students per row
 * @param {number|string} [numTeachingTeamMembersPerRow=auto detect] - the
 *   number of teaching team members to expect per row, or "any" for any number
 *   of teaching team members, or "at-least-one" for at least one
 *   teaching team member per row, or leave out to auto detect the number of
 *   teaching team members per row based on the average number of per row
 * @return {object} the results (see README.md for more info)
 */
module.exports = (opts) => {
  /*------------------------------------------------------------------------*/
  /*                            Pre-process Opts                            */
  /*------------------------------------------------------------------------*/

  const {
    studentOnlyOnce,
    teachingTeamMemberOnlyOnce,
  } = opts;
  const { headers, rows } = preProcessCSV(opts.csv);
  const students = preProcessUsers(opts.students);
  const teachingTeamMembers = preProcessUsers(opts.teachingTeamMembers);
  let numStudentsPerRow = (
    (opts.numStudentsPerRow !== undefined && opts.numStudentsPerRow !== null)
      ? opts.numStudentsPerRow
      : AUTO_DETECT
  );
  let numTeachingTeamMembersPerRow = (
    (
      opts.numTeachingTeamMembersPerRow !== undefined
      && opts.numTeachingTeamMembersPerRow !== null
    )
      ? opts.numTeachingTeamMembersPerRow
      : AUTO_DETECT
  );

  if (
    (
      !students
      || students.length === 0
      || Object.keys(students).length === 0
    )
    && (
      !teachingTeamMembers
      || teachingTeamMembers.length === 0
      || Object.keys(teachingTeamMembers).length === 0
    )
  ) {
    // No users to match with
    throw new Error('No users to match with, or all users included are empty');
  }

  // Create maps
  const idToFullUser = {}; // canvasId => user
  (opts.students || []).forEach((student) => {
    idToFullUser[student.id] = student;
  });
  (opts.teachingTeamMembers || []).forEach((teachingTeamMember) => {
    idToFullUser[teachingTeamMember.id] = teachingTeamMember;
  });

  /*------------------------------------------------------------------------*/
  /*                   Auto-detect Column Types and Prop                    */
  /*------------------------------------------------------------------------*/

  const colIndexToTypeAndProp = {}; // column index => { type, prop }

  // Helper maps
  const pods = [
    {
      propToCellToUser: genPropToCellToUser(students),
      type: COL_TYPES.STUDENT,
    },
    {
      propToCellToUser: genPropToCellToUser(teachingTeamMembers),
      type: COL_TYPES.TEACHING_TEAM_MEMBER,
    },
  ];

  // Loop through each column and detect column type and prop
  for (let colIndex = 0; colIndex < headers.length; colIndex++) {
    // Get all cells in the column
    const cells = rows.map((row) => {
      return row[colIndex];
    });

    // For each type and prop, calculate the number of cells that match
    const typeData = []; // array of { type, prop, numMatching }
    // Loop through types
    pods.forEach((pod) => {
      const {
        propToCellToUser,
        type,
      } = pod;

      // Loop through props
      Object.keys(propToCellToUser).forEach((prop) => {
        let numMatching = 0;
        let numNonempty = 0;
        cells.forEach((cell) => {
          if (propToCellToUser[prop][cell.trim().toLowerCase()]) {
            // Found another match
            numMatching += 1;
          }
          if (cell.trim().length > 0) {
            numNonempty += 1;
          }
        });

        // Calculate the minimum number to match (at least 40%)
        const minToMatch = Math.floor(numNonempty * 0.4);

        // Save the data
        typeData.push({
          type,
          prop,
          minToMatch,
          numMatching,
        });
      });
    });

    // Sort typeData to find the type and prop with the most that match
    typeData.sort((a, b) => {
      if (a.numMatching < b.numMatching) {
        return 1;
      }
      if (a.numMatching > b.numMatching) {
        return -1;
      }
      return 0;
    });

    // If best match doesn't have the min num to match, it is a data row
    const bestMatch = typeData[0];
    if (bestMatch.numMatching < bestMatch.minToMatch) {
      colIndexToTypeAndProp[colIndex] = {
        type: COL_TYPES.DATA,
        prop: null,
      };
    } else {
      // We found a good match! Use type and prop of the best match
      colIndexToTypeAndProp[colIndex] = {
        type: bestMatch.type,
        prop: bestMatch.prop,
      };
    }
  }

  /*------------------------------------------------------------------------*/
  /*                         Create Search Functions                        */
  /*------------------------------------------------------------------------*/

  const searchFunction = {
    [COL_TYPES.STUDENT]: genSearchFunctions(students),
    [COL_TYPES.TEACHING_TEAM_MEMBER]: genSearchFunctions(teachingTeamMembers),
  };

  /*------------------------------------------------------------------------*/
  /*                            Perform Matching                            */
  /*------------------------------------------------------------------------*/

  // Perform matching for each row
  const rowMatches = rows.map((row) => {
    const studentMatches = new Set([]); // set of users
    const teachingTeamMemberMatches = new Set([]); // set of users

    // Go through each column and find matches
    row.forEach((cell, colIndex) => {
      const { type, prop } = colIndexToTypeAndProp[colIndex];

      // Ignore column if it is only a data column
      if (type === COL_TYPES.DATA) {
        return;
      }

      // Get search function
      const { getMatch } = searchFunction[type];

      // Find match
      const match = getMatch(prop, cell);
      if (!match) {
        // No match! Ignore this cell
        return;
      }

      // Add match to the appropriate list
      if (type === COL_TYPES.STUDENT) {
        // student
        studentMatches.add(match);
      } else {
        // teachingTeamMember
        teachingTeamMemberMatches.add(match);
      }
    });

    // Return matches object
    return {
      students: Array.from(studentMatches),
      teachingTeamMembers: Array.from(teachingTeamMemberMatches),
    };
  });

  // Auto-detect the number of people per row (if not included in opts)
  let totalNumStudents = 0;
  let totalNumTeachingTeamMembers = 0;
  let numRowsInCount = 0;
  if (
    numStudentsPerRow === AUTO_DETECT
    || numTeachingTeamMembersPerRow === AUTO_DETECT
  ) {
    rowMatches.forEach((rowMatch) => {
      // Only average for rows that have at least one match
      if (
        rowMatch.students.length > 0
        || rowMatch.teachingTeamMembers.length > 0
      ) {
        totalNumStudents += rowMatch.students.length;
        totalNumTeachingTeamMembers += rowMatch.teachingTeamMembers.length;
        numRowsInCount += 1;
      }
    });
  }
  if (numStudentsPerRow === AUTO_DETECT) {
    numStudentsPerRow = Math.round(totalNumStudents / numRowsInCount);
  }
  if (numTeachingTeamMembersPerRow === AUTO_DETECT) {
    numTeachingTeamMembersPerRow = (
      Math.round(totalNumTeachingTeamMembers / numRowsInCount)
    );
  }

  // Determine which students or teaching team members violate the "only once"
  // rule so we can disqualify their rows later
  const isDisqualified = {}; // canvasId => message for why someone is
  // disqualified if they are disqualified
  /**
   * Finds disqualified users (shows up more than once but not allowed to show
   *   up more than once)
   * @param {string} type - the type of users to find and disqualify
   */
  const findDisqualified = (type) => {
    const alreadySeen = {}; // canvasId => true if already seen in our search
    rowMatches.forEach((rowMatch) => {
      // Find relevant list of users for this row
      const users = (
        (type === COL_TYPES.STUDENT)
          ? rowMatch.students
          : rowMatch.teachingTeamMembers
      );

      // Mark the list of users as seen. If they were seen before, disqualify
      // them!
      users.forEach((user) => {
        // Handle disqualified user
        if (alreadySeen[user.canvasId]) {
          // Disqualify this user
          isDisqualified[user.canvasId] = `Each ${type} can only show up once in your CSV, but ${user.fullName} showed up more than once.`;
        } else {
          // Not yet disqualified. Mark as seen
          alreadySeen[user.canvasId] = true;
        }
      });
    });
  };
  if (studentOnlyOnce) {
    findDisqualified(COL_TYPES.STUDENT);
  }
  if (teachingTeamMemberOnlyOnce) {
    findDisqualified(COL_TYPES.TEACHING_TEAM_MEMBER);
  }

  // Separate rows into matched rows and unmatched rows
  // To be matched, the row must not have disqualified users and must have the
  // usual number of students and teachingTeamMembers in the row
  const matchedRows = [];
  const unmatchedRows = [];
  rowMatches.forEach((rowMatch, i) => {
    // Figure out if this row is disqualified (one of its matches is
    // disqualified)
    const unmatchedErrors = [];
    [
      rowMatch.students,
      rowMatch.teachingTeamMembers,
    ].forEach((users) => {
      return users.forEach((user) => {
        const message = isDisqualified[user.canvasId];
        if (message) {
          unmatchedErrors.push(message);
        }
        return !!message;
      });
    });

    // Figure out if this row has the wrong number of people in it
    const numStudentsPerRowError = genNumPerRowErrorMessage(
      COL_TYPES.STUDENT,
      numStudentsPerRow,
      rowMatch.students.length
    );
    if (numStudentsPerRowError) {
      unmatchedErrors.push(numStudentsPerRowError);
    }
    const numTeachingTeamMembersPerRowError = genNumPerRowErrorMessage(
      COL_TYPES.TEACHING_TEAM_MEMBER,
      numTeachingTeamMembersPerRow,
      rowMatch.teachingTeamMembers.length
    );
    if (numTeachingTeamMembersPerRowError) {
      unmatchedErrors.push(numTeachingTeamMembersPerRowError);
    }

    // Figure out if this row is unmatched
    const isUnmatched = (unmatchedErrors.length > 0);

    // Extract data columns
    const rawRow = rows[i];
    const dataColumns = rawRow.filter((_, colIndex) => {
      const { type } = colIndexToTypeAndProp[colIndex];
      const isDataColumn = (type === COL_TYPES.DATA);
      return isDataColumn;
    });

    // Handle unmatched row
    if (isUnmatched) {
      unmatchedRows.push({
        rawRow,
        dataColumns,
        errors: unmatchedErrors,
        rowIndex: i,
      });
    } else {
      // Handle matched row
      matchedRows.push({
        rawRow,
        dataColumns,
        students: rowMatch.students,
        teachingTeamMembers: rowMatch.teachingTeamMembers,
        rowIndex: i,
      });
    }
  });

  // Collect users to exclude
  const usersToExclude = [];
  const findExcluded = (type) => {
    matchedRows.forEach((matchedRow) => {
      // Find relevant list of users for this row
      const users = (
        (type === COL_TYPES.STUDENT)
          ? matchedRow.students
          : matchedRow.teachingTeamMembers
      );

      // Exclude all users in this row of the relevant type
      users.forEach((user) => {
        usersToExclude.push(user);
      });
    });
  };
  if (studentOnlyOnce) {
    findExcluded(COL_TYPES.STUDENT);
  }
  if (teachingTeamMemberOnlyOnce) {
    findExcluded(COL_TYPES.TEACHING_TEAM_MEMBER);
  }

  // Add potential users based on confidence ratings to unmatched rows
  unmatchedRows.forEach((unmatchedRow, i) => {
    // Extract data from unmatched row
    const { rawRow } = unmatchedRow;

    // Calculate confidence ratings
    const potentialStudents = (
      searchFunction[COL_TYPES.STUDENT].getConfidenceRatings(
        rawRow,
        usersToExclude
      )
    );
    const potentialTeachingTeamMembers = (
      searchFunction[COL_TYPES.TEACHING_TEAM_MEMBER].getConfidenceRatings(
        rawRow,
        usersToExclude
      )
    );

    // Add to unmatched rows
    unmatchedRows[i].potentialStudents = potentialStudents;
    unmatchedRows[i].potentialTeachingTeamMembers = (
      potentialTeachingTeamMembers
    );
  });

  /*------------------------------------------------------------------------*/
  /*                                 Wrap Up                                */
  /*------------------------------------------------------------------------*/

  // Extract the data headers
  const dataHeaders = headers.filter((_, colIndex) => {
    const { type } = colIndexToTypeAndProp[colIndex];
    const isDataColumn = (type === COL_TYPES.DATA);
    return isDataColumn;
  });

  // Create column types
  const colTypes = headers.map((_, colIndex) => {
    const { type, prop } = colIndexToTypeAndProp[colIndex];

    // Create more understandable property name
    const propNameMap = {
      canvasId: 'canvas-id',
      fullName: 'name',
      sortableName: 'sortable-name',
      sisUserId: 'university-id',
      loginId: 'login-id',
      email: 'email',
    };
    const property = propNameMap[prop];

    return {
      type,
      property,
    };
  });

  // For matched rows, replace simplified users with full users
  const matchedRowsWithFullUsers = matchedRows.map((matchedRow) => {
    const newMatchedRow = matchedRow;

    // Swap for full student object
    newMatchedRow.students = newMatchedRow.students.map((student) => {
      return idToFullUser[student.canvasId];
    });
    newMatchedRow.teachingTeamMembers = (
      newMatchedRow.teachingTeamMembers.map((teachingTeamMember) => {
        return idToFullUser[teachingTeamMember.canvasId];
      })
    );

    return newMatchedRow;
  });

  // For unmatched rows, replace simplified users with full users
  const unmatchedRowsWithFullUsers = unmatchedRows.map((unmatchedRow) => {
    const newUnmatchedRow = unmatchedRow;

    // Swap for full student object
    newUnmatchedRow.potentialStudents = (
      newUnmatchedRow.potentialStudents.map((obj) => {
        const newObj = obj;
        newObj.user = idToFullUser[obj.user.canvasId];
        return newObj;
      })
    );
    newUnmatchedRow.potentialTeachingTeamMembers = (
      newUnmatchedRow.potentialTeachingTeamMembers.map((obj) => {
        const newObj = obj;
        newObj.user = idToFullUser[obj.user.canvasId];
        return newObj;
      })
    );

    return newUnmatchedRow;
  });

  // Create full object to return
  return {
    colTypes,
    dataHeaders,
    numStudentsPerRow,
    numTeachingTeamMembersPerRow,
    matchedRows: matchedRowsWithFullUsers,
    unmatchedRows: unmatchedRowsWithFullUsers,
    csv: {
      headers,
      rows,
    },
  };
};
