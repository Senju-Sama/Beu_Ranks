const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const readline = require('readline');

// File paths
const dbFile = './database.db';
const jsonlFile = './results.jsonl';

// Delete the old database if it exists to start fresh
if (fs.existsSync(dbFile)) {
    console.log(`Deleting existing database at ${dbFile}...`);
    fs.unlinkSync(dbFile);
}

const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
        process.exit(1);
    }
});

// Create tables matching server.js expectations
const createTablesSQL = `
CREATE TABLE exam_period (
    exam_period_id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_year TEXT NOT NULL,
    semester INTEGER NOT NULL,
    exam_month TEXT NOT NULL,
    exam_year INTEGER NOT NULL
);

CREATE TABLE college_mapping (
    college_code TEXT PRIMARY KEY,
    college_name TEXT NOT NULL,
    city TEXT
);

CREATE TABLE course_mapping (
    course_code INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL
);

CREATE TABLE subject_mapping (
    subject_code TEXT PRIMARY KEY,
    subject_name TEXT NOT NULL,
    subject_type TEXT CHECK(subject_type IN ('THEORY','PRACTICAL'))
);

CREATE TABLE students (
    registration_no TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    college_code TEXT NOT NULL,
    course_code INTEGER NOT NULL,
    exam_period_id INTEGER DEFAULT 1,
    cgpa REAL,
    sgpa_1st REAL,
    remarks TEXT,
    overall_branch_rank INTEGER,
    college_branch_rank INTEGER,
    FOREIGN KEY (college_code) REFERENCES college_mapping(college_code),
    FOREIGN KEY (course_code) REFERENCES course_mapping(course_code),
    FOREIGN KEY (exam_period_id) REFERENCES exam_period(exam_period_id)
);

CREATE TABLE theory_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_no TEXT NOT NULL,
    subject_code TEXT,
    subject_name TEXT,
    ese INTEGER,
    ia INTEGER,
    total TEXT,
    grade TEXT,
    credit REAL,
    UNIQUE(registration_no, subject_code),
    FOREIGN KEY (registration_no) REFERENCES students(registration_no)
);

CREATE TABLE practical_subjects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_no TEXT NOT NULL,
    subject_code TEXT,
    subject_name TEXT,
    ese INTEGER,
    ia INTEGER,
    total TEXT,
    grade TEXT,
    credit REAL,
    UNIQUE(registration_no, subject_code),
    FOREIGN KEY (registration_no) REFERENCES students(registration_no)
);

CREATE TABLE college_topper (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_no TEXT,
    name TEXT,
    college_code TEXT,
    course_code INTEGER,
    cgpa REAL,
    rank_in_college_branch INTEGER,
    FOREIGN KEY (college_code) REFERENCES college_mapping(college_code),
    FOREIGN KEY (course_code) REFERENCES course_mapping(course_code)
);

CREATE TABLE branch_topper (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_no TEXT,
    name TEXT,
    college_code TEXT,
    course_code INTEGER,
    cgpa REAL,
    overall_rank INTEGER,
    FOREIGN KEY (college_code) REFERENCES college_mapping(college_code),
    FOREIGN KEY (course_code) REFERENCES course_mapping(course_code)
);

CREATE INDEX idx_student_college ON students(college_code);
CREATE INDEX idx_student_course ON students(course_code);
CREATE INDEX idx_student_cgpa ON students(course_code, cgpa DESC);
CREATE INDEX idx_theory_reg ON theory_subjects(registration_no);
CREATE INDEX idx_practical_reg ON practical_subjects(registration_no);
`;

const CHUNK_SIZE = 500;

async function processData() {
    console.log("Setting up database schema...");

    await new Promise((resolve, reject) => {
        db.exec(createTablesSQL, err => {
            if (err) reject(err);
            else resolve();
        });
    });

    console.log("Schema created successfully.");

    const colleges = new Map();
    const courses = new Map();
    const subjects = new Map();

    let examPeriodId = 1;
    let hasInsertedExamPeriod = false;

    let studentsBuffer = [];
    let theoryBuffer = [];
    let practicalBuffer = [];

    const rl = readline.createInterface({
        input: fs.createReadStream(jsonlFile),
        crlfDelay: Infinity
    });

    let lineCount = 0;

    const insertSubjectStmt = db.prepare('INSERT OR IGNORE INTO subject_mapping (subject_code, subject_name, subject_type) VALUES (?, ?, ?)');
    const insertCollegeStmt = db.prepare('INSERT OR IGNORE INTO college_mapping (college_code, college_name, city) VALUES (?, ?, ?)');
    const insertCourseStmt = db.prepare('INSERT OR IGNORE INTO course_mapping (course_code, course_name) VALUES (?, ?)');

    const insertStudentSQL = 'INSERT OR REPLACE INTO students (registration_no, name, father_name, mother_name, college_code, course_code, exam_period_id, cgpa, sgpa_1st, remarks, overall_branch_rank, college_branch_rank) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const insertTheorySQL = 'INSERT OR IGNORE INTO theory_subjects (registration_no, subject_code, subject_name, ese, ia, total, grade, credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
    const insertPracticalSQL = 'INSERT OR IGNORE INTO practical_subjects (registration_no, subject_code, subject_name, ese, ia, total, grade, credit) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

    async function flushBuffers() {
        if (studentsBuffer.length === 0 && theoryBuffer.length === 0 && practicalBuffer.length === 0) return;

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                if (studentsBuffer.length > 0) {
                    const stmt = db.prepare(insertStudentSQL);
                    for (const s of studentsBuffer) {
                        stmt.run(s.reg, s.name, s.father, s.mother, s.collegeCode, s.courseCode, s.examId, s.cgpa, s.sgpa, s.remarks, s.overallRank, s.collegeRank);
                    }
                    stmt.finalize();
                }

                if (theoryBuffer.length > 0) {
                    const stmt = db.prepare(insertTheorySQL);
                    for (const t of theoryBuffer) {
                        stmt.run(t.reg, t.subCode, t.subName, t.ese, t.ia, t.total, t.grade, t.credit);
                    }
                    stmt.finalize();
                }

                if (practicalBuffer.length > 0) {
                    const stmt = db.prepare(insertPracticalSQL);
                    for (const p of practicalBuffer) {
                        stmt.run(p.reg, p.subCode, p.subName, p.ese, p.ia, p.total, p.grade, p.credit);
                    }
                    stmt.finalize();
                }

                db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else {
                        studentsBuffer = [];
                        theoryBuffer = [];
                        practicalBuffer = [];
                        resolve();
                    }
                });
            });
        });
    }

    rl.on('line', async (line) => {
        if (!line.trim()) return;

        try {
            const data = JSON.parse(line);

            // Insert exam period only once
            if (!hasInsertedExamPeriod) {
                db.run('INSERT INTO exam_period (academic_year, semester, exam_month, exam_year) VALUES (?, ?, ?, ?)',
                    [data.exam.academic_year || '2024', parseInt(data.exam.semester) || 1, data.exam.exam_month || 'May', parseInt(data.exam.exam_year) || 2025],
                    function (err) {
                        if (err) console.error("Error inserting exam period:", err);
                        else examPeriodId = this.lastID;
                    }
                );
                hasInsertedExamPeriod = true;
            }

            const regNo = data.student.registration_no;
            
            // Parse college data
            let collegeCode = data.student.college.college_code.toString();
            let collegeName = data.student.college.college_name || '';
            
            // Split college name and city (format: "NAME, CITY")
            const collegeParts = collegeName.split(',');
            const cleanCollegeName = collegeParts[0].trim();
            const city = collegeParts.length > 1 ? collegeParts[1].trim() : '';

            // Insert college
            if (!colleges.has(collegeCode)) {
                insertCollegeStmt.run(collegeCode, cleanCollegeName, city);
                colleges.set(collegeCode, true);
            }

            // Parse course data
            const courseCode = parseInt(data.student.course.course_code);
            const courseName = data.student.course.course_name || '';

            // Insert course
            if (!courses.has(courseCode)) {
                insertCourseStmt.run(courseCode, courseName);
                courses.set(courseCode, true);
            }

            // Buffer student
            studentsBuffer.push({
                reg: regNo,
                name: data.student.name,
                father: data.student.father_name,
                mother: data.student.mother_name,
                collegeCode: collegeCode,
                courseCode: courseCode,
                examId: examPeriodId,
                cgpa: parseFloat(data.performance.cgpa) || null,
                sgpa: parseFloat(data.performance.sgpa) || null,
                remarks: data.performance.remarks || null,
                overallRank: parseInt(data.performance.university_rank_branchwise) || null,
                collegeRank: parseInt(data.performance.college_rank_branchwise) || null
            });

            // Process theory subjects
            const processTheorySubjects = (subArray) => {
                if (!subArray) return;
                subArray.forEach(sub => {
                    const subCode = (sub.subject_code || '').toString().trim();
                    const subName = (sub.subject_name || '').trim();

                    if (!subCode) return;

                    if (!subjects.has(subCode)) {
                        insertSubjectStmt.run(subCode, subName, 'THEORY');
                        subjects.set(subCode, true);
                    }

                    // Handle string ese values like "20*"
                    let eseVal = sub.ese;
                    if (typeof eseVal === 'string') {
                        eseVal = eseVal.replace(/[^0-9]/g, '');
                        eseVal = eseVal ? parseInt(eseVal) : null;
                    } else {
                        eseVal = parseInt(eseVal) || null;
                    }

                    theoryBuffer.push({
                        reg: regNo,
                        subCode: subCode,
                        subName: subName,
                        ese: eseVal,
                        ia: parseInt(sub.ia) || null,
                        total: sub.total !== undefined ? sub.total.toString() : null,
                        grade: sub.grade || null,
                        credit: parseFloat(sub.credit) || 0
                    });
                });
            };

            // Process practical subjects
            const processPracticalSubjects = (subArray) => {
                if (!subArray) return;
                subArray.forEach(sub => {
                    const subCode = (sub.subject_code || '').toString().trim();
                    const subName = (sub.subject_name || '').trim();

                    if (!subCode) return;

                    if (!subjects.has(subCode)) {
                        insertSubjectStmt.run(subCode, subName, 'PRACTICAL');
                        subjects.set(subCode, true);
                    }

                    let eseVal = sub.ese;
                    if (typeof eseVal === 'string') {
                        eseVal = eseVal.replace(/[^0-9]/g, '');
                        eseVal = eseVal ? parseInt(eseVal) : null;
                    } else {
                        eseVal = parseInt(eseVal) || null;
                    }

                    practicalBuffer.push({
                        reg: regNo,
                        subCode: subCode,
                        subName: subName,
                        ese: eseVal,
                        ia: parseInt(sub.ia) || null,
                        total: sub.total !== undefined ? sub.total.toString() : null,
                        grade: sub.grade || null,
                        credit: parseFloat(sub.credit) || 0
                    });
                });
            };

            processTheorySubjects(data.subjects.theory);
            processPracticalSubjects(data.subjects.practical);

            lineCount++;

            if (studentsBuffer.length >= CHUNK_SIZE || theoryBuffer.length >= CHUNK_SIZE) {
                rl.pause();
                await flushBuffers();
                rl.resume();
                if (lineCount % 500 === 0) {
                    console.log(`Processed ${lineCount} students...`);
                }
            }

        } catch (err) {
            console.error(`Error processing line ${lineCount}:`, err.message);
        }
    });

    rl.on('close', async () => {
        insertSubjectStmt.finalize();
        insertCollegeStmt.finalize();
        insertCourseStmt.finalize();

        await flushBuffers();
        
        console.log(`\n✓ Migration complete! Processed ${lineCount} students.`);
        console.log('Now generating topper tables...');
        
        // Generate college toppers
        await generateCollegeToppers();
        
        // Generate branch toppers
        await generateBranchToppers();
        
        console.log('\n✓ All done!');
        db.close();
    });
}

async function generateCollegeToppers() {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO college_topper (registration_no, name, college_code, course_code, cgpa, rank_in_college_branch)
            SELECT 
                registration_no, 
                name, 
                college_code, 
                course_code, 
                cgpa,
                ROW_NUMBER() OVER (PARTITION BY college_code, course_code ORDER BY CAST(cgpa AS REAL) DESC) as rank
            FROM students
            WHERE cgpa IS NOT NULL
            ORDER BY college_code, course_code, cgpa DESC
        `;
        
        db.run(sql, (err) => {
            if (err) reject(err);
            else {
                console.log('✓ College toppers generated');
                resolve();
            }
        });
    });
}

async function generateBranchToppers() {
    return new Promise((resolve, reject) => {
        const sql = `
            INSERT INTO branch_topper (registration_no, name, college_code, course_code, cgpa, overall_rank)
            SELECT 
                registration_no, 
                name, 
                college_code, 
                course_code, 
                cgpa,
                ROW_NUMBER() OVER (PARTITION BY course_code ORDER BY CAST(cgpa AS REAL) DESC) as rank
            FROM students
            WHERE cgpa IS NOT NULL
            ORDER BY course_code, cgpa DESC
        `;
        
        db.run(sql, (err) => {
            if (err) reject(err);
            else {
                console.log('✓ Branch toppers generated');
                resolve();
            }
        });
    });
}

processData();
