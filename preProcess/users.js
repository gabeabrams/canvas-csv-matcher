/**
 * Finds a pair of duplicate props (for every user, the value of the first
 *   prop and the value of the second prop are the same) and returns the
 *   name of the second prop. If no duplicate exists, returns null
 * @param {User[]} users - a list of users to search
 * @return {string|null} the second prop of the duplicate or null if no
 *   duplicate was found
 */
const findSecondPropOfDuplicate = (simpleObjects) => {
  // No duplicates if no objects
  if (simpleObjects.length === 0) {
    return null;
  }

  const props = Object.keys(simpleObjects[0]);

  // No duplicates if only 1 prop
  const { length } = props;
  if (length <= 1) {
    return null;
  }

  // Find a duplicate
  for (let i = 0; i < props.length - 1; i++) {
    for (let j = i + 1; j < props.length; j++) {
      const firstProp = props[i];
      const secondProp = props[j];
      const isDuplicate = simpleObjects.every((obj) => {
        return (obj[firstProp] === obj[secondProp]);
      });

      if (isDuplicate) {
        // Found a duplicate!
        return secondProp;
      }
    }
  }

  // No duplicates
  return null;
};

/**
 * Pre-processes an array of Canvas user objects, returning simplified objects
 * @param {User[]} [users=[]] - an array of Canvas user objects
 * @return {object[]} a simplified user object array with duplicate props
 *   removed, where each object takes the form:
 *   { canvasId, fullName, sortableName, sisUserId, loginId, email }
 */
module.exports = (users) => {
  /* ------------------ Convert to simple objects ----------------- */

  let simpleObjects = (users || []).map((user) => {
    return {
      canvasId: user.id,
      fullName: String(user.name || '').toLowerCase(),
      sortableName: String(user.sortable_name || '').toLowerCase(),
      sisUserId: String(user.sis_user_id || '').toLowerCase(),
      loginId: String(user.login_id || '').toLowerCase(),
      email: String(user.email || '').toLowerCase(),
    };
  });

  /* ------------------- Remove Duplicate Props ------------------- */

  // Keep iterating until no duplicates exist
  let stillSearchingForDups = true;
  while (stillSearchingForDups) {
    // Find duplicates
    const secondProp = findSecondPropOfDuplicate(simpleObjects);

    if (secondProp) {
      // We just found a duplicate. Keep searching
      stillSearchingForDups = true;

      // Remove the duplicate (remove the second prop)
      simpleObjects = simpleObjects.map((obj) => {
        const newObj = obj;
        newObj[secondProp] = undefined;
        return newObj;
      });
    } else {
      // We didn't find any duplicates. No need to keep searching
      stillSearchingForDups = false;
    }
  }

  return simpleObjects;
};
