const fs = require('fs');
const readline = require('readline');

const inputFile = 'results.jsonl';
const outputFile = 'results_fixed.jsonl';

const readStream = fs.createReadStream(inputFile);
const writeStream = fs.createWriteStream(outputFile);

const rl = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity
});

let lineCount = 0;

rl.on('line', (line) => {
  try {
    const record = JSON.parse(line);
    
    // Extract course code from registration number (digits 3-5, i.e., index 2-4)
    const registrationNo = record.student.registration_no;
    const courseCode = parseInt(registrationNo.substring(2, 5));
    
    // Update the course code if course object exists
    if (record.student && record.student.course) {
      record.student.course.course_code = courseCode;
    } else if (record.course) {
      record.course.course_code = courseCode;
    }
    
    writeStream.write(JSON.stringify(record) + '\n');
    
    lineCount++;
    if (lineCount % 1000 === 0) {
      console.log(`Processed ${lineCount} records...`);
    }
  } catch (error) {
    console.error(`Error on line: ${error.message}`);
    writeStream.write(line + '\n');
  }
});

rl.on('close', () => {
  console.log(`\nCompleted! Processed ${lineCount} records.`);
  console.log(`Fixed file saved to: ${outputFile}`);
});
