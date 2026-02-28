const fs = require('fs');
const readline = require('readline');

const readStream = fs.createReadStream('results_ranked.jsonl');
const rl = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity
});

let lineCount = 0;
const samples = [];

rl.on('line', (line) => {
  if (lineCount < 5) {
    const record = JSON.parse(line);
    const collegeName = record.student.college.college_name;
    const courseName = record.student.course.course_name;
    const cgpa = record.performance.cgpa;
    const collegeRank = record.performance.college_rank_branchwise;
    const universityRank = record.performance.university_rank_branchwise;
    
    console.log(`\nRecord ${lineCount + 1}:`);
    console.log(`  Name: ${record.student.name}`);
    console.log(`  College: ${collegeName}`);
    console.log(`  Course: ${courseName}`);
    console.log(`  CGPA: ${cgpa}`);
    console.log(`  College Rank (Branchwise): ${collegeRank}`);
    console.log(`  University Rank (Branchwise): ${universityRank}`);
  }
  lineCount++;
  
  if (lineCount === 5) {
    rl.close();
  }
});

rl.on('close', () => {
  console.log(`\n✓ Verification complete`);
});
