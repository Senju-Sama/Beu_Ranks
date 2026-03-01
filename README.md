# BEU RankPage

A Node.js/Express web application that presents student ranking data for Bihar Engineering University (BEU). The application parses a JSONL file of student results, converts it into an optimized SQLite database, and computes university-wide and college-wide rankings.

## Project Structure

- `migrate.js` - Script to convert `results.jsonl` into a normalized SQLite database and compute topper tables.
- `server.js` - The main Express HTTP server that serves the JSON API for frontend consumption.
- `public/` - Static assets and frontend UI (HTML/CSS/JS) to beautifully render the rank tables.
- `database.db` - The generated SQLite database (should not be manually edited).
- `database.md` - Documentation of the database schema and structure.
- `jsonl to db.md` - Technical notes on the JSONL to database migration process and history.

## Prerequisites

- Node.js (`v14+` recommended)
- `npm`

## Setup & Running

1. Install dependencies:

   ```bash
   npm install
   ```

2. (Optional) Rebuild the database if starting fresh or if `results.jsonl` has been updated:

   ```bash
   node migrate.js
   ```

   *Note: This will delete the existing `database.db` and recreate it. It typically takes ~2 minutes for ~11,000 students.*

3. Start the server (local development):

   ```bash
   npm run start
   # or
   node server.js
   # or
   start.bat
   ```

4. The server will launch on port `3000` (by default). Visit `http://localhost:3000` in your browser.

## API Endpoints

The core backend serves several robust endpoints for querying student records:

- `/api/student/:reg_no` - Retrieves detailed academic data for a specific student, including their theory/practical results and rank.
- `/api/colleges` - Lists all available colleges and locations.
- `/api/branches` - Lists all branches (courses).
- `/api/toppers/college` - Outputs college-wise rank toppers (query params: `college_code`, `course_code`).
- `/api/toppers/branch` - Outputs university-wide toppers (query params: `course_code`).
- `/api/simulate/rank` - Simulates a student's rank relative to the university dataset based on a given CGPA.

## Deployment

This application comes with a `vercel.json` and is configured for deployment on [Vercel](https://vercel.com). Simply link your repository and Vercel will start the server block correctly. Make sure that the `.db` file is bundled appropriately if using standard static deployments or edge functions, although modifying SQLite on a read-only Vercel filesystem will not be possible (the DB must be pre-built and treated as static content).
