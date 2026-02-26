# Database Reference (database.db)

This document describes the final SQLite schema, relationships, and key rules used in the database.

## 1) Tables Overview

Tables in database.db:
- students
- college_mapping
- course_mapping
- exam_period
- theory_subjects
- practical_subjects
- subject_mapping


## 2) students

Purpose:
- Stores core student identity + performance summary and links to lookup tables.

Columns:
- registration_no (TEXT, PRIMARY KEY)
- name (TEXT)
- father_name (TEXT)
- mother_name (TEXT)
- college_code (TEXT, FK -> college_mapping.college_code)
- course_code (INTEGER, FK -> course_mapping.course_code)
- exam_period_id (INTEGER, FK -> exam_period.exam_period_id)
- cgpa (REAL)
- sgpa_1st (REAL)
- remarks (TEXT)  // PASS, Paper Back, FAIL, or Fail (Need 5+ cgpa in Next sem)
- overall_branch_rank (INTEGER)
- college_branch_rank (INTEGER)

Notes:
- sgpa_1st is set equal to cgpa (first semester).
- remarks is computed using a 4-tier combined rule (see section 10).


## 3) college_mapping

Purpose:
- Master table for college code, name, and city.

Columns:
- college_code (TEXT, PRIMARY KEY)
- college_name (TEXT)
- city (TEXT)

Notes:
- University is common for all colleges and is not stored here.
- All colleges are under Bihar Engineering University, Patna.


## 4) course_mapping

Purpose:
- Master table for course code and course name.

Columns:
- course_code (INTEGER, PRIMARY KEY)
- course_name (TEXT)


## 5) exam_period

Purpose:
- Stores common academic period data shared by all students.

Columns:
- exam_period_id (INTEGER, PRIMARY KEY)
- academic_year (TEXT)
- semester (INTEGER)
- exam_month (TEXT)
- exam_year (INTEGER)

Current data:
- 2024, semester 1, May 2025


## 6) theory_subjects

Purpose:
- Per-student theory subject marks and grades.

Columns:
- id (INTEGER, PRIMARY KEY)
- registration_no (TEXT, FK -> students.registration_no)
- subject_code (TEXT)
- subject_name (TEXT)
- ese (INTEGER)
- ia (INTEGER)
- total (INTEGER)
- grade (TEXT)
- credit (REAL)

Passing rule (theory):
- ESE >= 25 AND total >= 35 (35% of 100)


## 7) practical_subjects

Purpose:
- Per-student practical subject marks and grades.

Columns:
- id (INTEGER, PRIMARY KEY)
- registration_no (TEXT, FK -> students.registration_no)
- subject_code (TEXT)
- subject_name (TEXT)
- ese (INTEGER)
- ia (INTEGER)
- total (INTEGER)
- grade (TEXT)
- credit (REAL)

Passing rule (practical):
- ESE >= 25 AND total >= 17.5 (35% of 50)


## 8) subject_mapping

Purpose:
- Lookup table mapping subject_code -> subject_name and type.

Columns:
- subject_code (TEXT, PRIMARY KEY)
- subject_name (TEXT)
- subject_type (TEXT)  // THEORY or PRACTICAL


## 9) Key Relationships

- students.college_code -> college_mapping.college_code
- students.course_code -> course_mapping.course_code
- students.exam_period_id -> exam_period.exam_period_id
- theory_subjects.registration_no -> students.registration_no
- practical_subjects.registration_no -> students.registration_no
- subject_mapping.subject_code -> (theory_subjects.subject_code, practical_subjects.subject_code)


## 10) Remarks Rule (4-Tier System)

Combined rule used to compute students.remarks:

1. **Fail (Need 5+ cgpa in Next sem)** if:
   - cgpa < 5.0

2. **PASS** if:
   - cgpa >= 5.0 AND
   - ALL theory subjects pass AND
   - ALL practical subjects pass

3. **Paper Back** if:
   - cgpa >= 5.0 AND
   - Exactly ONE subject fails (theory or practical)

4. **FAIL** if:
   - cgpa >= 5.0 AND
   - TWO or more subjects fail

Subject passing criteria:
- Theory: ese >= 25 AND total >= 35
- Practical: ese >= 25 AND total >= 17.5


## 11) College Code Rule

- College code is extracted from registration_no.
- Example: 24153125045 -> college code 153


## 12) Quick Query Examples

Student with college + course + exam period:

SELECT s.registration_no, s.name, cm.college_name, c.course_name, ep.academic_year,
       ep.semester, ep.exam_month, ep.exam_year, s.cgpa, s.sgpa_1st, s.remarks
FROM students s
JOIN college_mapping cm ON s.college_code = cm.college_code
JOIN course_mapping c ON s.course_code = c.course_code
JOIN exam_period ep ON s.exam_period_id = ep.exam_period_id
LIMIT 10;

Subject name by code:

SELECT subject_code, subject_name, subject_type
FROM subject_mapping
WHERE subject_code = '100102';
