@echo off
echo Starting RankPage Local Server...

:: Check if node_modules exists, if not run npm install
if not exist "node_modules\" (
    echo Installing dependencies...
    call npm install
)

echo Starting server...
:: Open the browser
start http://localhost:3000

:: Run the Node.js server
node server.js

pause
