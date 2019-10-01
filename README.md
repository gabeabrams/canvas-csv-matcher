# canvas-csv-matcher
An intelligent auto-matching system that automatically identifies users in rows.

## Running the Matching Algorithm

```js
// Import
const matchCSV = require('canvas-csv-matcher');

...

// Run matching
const results =  matchCSV({ /* see arguments below */ });
```

### Arguments:

| Name | Type | Description | Required/Default |
| :--- | :--- | :--- | :---
| csv | string or object | CSV Contents. May be a filename, string contents of a CSV file with one header row, or a processed csv file in the form: `{ headers, rows }` where `headers` is an array of header titles and `rows` is a list of rows (and a row is a string[] where each item is a cell) | Required |
| students | CanvasUser[] | List of Canvas student objects to match with. Must be included if you want to match students | []
| teachingTeamMembers | CanvasUser[] | List of Canvas teaching team member objects to match with. Must be included if you want to match teaching team members | []
| studentOnlyOnce | boolean | If true, each student can only appear once in the CSV. If a student appears more than once, all rows with the student are disqualified from matching | false |
| teachingTeamMemberOnlyOnce | boolean | If true, each teaching team member can only appear once in the CSV. If a teaching team member appears more than once, all rows with the teaching team member are disqualified from matching | false |

## Results

Upon successful run, an object is returned:

```js
const {
  dataHeaders,
  matchedRows,
  unmatchedRows,
  rawCSV,
} = matchCSV({ /* config here */ });
```

See descriptions of each property below:

### dataHeaders `string[]` – headers for the data columns

We divide the columns into to types:

- Matching columns: the columns we automatically detected as containing user information (the ones we use for matching)
- Data columns: the rest of the columns

`dataHeaders` will be an array of the header names corresponding to the data columns.

Example:

> With the following headers and their auto-detected types:
>
> | Name | Email | Grade | Grader Name | Grader Email | Grader Id | Timestamp |
> | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
> | Matching Column | Matching Column | Data Column | Matching Column | Matching Column | Matching Column | Data Column |
>
> dataHeaders will equal:
>
> ```js
> ['Grade', 'Timestamp']
> ```

### matchedRows `object[]` – the list of rows that were automatically matched

A list of matched rows. Each item in the array represents a row that was matched:

```js
rows[i] = {
    students, // The list of students matched to the row
    teachingTeamMembers, // The list of teaching team members matched to the row
    rawRow, // The raw data of the row (array of cell strings)
    dataColumns, // The raw data of the data columns (the same cols as those in dataHeaders
};
```

### unmatchedRows `object[]` – the list of rows that could not be matched

// TODO: finish describing

        rawRow,
        dataColumns,
        potentialStudents,
        potentialTeachingTeamMembers,

### colTypes `object[]` – an array of the auto-determined column types

### csv `object` – the CSV file that was processed

// TODO: finish describing

        headers,
        rows,
