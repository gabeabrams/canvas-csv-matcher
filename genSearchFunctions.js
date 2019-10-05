const genPropToCellToUser = require('./helpers/genPropToCellToUser');

/**
 * Creates getMatch and getConfidenceRatings functions based on the set of users
 * @param {user[]} users - a list of users
 * @return {object} a function set in the form
 *   { getMatch, getConfidenceRatings }, see below for function descriptions
 */
module.exports = (users) => {
  // Get propToCellToUser
  const propToCellToUser = genPropToCellToUser(users);

  // Create bag of words for each user
  const idToBagOfWords = {}; // canvasId => list of words
  users.forEach((user) => {
    // Create bag of words for this user
    const bagOfWords = new Set([]);
    Object.values(user).forEach((cell) => {
      const words = (
        String(cell)
          .toLowerCase()
          .trim()
          .split(' ')
      );
      words.forEach((word) => {
        // Skip empty words
        if (word.length === 0) {
          return;
        }
        bagOfWords.add(word);
      });
    });
    idToBagOfWords[user.canvasId] = bagOfWords;
  });

  // Return functions
  return {
    /**
     * Given a cell and user prop, returns the user that matches best
     * @param {string} prop - the name of the property in the users to search
     * @param {string} cell - the CSV cell
     * @return {object|null} the matching user or null if no match found or
     *   more than one match found
     */
    getMatch: (prop, cell) => {
      // Use propToCellToUser to look up
      if (!propToCellToUser[prop] || !propToCellToUser[prop][cell]) {
        return null;
      }

      return propToCellToUser[prop][cell];
    },

    /**
     * Given a CSV row, calculates the confidence rating against each user
     *   (0 to 100) where 0 is no confidence, 100 is very high confidence
     * @param {string[]} row - a CSV row
     * @param {user[]} [usersToExclude=[]] - a list of users to exclude from the
     *   calculation
     * @return {object[]} confidence rating array of form { confidence, user }
     */
    getConfidenceRatings: (row, usersToExclude = []) => {
      // Confidence rating = percent of words in the bag of words that are also
      // in the row

      // Create map of who is excluded
      const userIsExcluded = {}; // canvasId => true if user is excluded
      usersToExclude.forEach((user) => {
        userIsExcluded[user.canvasId || user.id] = true;
      });

      // Create a bag of words from the row
      const wordInRow = {}; // word => true if the word is in the row
      row.forEach((cell) => {
        const words = (
          cell
            .trim()
            .toLowerCase()
            .split(' ')
        );
        words.forEach((word) => {
          // Skip empty words
          if (word.length === 0) {
            return;
          }

          wordInRow[word] = true;
        });
      });

      // Generate confidence values
      const usersToInclude = users.filter((user) => {
        return !userIsExcluded[user.canvasId];
      });
      const confidenceRatings = usersToInclude.map((user) => {
        const bagOfWords = idToBagOfWords[user.canvasId];

        // Calculate confidence value
        let numMatching = 0;
        bagOfWords.forEach((word) => {
          if (wordInRow[word]) {
            numMatching += 1;
          }
        });
        const confidence = Math.round((numMatching / bagOfWords.size) * 100);

        return {
          user,
          confidence,
        };
      });

      // Sort confidence ratings from highest to lowest confidence
      confidenceRatings.sort((a, b) => {
        if (a.confidence < b.confidence) {
          return 1;
        }
        if (a.confidence > b.confidence) {
          return -1;
        }
        return 0;
      });

      return confidenceRatings;
    },
  };
};
