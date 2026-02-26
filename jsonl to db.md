# JSONL to DB Conversion Playbook

This document captures the full, repeatable process used to convert the BEU JSONL dataset into a well-structured, normalized SQLite database.

## 1) Source Input

- Input file: `results.jsonl`
- Each line is a JSON object containing:
  - `university`, `exam`, `student`, `subjects`, `performance`

## 2) Initial Conversion Script

Run:

```
python convert_to_db.py
```

What it does:
- Parses each JSONL row.
- Creates tables:
  - `students`
  - `theory_subjects`
  - `practical_subjects`
- Inserts student, exam, performance, and subject data.

Key logic:
- `registration_no` is PRIMARY KEY.
- `college_code` is normalized to 3 digits.

## 3) Fix College Codes (from Registration Number)

Rule:
- College code is the 3-digit segment inside `registration_no` (positions 3-5).
  Example: `24153125045` -> college code `153`.

Script:

```
python fix_college_codes.py
```

What it does:
- Rebuilds `college_mapping` using the official code->name list.
- Updates `students.college_code` by extracting from `registration_no`.

## 4) Create Mapping Tables

### 4.1 Course mapping

```
python create_mappings.py
```

Creates:
- `course_mapping` with `course_code` -> `course_name`.

### 4.2 College mapping (final)

`college_mapping` contains:
- `college_code`, `college_name`, `city`.

All colleges are under the same university, so university is not stored here.

### 4.3 Subject mapping

```
python create_subject_mapping.py
```

Creates:
- `subject_mapping` with `subject_code` -> `subject_name`, `subject_type`.

## 5) Remove Redundancy

```
python normalize_database.py
```

Removes redundant fields from `students`:
- `college_name`, `city`, `university`, `course_name`.

Moves common exam period data into a separate table:
- `exam_period` (single row)
- `students.exam_period_id` links to `exam_period`.

## 6) Add SGPA Column (First Semester)

Rule:
- Original `sgpa` column was always 0.
- New column `sgpa_1st` is created and set to `cgpa`.

Script:

```
python optimize_database.py
```

## 7) Remarks Computation (4-Tier System)

Rule used (combined):

1. **Fail (Need 5+ cgpa in Next sem)** if:
   - `cgpa < 5.0`

2. **PASS** if:
   - `cgpa >= 5.0` AND
   - all theory subjects pass AND
   - all practical subjects pass

3. **Paper Back** if:
   - `cgpa >= 5.0` AND
   - exactly ONE subject fails (theory or practical)

4. **FAIL** if:
   - `cgpa >= 5.0` AND
   - TWO or more subjects fail

Subject pass thresholds:
- Theory: `ese >= 25` AND `total >= 35% of 100` (>= 35)
- Practical: `ese >= 25` AND `total >= 35% of 50` (>= 17.5)

Run:

```
python update_remarks.py
```

This updates `students.remarks` with the appropriate status.

## 8) Final Database Schema

Tables:
- `students`
  - registration_no, name, father_name, mother_name
  - college_code, course_code
  - exam_period_id
  - cgpa, sgpa_1st, remarks
  - overall_branch_rank, college_branch_rank

- `college_mapping`
  - college_code, college_name, city

- `course_mapping`
  - course_code, course_name

- `exam_period`
  - exam_period_id, academic_year, semester, exam_month, exam_year

- `theory_subjects`
  - registration_no, subject_code, subject_name, ese, ia, total, grade, credit

- `practical_subjects`
  - registration_no, subject_code, subject_name, ese, ia, total, grade, credit

- `subject_mapping`
  - subject_code, subject_name, subject_type

## 9) Quick Verification

Run:

```
python final_verification.py
python verify_optimization.py
```

Expected:
- All mapping tables present.
- No redundant columns in `students`.
- PASS/FAIL computed for all students.

## 10) Notes

- Backups are created during normalization:
  - `database.db.before_normalize`
  - `database.db.before_optimization`
  - `database.db.before_redundancy_removal`

- If you need to re-run the pipeline:
  1) Start with `convert_to_db.py`
  2) Follow steps 3-7 in order
