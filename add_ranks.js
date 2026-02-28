const fs = require('fs');
const readline = require('readline');

const inputFile = 'results.jsonl';
const outputFile = 'results_ranked.jsonl';

// First pass: Read all records
const records = [];
const readStream = fs.createReadStream(inputFile);
const rl = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity
});

rl.on('line', (line) => {
  try {
    const record = JSON.parse(line);
    records.push(record);
  } catch (error) {
    console.error(`Error parsing line: ${error.message}`);
  }
});

rl.on('close', () => {
  console.log(`Loaded ${records.length} records.`);
  
  // Group by college_code + course_code for college ranks
  const collegeGroups = {};
  records.forEach(record => {
    const collegeCode = record.student.college.college_code;
    const courseCode = record.student.course.course_code;
    const key = `${collegeCode}_${courseCode}`;
    
    if (!collegeGroups[key]) {
      collegeGroups[key] = [];
    }
    collegeGroups[key].push(record);
  });
  
  // Group by course_code for university ranks
  const universityGroups = {};
  records.forEach(record => {
    const courseCode = record.student.course.course_code;
    
    if (!universityGroups[courseCode]) {
      universityGroups[courseCode] = [];
    }
    universityGroups[courseCode].push(record);
  });
  
  // Calculate college ranks (sort by CGPA descending)
  const collegeRanks = {};
  Object.keys(collegeGroups).forEach(key => {
    const group = collegeGroups[key];
    // Sort by CGPA descending
    group.sort((a, b) => b.performance.cgpa - a.performance.cgpa);
    
    group.forEach((record, index) => {
      const regNo = record.student.registration_no;
      if (!collegeRanks[regNo]) {
        collegeRanks[regNo] = {};
      }
      collegeRanks[regNo].collegeRank = index + 1;
    });
  });
  
  // Calculate university ranks (sort by CGPA descending)
  const universityRanks = {};
  Object.keys(universityGroups).forEach(key => {
    const group = universityGroups[key];
    // Sort by CGPA descending
    group.sort((a, b) => b.performance.cgpa - a.performance.cgpa);
    
    group.forEach((record, index) => {
      const regNo = record.student.registration_no;
      if (!universityRanks[regNo]) {
        universityRanks[regNo] = {};
      }
      universityRanks[regNo].universityRank = index + 1;
    });
  });
  
  // Write records with ranks
  const writeStream = fs.createWriteStream(outputFile);
  records.forEach((record, idx) => {
    const regNo = record.student.registration_no;
    
    // Add ranks to performance object
    record.performance.college_rank_branchwise = collegeRanks[regNo].collegeRank;
    record.performance.university_rank_branchwise = universityRanks[regNo].universityRank;
    
    writeStream.write(JSON.stringify(record) + '\n');
    
    if ((idx + 1) % 1000 === 0) {
      console.log(`Processed ${idx + 1} records...`);
    }
  });
  
  writeStream.on('finish', () => {
    console.log(`\nCompleted! Ranked file saved to: ${outputFile}`);
  });
});
