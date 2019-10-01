/**
 * Given a set of users, creates a map to look up which user matches a prop
 *   and cell
 * @param {user[]} users - a list of users
 * @return {object} a lookup map of form prop => value => user that matches
 *   or null if more than one user matches
 */
module.exports = (users) => {
  const propToCellToUser = {};

  users.forEach((user) => {
    // Update propToValueToUser
    Object.keys(user).forEach((prop) => {
      const cell = (
        String(user[prop])
          .trim()
          .toLowerCase()
      );

      // Initialize maps
      if (propToCellToUser[prop] === undefined) {
        propToCellToUser[prop] = {};
      }

      // Check if another user matches
      if (propToCellToUser[prop][cell]) {
        // Another user already has this prop and cell combo. Mark as null
        propToCellToUser[prop][cell] = null;
      } else {
        // No other user already has this prop and cell combo. Write it down
        propToCellToUser[prop][cell] = user;
      }
    });
  });

  return propToCellToUser;
};
