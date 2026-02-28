const fs = require('fs');
const readline = require('readline');

const inputFile = 'results.jsonl';
const outputFile = 'results_remarks.jsonl';

const readStream = fs.createReadStream(inputFile);
const writeStream = fs.createWriteStream(outputFile);

const rl = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity
});

let lineCount = 0;

function getRemarks(cgpa, theorySubjects, practicalSubjects) {
  // Count failing subjects
  let failingTheoryCount = 0;
  let failingPracticalCount = 0;

  // Check theory subjects: ese >= 25 AND total >= 35
  for (const subject of theorySubjects) {
    if (subject.ese < 25 || subject.total < 35) {
      failingTheoryCount++;
    }
  }

  // Check practical subjects: ese >= 25 AND total >= 17.5
  for (const subject of practicalSubjects) {
    if (subject.ese < 25 || subject.total < 17.5) {
      failingPracticalCount++;
    }
  }

  const totalFailing = failingTheoryCount + failingPracticalCount;

  // Apply 4-tier logic
  if (cgpa < 5.0) {
    return 'Fail';
  } else if (totalFailing === 0) {
    return 'PASS';
  } else if (totalFailing === 1) {
    return 'Paper Back';
  } else {
    return 'FAIL';
  }
}

rl.on('line', (line) => {
  try {
    const record = JSON.parse(line);

    const cgpa = record.performance.cgpa;
    const theorySubjects = record.subjects.theory || [];
    const practicalSubjects = record.subjects.practical || [];

    // Calculate remarks based on 4-tier system
    const remarks = getRemarks(cgpa, theorySubjects, practicalSubjects);

    // Update the remarks
    record.performance.remarks = remarks;

    writeStream.write(JSON.stringify(record) + '\n');

    lineCount++;
    if (lineCount % 1000 === 0) {
      console.log(`Processed ${lineCount} records...`);
    }
  } catch (error) {
    console.error(`Error: ${error.message}`);
    writeStream.write(line + '\n');
  }
});

rl.on('close', () => {
  console.log(`\nCompleted! Processed ${lineCount} records.`);
  console.log(`Remarks updated file saved to: ${outputFile}`);
});
