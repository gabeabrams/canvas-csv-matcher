// Import Pre-processors
const preProcessCSV = require('./preProcess/csv');
const preProcessUsers = require('./preProcess/users');

// Import Search/Matching Functionality
const genSearchFunctions = require('./genSearchFunctions');

// Import helpers
const genPropToCellToUser = require('./helpers/genPropToCellToUser');

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
 * @return {object} the results (see README.md for more info)
 */
module.exports = (opts) => {
  /*------------------------------------------------------------------------*/
  /*                            Pre-process Opts                            */
  /*------------------------------------------------------------------------*/

  const { studentOnlyOnce, teachingTeamMemberOnlyOnce } = opts;
  const { headers, rows } = preProcessCSV(opts.csv);
  const students = preProcessUsers(opts.students);
  const teachingTeamMembers = preProcessUsers(opts.teachingTeamMembers);

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

  const COL_TYPES = {
    DATA: 'data', // just data, no matchable parameters
    STUDENT: 'student', // student information
    TEACHING_TEAM_MEMBER: 'teaching-team-member', // teaching team member
  };
  const colIndexToTypeAndProp = {}; // column index => { type, prop }

  // Helper maps
  const pods = [
    {
      propToCellToUser: genPropToCellToUser(students),
      type: COL_TYPES.STUDENT,
      minToMatch: Math.floor(students.length / 2),
    },
    {
      propToCellToUser: genPropToCellToUser(teachingTeamMembers),
      type: COL_TYPES.TEACHING_TEAM_MEMBER,
      minToMatch: Math.floor(teachingTeamMembers.length / 2),
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
        minToMatch,
      } = pod;

      // Loop through props
      Object.keys(propToCellToUser).forEach((prop) => {
        let numMatching = 0;
        cells.forEach((cell) => {
          if (propToCellToUser[prop][cell.trim().toLowerCase()]) {
            // Found another match
            numMatching += 1;
          }
        });

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

    // If best match doesn't even match to half the rows, this is a data row
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

  // Find average number of students and teachin team members in each row
  let totalNumStudents = 0;
  let totalNumTeachingTeamMembers = 0;
  let numRowsInCount = 0;
  rowMatches.forEach((rowMatch) => {
    const { students, teachingTeamMembers } = rowMatch;

    // Only average for rows that have at least one match
    if (students.length > 0 || teachingTeamMembers.length > 0) {
      totalNumStudents += students.length;
      totalNumTeachingTeamMembers += teachingTeamMembers.length;
      numRowsInCount += 1;
    }
  });
  const avgNumStudentsPerRow = (
    numRowsInCount === 0
      ? -1 // No rows have any matches. Use -1 so all rows are unmatched
      : Math.round(totalNumStudents / numRowsInCount)
  );
  const avgNumTeachingTeamMembersPerRow = (
    numRowsInCount === 0
      ? -1 // No rows have any matches. Use -1 so all rows are unmatched
      : Math.round(totalNumTeachingTeamMembers / numRowsInCount)
  );

  // Determine which students or teaching team members violate the "only once"
  // rule so we can disqualify their rows later
  const isDisqualified = {}; // canvasId => true if user is disqualified
  /**
   * Finds disqualified users (shows up more than once but not allowed to show
   *   up more than once)
   * @param {string} type - the type of users to find and disqualify
   */
  const findDisqualified = (type) => {
    const alreadySeen = {}; // canvasId => true if already seen in our search
    rowMatches.forEach((rowMatch) => {
      // Find relevant list of users for this row
      const { students, teachingTeamMembers } = rowMatch;
      const users = (
        (type === COL_TYPES.STUDENT)
          ? students
          : teachingTeamMembers
      );

      // Mark the list of users as seen. If they were seen before, disqualify
      // them!
      users.forEach((user) => {
        // Handle disqualified user
        if (alreadySeen[user.canvasId]) {
          // Disqualify this user
          isDisqualified[user.canvasId] = true;
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
    const { students, teachingTeamMembers } = rowMatch;

    // Figure out if this row is disqualified (one of its matches is
    // disqualified)
    const disqualified = [students, teachingTeamMembers].some((users) => {
      return users.some((user) => {
        return isDisqualified[user.canvasId];
      });
    });

    // Figure out if this row has the wrong number of people in it
    const wrongNumPeople = (
      students.length !== avgNumStudentsPerRow
      || teachingTeamMembers.length !== avgNumTeachingTeamMembersPerRow
    );

    // Figure out if this row is unmatched
    const isUnmatched = (disqualified || wrongNumPeople);

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
      });
    } else {
      // Handle matched row
      matchedRows.push({
        students,
        teachingTeamMembers,
        rawRow,
        dataColumns,
      });
    }
  });

  // Collect users to exclude
  const usersToExclude = [];
  const findExcluded = (type) => {
    matchedRows.forEach((matchedRow) => {
      // Find relevant list of users for this row
      const { students, teachingTeamMembers } = matchedRow;
      const users = (
        (type === COL_TYPES.STUDENT)
          ? students
          : teachingTeamMembers
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

  // For matched rows, replace simplified users with full user
  const matchedRowsWithFullUsers = matchedRows.map((matchedRow) => {
    const newMatchedRow = matchedRow;

    // Swap for full student object
    const { students, teachingTeamMembers } = newMatchedRow;
    newMatchedRow.students = newMatchedRow.students.map((student) => {
      return idToFullUser[student.canvasId];
    });
    newMatchedRow.teachingTeamMembers = (
      newMatchedRow.teachingTeamMembers.map((student) => {
        return idToFullUser[student.canvasId];
      })
    );

    return newMatchedRow;
  });

  // Create full object to return
  return {
    colTypes,
    dataHeaders,
    unmatchedRows,
    matchedRows: matchedRowsWithFullUsers,
    csv: {
      headers,
      rows,
    },
  };
};
