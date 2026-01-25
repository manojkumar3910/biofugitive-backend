# DeepFace Face Recognition - Troubleshooting Guide

## Quick Checklist

Before debugging, verify these 5 things:

```
[ ] 1. Python 3.7+ installed and in system PATH
[ ] 2. DeepFace installed: pip install deepface tensorflow keras
[ ] 3. Face recognition script exists: backend/face_recognition/recognizer.py
[ ] 4. Database folder created: backend/face_recognition/db/
[ ] 5. Reference face images added to db/ folder (at least 1 .jpg/.png file)
```

## Error Messages and Solutions

### Error: "JSON Parse error: Unexpected character: <"
**Cause**: Backend returning HTML instead of JSON (usually an error page)

**Solution**:
1. Check server logs for detailed error messages
2. Verify Python path: `python --version` in terminal
3. Verify DeepFace is installed: `python -m pip list | grep deepface`
4. Check if script file exists: `backend/face_recognition/recognizer.py`

### Error: "Failed to start DeepFace process"
**Cause**: Python not found or not in PATH

**Windows Solution**:
```bash
# Test Python
python --version

# If not found, reinstall Python and ensure "Add Python to PATH" is checked
# Then restart your terminal/IDE
```

**Mac/Linux Solution**:
```bash
# Try python3 instead
python3 --version
pip3 install deepface tensorflow keras
```

### Error: "DeepFace library not found"
**Solution**:
```bash
# Install missing dependencies
pip install deepface tensorflow keras

# Or for specific versions
pip install deepface==0.0.77 tensorflow==2.11.0 keras==2.11.0

# Verify installation
python -c "from deepface import DeepFace; print('Success!')"
```

### Error: "No reference faces in database"
**Cause**: No image files in `face_recognition/db/` folder

**Solution**:
1. Create folder: `backend/face_recognition/db/`
2. Add face images (.jpg, .png, .bmp) to this folder
3. Verify with: `ls backend/face_recognition/db/` or File Explorer
4. Ensure filenames have no spaces (use underscores instead)

**Example**:
```
face_recognition/db/
├── john_doe.jpg          ✅ Good
├── person_123.jpg        ✅ Good
├── criminal_001.png      ✅ Good
└── unknown image.jpg     ❌ Don't use spaces
```

### Error: "No face detected in the image"
**Causes**:
- Face partially obscured (mask, hat, sunglasses)
- Poor lighting
- Face too small or at extreme angle
- Image quality too low

**Solution**:
- Capture clear, front-facing images
- Ensure good lighting
- Remove any obstructions (masks, glasses)
- App now shows alert before capture reminding users of this

### Error: "Timeout" or "Process took too long"
**Cause**: DeepFace processing is slow

**Normal timing**:
- First run: 10-30 seconds (downloads AI models)
- Subsequent runs: 5-10 seconds
- With many database images: 10-20 seconds

**Solutions**:
- This is normal, not an error - just wait
- Use smaller images (500x500 pixels)
- Reduce number of images in database

### Error: "Out of Memory"
**Cause**: DeepFace uses significant RAM (1-2GB)

**Solution**:
- Close other applications
- Reduce database size (remove unused face images)
- Use a server with more RAM

## Verification Steps

### 1. Test Python Installation
```bash
python --version
# Should show Python 3.7.0 or higher
```

### 2. Test DeepFace Installation
```bash
python -c "from deepface import DeepFace; print('DeepFace imported successfully')"
# Should print: DeepFace imported successfully
```

### 3. Test the Python Script Manually
```bash
# Create a test image first
# Then run:
cd backend/face_recognition
python recognizer.py db/test_image.jpg db/
# Should output JSON
```

### 4. Check Server Logs
Start the backend and watch for logs:
```bash
cd backend
npm start
# Look for:
# - "Received face image for matching: ..."
# - "Found X reference face images in database"
# - "Python process exit code: 0"
# - "DeepFace result: ..."
```

## Testing with Sample Images

### Add a test image to database
1. Find a clear face photo
2. Save as: `backend/face_recognition/db/test_person.jpg`
3. Take a similar photo from the app
4. Click "Facial Recognition" > "Capture"
5. Should show match with "test_person" name

## If Still Not Working

### Check these in order:
1. **Terminal**: `python --version` - Python must be installed
2. **Terminal**: `pip list | grep deepface` - DeepFace must be installed
3. **File Explorer**: `backend/face_recognition/` folder exists
4. **File Explorer**: `backend/face_recognition/db/` has at least 1 image
5. **Server Logs**: Look for error messages when capturing
6. **Backend restart**: Kill and restart the Node.js backend

### Enable Debug Logging
In `server.js`, the logs should show:
```
Received face image for matching: ...
Saved temp image to: ...
Found X reference face images in database
Python process exit code: 0
DeepFace result: ...
```

If you don't see these, the Python process isn't running.

## Common Setup Issues

| Issue | Solution |
|-------|----------|
| Python command not found | Install Python, restart terminal |
| ImportError: No module named 'deepface' | Run `pip install deepface tensorflow` |
| No images in database | Add .jpg/.png files to `face_recognition/db/` |
| Face not detected | Ensure face is clear, well-lit, front-facing |
| Very slow processing | Normal on first run, subsequent runs faster |
| Out of Memory | Close other apps or restart server |

## Getting Help

When asking for help, provide:
1. Python version: `python --version`
2. DeepFace installed: `pip list | grep deepface`
3. Full server error log (copy from terminal)
4. Files in db folder: `ls backend/face_recognition/db/`
5. Operating System (Windows/Mac/Linux)

