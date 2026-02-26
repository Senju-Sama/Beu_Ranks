const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Connect to SQLite DB
const dbFile = path.join(__dirname, 'database.db');
const db = new sqlite3.Database(dbFile, (err) => {
    if (err) {
        console.error('Error opening database module:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// Helper functions for Promises
const dbGet = (sql, params) => new Promise((resolve, reject) => db.get(sql, params, (err, row) => err ? reject(err) : resolve(row)));
const dbAll = (sql, params) => new Promise((resolve, reject) => db.all(sql, params, (err, rows) => err ? reject(err) : resolve(rows)));

// API endpoint to fetch student data by registration number
app.get('/api/student/:reg_no', async (req, res) => {
    const regNo = req.params.reg_no;

    if (!regNo) {
        return res.status(400).json({ error: 'Registration number is required' });
    }

    try {
        const studentSql = `
            SELECT s.*, cm.college_name, cm.city, c.course_name, 
                   ep.academic_year, ep.semester, ep.exam_month, ep.exam_year
            FROM students s
            LEFT JOIN college_mapping cm ON s.college_code = cm.college_code
            LEFT JOIN course_mapping c ON s.course_code = c.course_code
            LEFT JOIN exam_period ep ON s.exam_period_id = ep.exam_period_id
            WHERE s.registration_no = ?
        `;

        const studentRow = await dbGet(studentSql, [regNo]);

        if (!studentRow) {
            return res.status(404).json({ error: 'Student not found.' });
        }

        const theorySql = `SELECT * FROM theory_subjects WHERE registration_no = ?`;
        const practicalSql = `SELECT * FROM practical_subjects WHERE registration_no = ?`;

        const theoryRows = await dbAll(theorySql, [regNo]);
        const practicalRows = await dbAll(practicalSql, [regNo]);

        // Fetch max total marks for subjects in the same college & course
        // We cast 'total' to an integer to ensure string values like 'NE' are ignored or cast to 0
        const theoryTopperSql = `
            SELECT t.subject_code, MAX(CAST(t.total AS INTEGER)) as max_total
            FROM theory_subjects t
            JOIN students s ON t.registration_no = s.registration_no
            WHERE s.college_code = ? AND s.course_code = ?
            GROUP BY t.subject_code
        `;
        const practicalTopperSql = `
            SELECT t.subject_code, MAX(CAST(t.total AS INTEGER)) as max_total
            FROM practical_subjects t
            JOIN students s ON t.registration_no = s.registration_no
            WHERE s.college_code = ? AND s.course_code = ?
            GROUP BY t.subject_code
        `;

        const theoryToppers = await dbAll(theoryTopperSql, [studentRow.college_code, studentRow.course_code]);
        const practicalToppers = await dbAll(practicalTopperSql, [studentRow.college_code, studentRow.course_code]);

        const responseData = {
            university: "Bihar Engineering University, Patna",
            student: {
                name: studentRow.name,
                registration_no: studentRow.registration_no,
                father_name: studentRow.father_name,
                mother_name: studentRow.mother_name,
                college: {
                    college_code: studentRow.college_code,
                    college_name: studentRow.college_name,
                    city: studentRow.city
                },
                course: {
                    course_code: studentRow.course_code,
                    course_name: studentRow.course_name
                }
            },
            performance: {
                cgpa: studentRow.cgpa,
                sgpa_1st: studentRow.sgpa_1st,
                remarks: studentRow.remarks,
                overall_branch_rank: studentRow.overall_branch_rank,
                college_branch_rank: studentRow.college_branch_rank
            },
            subjects: {
                theory: theoryRows || [],
                practical: practicalRows || []
            },
            toppers: {
                theory: theoryToppers || [],
                practical: practicalToppers || []
            }
        };

        res.json(responseData);
    } catch (err) {
        console.error('Error executing student query:', err.message);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to calculate simulated rank based on a mocked SGPA
app.get('/api/simulate/rank', async (req, res) => {
    const { college_code, course_code, sgpa } = req.query;

    if (!college_code || !course_code || !sgpa) {
        return res.status(400).json({ error: 'college_code, course_code, and sgpa are required parameters.' });
    }

    try {
        const mockSgpa = parseFloat(sgpa);

        // 1. Calculate College Rank
        // Count students in the SAME college and SAME course who have a strictly HIGHER cgpa
        const collegeSql = `
            SELECT COUNT(*) AS count_higher
            FROM students
            WHERE college_code = ? AND course_code = ? AND CAST(cgpa AS REAL) > ?
        `;
        const collegeResult = await dbGet(collegeSql, [college_code, course_code, mockSgpa]);
        const simulatedCollegeRank = (collegeResult.count_higher || 0) + 1;

        // 2. Calculate Overall Branch Rank
        // Count students across ALL colleges in the SAME course who have a strictly HIGHER cgpa
        const overallSql = `
            SELECT COUNT(*) AS count_higher
            FROM students
            WHERE course_code = ? AND CAST(cgpa AS REAL) > ?
        `;
        const overallResult = await dbGet(overallSql, [course_code, mockSgpa]);
        const simulatedOverallRank = (overallResult.count_higher || 0) + 1;

        res.json({
            simulated_college_rank: simulatedCollegeRank,
            simulated_overall_rank: simulatedOverallRank
        });

    } catch (err) {
        console.error('Error executing simulated rank query:', err.message);
        return res.status(500).json({ error: 'Internal server error calculating simulated rank' });
    }
});

// API endpoint to fetch college toppers
app.get('/api/toppers/college', async (req, res) => {
    try {
        const sql = `
            SELECT ct.*, cm.college_name, cm.city, c.course_name
            FROM college_topper ct
            JOIN college_mapping cm ON ct.college_code = cm.college_code
            JOIN course_mapping c ON ct.course_code = c.course_code
            ORDER BY ct.college_code, ct.course_code, ct.rank_in_college_branch
            LIMIT 500
        `;
        const rows = await dbAll(sql, []);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching college toppers:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// API endpoint to fetch branch toppers
app.get('/api/toppers/branch', async (req, res) => {
    try {
        const sql = `
            SELECT bt.*, cm.college_name, cm.city, c.course_name
            FROM branch_topper bt
            JOIN college_mapping cm ON bt.college_code = cm.college_code
            JOIN course_mapping c ON bt.course_code = c.course_code
            ORDER BY bt.course_code, bt.overall_rank
            LIMIT 500
        `;
        const rows = await dbAll(sql, []);
        res.json(rows);
    } catch (err) {
        console.error('Error fetching branch toppers:', err.message);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// Conditionally listen only if run directly (local), otherwise export for Vercel
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Server is running on http://localhost:${PORT}`);
    });
} else {
    // Export the app for Vercel serverless functions
    module.exports = app;
}
