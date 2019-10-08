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
| numStudentsPerRow | string or number | The number of students to expect per row, or "any" for any number of students, or "at-least-one" for at least one student per row, or leave out to auto detect the number of students per row based on the average number of students per row | auto detect
| numTeachingTeamMembersPerRow | string or number | The number of teaching team members to expect per row, or "any" for any number of teaching team members, or "at-least-one" for at least one teaching team member per row, or leave out to auto detect the number of teaching team members per row based on the average number of per row | auto detect

## Results

Upon successful run, an object is returned:

```js
const {
  colTypes,
  dataHeaders,
  matchedRows,
  unmatchedRows,
  rawCSV,
} = matchCSV({ /* config here */ });
```

See descriptions of each property below:

### colTypes `object[]` – the auto-detected type of each column

For each item in the `colTypes` array, the index of the item indicates the index of the column, and the item itself contains the following properties:

```js
colTypes[i] = {
    type: "data" or "student" or "teaching team member",
    property: see below,
};
```

The `property` field is `null` if the column is a data column. Otherwise, it can take on the following values:

- "canvas-id": this column contains users' Canvas ID column
- "name": this column contains users' full name
- "sortable-name": this column contains users' sortable name (last, first)
- "university-id": this column contains users' sis user id
- "login-id": this column contains the id users log into Canvas with
- "email": this column contains users' emails

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

When a row cannot be matched as expected (it breaks a "only once" rule or doesn't contain the expected number of users), we call it "unmatched" and add it to an array called "unmatchedRows" where each element looks like:

```js
unmatchedRows[i] = {
    rawRow, // A string[] of cells of the original csv row
    dataColumns, // A string[] of the cells only in the data columns
    errors, // A string[] list of error messages that describe why the row was not matched
    potentialStudents: [ // A list of students that could potentially be matched to this row
        {
            user, // The potential student object
            confidence, // A rating 0 to 100 of our NLP-generated confidence that this user should be matched to this row
        },
        ...
    ],
    potentialTeachingTeamMembers: [ // A list of teaching team members that could potentially be matched to this row
        {
            user, // The potential teaching team member object
            confidence, // A rating 0 to 100 of our NLP-generated confidence that this user should be matched to this row
        },
        ...
    ],
    
};
```

### csv `object` – the CSV file that was processed

This is the original CSV that was matched. The object has the following structure:

```js
csv = {
    headers, // A string[] list of headers
    rows, // A string[][] array of rows, where each row is a list of cell strings
};
```