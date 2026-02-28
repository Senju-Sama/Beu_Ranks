const fs = require('fs');
const readline = require('readline');

const readStream = fs.createReadStream('results_remarks.jsonl');
const rl = readline.createInterface({
  input: readStream,
  crlfDelay: Infinity
});

let lineCount = 0;
const samples = [];

rl.on('line', (line) => {
  if (lineCount < 12) {
    const record = JSON.parse(line);
    const cgpa = record.performance.cgpa;
    const remarks = record.performance.remarks;
    
    const theoryFails = record.subjects.theory.filter(s => s.ese < 25 || s.total < 35).length;
    const practicalFails = record.subjects.practical.filter(s => s.ese < 25 || s.total < 17.5).length;
    const totalFails = theoryFails + practicalFails;
    
    console.log(`\nRecord ${lineCount + 1}: ${record.student.name}`);
    console.log(`  CGPA: ${cgpa}, Remarks: ${remarks}`);
    console.log(`  Theory Fails: ${theoryFails}, Practical Fails: ${practicalFails}, Total Fails: ${totalFails}`);
  }
  lineCount++;
  
  if (lineCount === 12) {
    rl.close();
  }
});

rl.on('close', () => {
  console.log(`\n✓ Verification complete`);
});
