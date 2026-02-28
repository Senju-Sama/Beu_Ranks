const fs = require('fs');
const readline = require('readline');

const inputFile = 'results.jsonl';
const outputFile = 'results_merged.jsonl';

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
    
    // Merge college name and city
    const collegeName = record.student.college.college_name;
    const city = record.student.college.city;
    
    // Combine college name and city
    record.student.college.college_name = `${collegeName}, ${city}`;
    
    // Remove the city field
    delete record.student.college.city;
    
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
  console.log(`Merged file saved to: ${outputFile}`);
});
