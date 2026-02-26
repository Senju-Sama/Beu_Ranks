const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('c:/Users/swaya/Downloads/RankPage/database.db');

const regNo = '24101103001';

const studentSql = 
  SELECT s.college_code, s.course_code 
  FROM students s 
  WHERE s.registration_no = ?
;

db.get(studentSql, [regNo], (err, row) => {
  if (err) throw err;
  
  const theoryTopperSql = 
    SELECT t.subject_code, MAX(t.total) as max_total
    FROM theory_subjects t
    JOIN students s ON t.registration_no = s.registration_no
    WHERE s.college_code = ? AND s.course_code = ?
    GROUP BY t.subject_code
  ;
  
  db.all(theoryTopperSql, [row.college_code, row.course_code], (err, topperRows) => {
    if (err) throw err;
    console.log('Topper Theory Scores for College/Branch:');
    console.log(topperRows);
  });
});
