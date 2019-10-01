const API = require('caccl-api');
const path = require('path');

const matchCSV = require('..');

// Import environment
const { courseId, accessToken, canvasHost } = require('./environment');

// Initialize CACCL
const api = new API({
  canvasHost,
  accessToken,
});

describe('Canvas CSV Matcher', function () {
  it('Works with Filename', async function () {
    this.timeout(50000);
    // Get lists of people
    const students = await api.course.listStudents({ courseId });
    const teachingTeamMembers = await api.course.listTeachingTeamMembers({
      courseId,
    });

    // Build csv filename
    const csv = path.join(__dirname, 'files/roster.csv');

    // Run matching algo
    console.log('Starting process');
    const results = matchCSV({
      csv,
      students,
      teachingTeamMembers,
      studentOnlyOnce: true,
    });
    console.log('results', results.csv.colTypes);
  });
});
