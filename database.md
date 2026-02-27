# RankPage Database Documentation (`database.db`)

This document provides a detailed overview of the schema and data contained in the SQLite database `database.db`.

## Overview

The database contains **9 tables** structured around student examination records, subject mappings, college details, and computed ranks for rank pages. 

Here is a summary of the tables and their row counts:
- **`students`**: 11,089 rows
- **`theory_subjects`**: 55,445 rows
- **`practical_subjects`**: 55,445 rows
- **`college_mapping`**: 52 rows
- **`course_mapping`**: 25 rows
- **`subject_mapping`**: 23 rows
- **`exam_period`**: 1 row
- **`college_topper`**: 250 rows
- **`branch_topper`**: 108 rows

---

## Table Definitions

### 1. `students` (11,089 rows)
Stores the core profile and overall academic performance metrics for each student.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `registration_no` | TEXT | PRIMARY KEY | Unique registration number for the student |
| `name` | TEXT | | Full name of the student |
| `father_name` | TEXT | | Father's name |
| `mother_name` | TEXT | | Mother's name |
| `college_code` | TEXT | NOT NULL | Identifier for the college (References `college_mapping`) |
| `course_code` | INTEGER | | Identifier for the course/branch (References `course_mapping`) |
| `exam_period_id` | INTEGER | DEFAULT "1" | Academic term period |
| `cgpa` | REAL | | Cumulative Grade Point Average |
| `sgpa_1st` | REAL | | Semester Grade Point Average (1st semester) |
| `remarks` | TEXT | | General remarks (e.g., "Paper Back in 1") |
| `overall_branch_rank`| INTEGER | | Student's rank among all students in the same branch/course |
| `college_branch_rank`| INTEGER | | Student's rank among students in the same branch within their college |

**Sample Data:**
```json
{
  "registration_no": "24104102001",
  "name": "JAYESH BHUSHAN DIWAKAR",
  "college_code": "104",
  "course_code": 104,
  "cgpa": 6.25,
  "overall_branch_rank": 519,
  "college_branch_rank": 89
}
```

### 2. `theory_subjects` (55,445 rows)
Stores the marks and grades for theory subjects for each student.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `registration_no` | TEXT | NOT NULL | Student's registration number |
| `subject_code` | TEXT | | Alphanumeric subject code |
| `subject_name` | TEXT | | Name of the subject |
| `ese` | INTEGER | | End Semester Examination marks |
| `ia` | INTEGER | | Internal Assessment marks |
| `total` | INTEGER | | Total marks obtained (`ese` + `ia`) |
| `grade` | TEXT | | Final letter grade (e.g., 'C', 'A+') |
| `credit` | REAL | | Course credits for the subject |

**Sample Data:**
```json
{
  "registration_no": "24104102001",
  "subject_code": "100102",
  "subject_name": "Engineering Mathematics-I",
  "ese": 34, "ia": 27, "total": 61,
  "grade": "C", "credit": 4.0
}
```

### 3. `practical_subjects` (55,445 rows)
Stores the marks and grades for practical subjects / labs. Matches the schema of `theory_subjects`.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Auto-incrementing unique identifier |
| `registration_no` | TEXT | NOT NULL | Student's registration number |
| `subject_code` | TEXT | | Alphanumeric subject code (e.g., "100106P") |
| `subject_name` | TEXT | | Name of the lab/practical subject |
| `ese` | INTEGER | | End Semester Examination marks (practical) |
| `ia` | INTEGER | | Internal Assessment marks |
| `total` | INTEGER | | Total marks obtained |
| `grade` | TEXT | | Final letter grade (e.g., 'A+') |
| `credit` | REAL | | Course credits (e.g., 1.0) |

### 4. `college_mapping` (52 rows)
Lookup table mapping college codes to their full names and locations.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `college_code` | TEXT | PRIMARY KEY | Unique college code identifier |
| `college_name` | TEXT | NOT NULL | Full name of the college |
| `city` | TEXT | | City where the college is located |

**Sample Data:**
```json
{"college_code": "101", "college_name": "SITYOG INSTITUTE OF TECHNOLOGY", "city": "AURANGABAD"}
```

### 5. `course_mapping` (25 rows)
Lookup table mapping course codes (branches) to their descriptive names.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `course_code` | INTEGER | PRIMARY KEY | Unique integer code for the course/branch |
| `course_name` | TEXT | NOT NULL | Descriptive course name (e.g., "101 - CIVIL ENGINEERING") |

### 6. `subject_mapping` (23 rows)
Lookup table storing standard subject definitions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `subject_code` | TEXT | PRIMARY KEY | Alphanumeric subject code |
| `subject_name` | TEXT | NOT NULL | Official name of the subject |
| `subject_type` | TEXT | | Type of subject ("THEORY" or "PRACTICAL") |

### 7. `college_topper` (250 rows)
Computed results determining the top-ranking students within each branch per college.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Unique identifer |
| `registration_no` | TEXT | | Topper's registration number |
| `name` | TEXT | | Name of the student |
| `college_code` | TEXT | | College identifier |
| `course_code` | INTEGER | | Associated branch/course |
| `cgpa` | REAL | | Final CGPA |
| `rank_in_college_branch`| INTEGER| | The student's rank mapping to 1, 2, 3... within their college's assigned branch |

### 8. `branch_topper` (108 rows)
Computed results determining the top-ranking students across the entire university per branch.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | INTEGER | PRIMARY KEY | Unique identifer |
| `registration_no` | TEXT | | Topper's registration number |
| `name` | TEXT | | Name of the student |
| `college_code` | TEXT | | College identifier |
| `course_code` | INTEGER | | Associated branch/course |
| `cgpa` | REAL | | Final CGPA |
| `overall_rank` | INTEGER | | The overall rank of the student in the entire branch |

### 9. `exam_period` (1 row)
Stores global metadata about the current dataset's examination term.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `exam_period_id` | INTEGER | PRIMARY KEY | Unique period ID |
| `academic_year` | TEXT | NOT NULL | E.g. "2024" |
| `semester` | INTEGER | NOT NULL | E.g. 1 |
| `exam_month` | TEXT | NOT NULL | E.g. "May" |
| `exam_year` | INTEGER | NOT NULL | E.g. 2025 |

---

## Relational Summary

1. `students` act as the central entity linking to `college_mapping` (via `college_code`) and `course_mapping` (via `course_code`).
2. Academic records are normalized into `theory_subjects` and `practical_subjects`, both referencing `students` via `registration_no`.
3. Separate materialized views/tables (`college_topper` and `branch_topper`) cache computation results indicating branch and college-wise highly-ranked students.
