@echo off
cd /d C:\Users\elema\DraftLine

echo === Running Tests ===
call npm test
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Tests failed! Aborting deployment.
    pause
    exit /b %ERRORLEVEL%
)

echo === Building Production Bundle ===
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Build failed! Aborting deployment.
    pause
    exit /b %ERRORLEVEL%
)

echo === Staging and Committing ===
git add .
set /p commit_msg="Enter commit message (press Enter for default): "
if "%commit_msg%"=="" set commit_msg="Update DraftLine build"

git commit -m "%commit_msg%"

echo === Pushing to GitHub & Deploying to Pages ===
git push origin main
call npm run deploy

echo === Done! DraftLine is live. ===
pause
