const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');
const readline = require('readline');

// File paths
const dbFile = './database.db';
const jsonlFile = './results.jsonl';

// Delete the old database if it exists to start fresh
if (fs.existsSync(dbFile)) {
    console.log(`Deleting existing old database at ${dbFile}...`);
    fs.unlinkSync(dbFile);
}

const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Error opening database', err.message);
        process.exit(1);
    }
});

// Create tables according to the new schema
const createTablesSQL = `
CREATE TABLE exam_sessions (
    exam_id INTEGER PRIMARY KEY AUTOINCREMENT,
    academic_year TEXT,
    semester INTEGER,
    exam_month TEXT,
    exam_year INTEGER
);

CREATE TABLE colleges (
    college_code INTEGER PRIMARY KEY,
    college_name TEXT NOT NULL,
    city TEXT
);

CREATE TABLE courses (
    course_code INTEGER PRIMARY KEY,
    course_name TEXT NOT NULL
);

CREATE TABLE subjects (
    subject_code TEXT PRIMARY KEY,
    subject_name TEXT NOT NULL,
    subject_type TEXT CHECK(subject_type IN ('THEORY','PRACTICAL')),
    credit REAL NOT NULL
);

CREATE TABLE students (
    registration_no TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    father_name TEXT,
    mother_name TEXT,
    college_code INTEGER NOT NULL,
    course_code INTEGER NOT NULL,
    exam_id INTEGER NOT NULL,
    cgpa REAL,
    remarks TEXT,
    FOREIGN KEY (college_code) REFERENCES colleges(college_code),
    FOREIGN KEY (course_code) REFERENCES courses(course_code),
    FOREIGN KEY (exam_id) REFERENCES exam_sessions(exam_id)
);

CREATE TABLE student_marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registration_no TEXT NOT NULL,
    subject_code TEXT NOT NULL,
    ese INTEGER,
    ia INTEGER,
    total INTEGER,
    grade TEXT,
    status TEXT,
    UNIQUE(registration_no, subject_code),
    FOREIGN KEY (registration_no) REFERENCES students(registration_no),
    FOREIGN KEY (subject_code) REFERENCES subjects(subject_code)
);

CREATE INDEX idx_student_college ON students(college_code);
CREATE INDEX idx_student_course ON students(course_code);
CREATE INDEX idx_marks_reg ON student_marks(registration_no);
CREATE INDEX idx_marks_subject ON student_marks(subject_code);
CREATE INDEX idx_student_cgpa ON students(course_code, cgpa DESC);
`;

const CHUNK_SIZE = 500; // Number of insert statements per transaction

async function processData() {
    console.log("Setting up database schema...");

    // Create tables via sync execution
    await new Promise((resolve, reject) => {
        db.exec(createTablesSQL, err => {
            if (err) reject(err);
            else resolve();
        });
    });

    console.log("Schema created successfully.");

    // Store in-memory maps to avoid duplicate inserts and lookups
    const colleges = new Map();
    const courses = new Map();
    const subjects = new Map();

    // We will hardcode the single exam session for now as it's static in the JSON
    let examSessionId = 1;
    let hasInsertedExamSession = false;

    // Buffer for chunked inserts
    let studentsBuffer = [];
    let marksBuffer = [];

    const rl = readline.createInterface({
        input: fs.createReadStream(jsonlFile),
        logger: console
    });

    let lineCount = 0;

    // Prepare statements for bulk insert
    const insertSubjectStmt = db.prepare('INSERT OR IGNORE INTO subjects (subject_code, subject_name, subject_type, credit) VALUES (?, ?, ?, ?)');
    const insertCollegeStmt = db.prepare('INSERT OR IGNORE INTO colleges (college_code, college_name, city) VALUES (?, ?, ?)');
    const insertCourseStmt = db.prepare('INSERT OR IGNORE INTO courses (course_code, course_name) VALUES (?, ?)');

    // For transactional chunks
    const insertStudentSQL = 'INSERT OR REPLACE INTO students (registration_no, name, father_name, mother_name, college_code, course_code, exam_id, cgpa, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
    const insertMarkSQL = 'INSERT OR IGNORE INTO student_marks (registration_no, subject_code, ese, ia, total, grade, status) VALUES (?, ?, ?, ?, ?, ?, ?)';

    async function flushBuffers() {
        if (studentsBuffer.length === 0 && marksBuffer.length === 0) return;

        return new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');

                if (studentsBuffer.length > 0) {
                    const stmt = db.prepare(insertStudentSQL);
                    for (const s of studentsBuffer) {
                        stmt.run(s.reg, s.name, s.father, s.mother, s.collegeCode, s.courseCode, s.examId, s.cgpa, s.remarks);
                    }
                    stmt.finalize();
                }

                if (marksBuffer.length > 0) {
                    const stmt = db.prepare(insertMarkSQL);
                    for (const m of marksBuffer) {
                        stmt.run(m.reg, m.subCode, m.ese, m.ia, m.total, m.grade, m.status);
                    }
                    stmt.finalize();
                }

                db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else {
                        studentsBuffer = [];
                        marksBuffer = [];
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

            // 1. Exam Session Info (First line only)
            if (!hasInsertedExamSession) {
                db.run('INSERT INTO exam_sessions (academic_year, semester, exam_month, exam_year) VALUES (?, ?, ?, ?)',
                    [data.exam.academic_year || '2024', parseInt(data.exam.semester) || 1, data.exam.exam_month || 'May', parseInt(data.exam.exam_year) || 2025],
                    function (err) {
                        if (err) console.error("Error inserting exam session:", err);
                        else examSessionId = this.lastID;
                    }
                );
                hasInsertedExamSession = true;
            }

            // Extract Registration Number accurately
            const regNo = data.student.registration_no || data.student.reg_no || data.student.rollno || 'UNKNOWN';

            // Extract code correctly by parsing integer to drop leading zeros. The JSON structure varies.
            let collegeCodeRaw = undefined;
            let collegeNameRaw = '';

            if (data.student.college) {
                collegeCodeRaw = data.student.college.college_code;
                collegeNameRaw = data.student.college.college_name || '';
            }

            let collegeCode = parseInt(collegeCodeRaw || regNo.substring(5, 8));
            const cityArray = collegeNameRaw.split(',');
            const collegeName = cityArray[0].trim();
            const city = cityArray.length > 1 ? cityArray[1].trim() : '';

            // 2. Colleges
            if (!colleges.has(collegeCode)) {
                insertCollegeStmt.run(collegeCode, collegeName, city);
                colleges.set(collegeCode, true);
            }

            let courseCodeRaw = undefined;
            let courseNameRaw = '';

            if (data.student.course) {
                courseCodeRaw = data.student.course.course_code;
                courseNameRaw = data.student.course.course_name || '';
            }

            let courseCode = parseInt(courseCodeRaw || regNo.substring(3, 5));
            const courseName = courseNameRaw;

            // 3. Courses
            if (!courses.has(courseCode)) {
                insertCourseStmt.run(courseCode, courseName);
                courses.set(courseCode, true);
            }

            // 4. Buffer Students
            studentsBuffer.push({
                reg: regNo,
                name: data.student.name,
                father: data.student.father_name,
                mother: data.student.mother_name,
                collegeCode: collegeCode,
                courseCode: courseCode,
                examId: examSessionId,
                cgpa: parseFloat(data.performance.cgpa) || null,
                remarks: data.performance.remarks || null
            });

            // 5. Buffer Marks & Unique Subjects
            const processSubjects = (subArray, isTheory) => {
                if (!subArray) return;
                subArray.forEach(sub => {
                    const subCodeRaw = sub.subject_code || sub.course_code;
                    // Fix strange string bugs in JSON
                    const subCode = typeof subCodeRaw === 'string' ? subCodeRaw.trim() : String(subCodeRaw);
                    const subName = sub.subject_name || sub.course_name;

                    if (!subCode) return;

                    // Ensure subject exists
                    if (!subjects.has(subCode)) {
                        insertSubjectStmt.run(subCode, subName.trim(), isTheory ? 'THEORY' : 'PRACTICAL', parseFloat(sub.credit) || 0);
                        subjects.set(subCode, true);
                    }

                    // Buffermark for the student
                    // Deal with AB (Absent) and NE (Not Eligible) entries which JSON might have as strings
                    let ese = parseInt(sub.ese);
                    let ia = parseInt(sub.ia);
                    let tot = parseInt(sub.total);
                    let status = 'NORMAL';

                    if (isNaN(ese) && typeof sub.ese === 'string') {
                        status = sub.ese.trim();
                        ese = null;
                    }
                    if (isNaN(ia) && typeof sub.ia === 'string') {
                        status = sub.ia.trim();
                        ia = null;
                    }
                    if (isNaN(tot)) tot = null;

                    marksBuffer.push({
                        reg: regNo,
                        subCode: subCode,
                        ese: ese,
                        ia: ia,
                        total: tot,
                        grade: sub.grade,
                        status: status
                    });
                });
            };

            processSubjects(data.subjects.theory, true);
            processSubjects(data.subjects.practical, false);

            lineCount++;

            if (marksBuffer.length >= CHUNK_SIZE || studentsBuffer.length >= CHUNK_SIZE) {
                // Pause specific stream line processing to await chunk flush
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
        // flush anything left over
        insertSubjectStmt.finalize();
        insertCollegeStmt.finalize();
        insertCourseStmt.finalize();

        await flushBuffers();
        console.log(`Migration complete! Successfully processed ${lineCount} records into structured SQL schema.`);
        db.close();
    });
}

processData();
