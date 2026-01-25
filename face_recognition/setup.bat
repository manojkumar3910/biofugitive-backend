@echo off
REM Quick setup script for DeepFace on Windows

echo.
echo ====================================
echo DeepFace Face Recognition Setup
echo ====================================
echo.

REM Check Python
echo [1/5] Checking Python installation...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found!
    echo Please install Python from https://www.python.org/downloads/
    echo Make sure to check "Add Python to PATH" during installation
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version') do set PYTHON_VERSION=%%i
echo OK: %PYTHON_VERSION% installed

REM Install dependencies
echo.
echo [2/5] Installing DeepFace and dependencies...
echo This may take a few minutes...
pip install deepface tensorflow keras
if errorlevel 1 (
    echo ERROR: Failed to install packages!
    pause
    exit /b 1
)
echo OK: Dependencies installed

REM Verify installation
echo.
echo [3/5] Verifying DeepFace installation...
python -c "from deepface import DeepFace; print('DeepFace imported successfully')"
if errorlevel 1 (
    echo ERROR: DeepFace verification failed!
    pause
    exit /b 1
)
echo OK: DeepFace verified

REM Create database folder
echo.
echo [4/5] Creating database folder...
if not exist "db" (
    mkdir db
    echo OK: Created db folder
) else (
    echo OK: db folder already exists
)

REM Final check
echo.
echo [5/5] Final verification...
python recognizer.py >nul 2>&1
if errorlevel 1 (
    echo WARNING: Script test failed (this is OK if no db images exist)
) else (
    echo OK: Script is working
)

echo.
echo ====================================
echo Setup Complete!
echo ====================================
echo.
echo Next steps:
echo 1. Add face images to: face_recognition/db/
echo    - Use .jpg, .jpeg, .png, or .bmp files
echo    - Clear, front-facing photos work best
echo.
echo 2. Start the backend server
echo    cd ..
echo    npm start
echo.
echo 3. Use the app to test facial recognition
echo.
echo For troubleshooting, see: TROUBLESHOOTING.md
echo.
pause
