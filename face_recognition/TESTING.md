# DeepFace Testing Guide

## Full Test Checklist

### Pre-Test Verification

#### Python Environment
```bash
# Test 1: Python installed
python --version
# Expected: Python 3.7.0 or higher

# Test 2: Python in PATH
where python  # Windows
which python  # Mac/Linux
# Expected: Path to python executable

# Test 3: DeepFace installed
pip list | grep deepface
# Expected: deepface version listed

# Test 4: TensorFlow installed
pip list | grep tensorflow
# Expected: tensorflow version listed
```

#### File System
```bash
# Test 5: Script exists
ls -la backend/face_recognition/recognizer.py
# Expected: file listed

# Test 6: Database folder exists
ls -la backend/face_recognition/db/
# Expected: folder and any image files listed

# Test 7: Database has images
ls backend/face_recognition/db/*.jpg
# Expected: at least one .jpg file
```

### Functional Tests

#### Test 1: Python Script Direct Execution
```bash
# Prepare: Add a test image to db folder
# Example: Copy john_doe.jpg and jane_doe.jpg to db/

# Run the script manually
cd backend/face_recognition
python recognizer.py db/john_doe.jpg db/

# Expected Output (JSON):
# {
#   "match": true,
#   "filename": "john_doe.jpg",
#   "personIdentifier": "john_doe",
#   "distance": 0.0234,
#   "confidence": 97.65,
#   "matchedFilePath": "/path/to/john_doe.jpg"
# }
```

#### Test 2: No Match Test
```bash
# Create or use a different face image (not in db)
# Test image should be of a different person

python recognizer.py path/to/different_face.jpg db/

# Expected Output:
# {
#   "match": false,
#   "message": "No matching person found in database.",
#   "confidence": 0
# }
```

#### Test 3: No Face Detected
```bash
# Use an image with no face (landscape, object, etc)

python recognizer.py path/to/landscape.jpg db/

# Expected Output:
# {
#   "error": "No face detected in the image. Please ensure...",
#   "errorType": "NO_FACE_DETECTED",
#   "match": false
# }
```

#### Test 4: Invalid Image Path
```bash
# Use non-existent path
python recognizer.py /nonexistent/path/image.jpg db/

# Expected Output:
# {
#   "error": "Target image not found: ...",
#   "errorType": "IMAGE_NOT_FOUND"
# }
```

#### Test 5: Empty Database
```bash
# Temporarily move all images from db/ to a backup folder
mv backend/face_recognition/db/*.jpg backup/

# Run the script
python recognizer.py db/test.jpg db/

# Expected Output:
# {
#   "error": "No images found in database path: ...",
#   "errorType": "NO_DB_IMAGES",
#   "foundFiles": [...]
# }

# Restore images
mv backup/*.jpg backend/face_recognition/db/
```

### Backend API Tests

#### Test 6: Start Backend Server
```bash
cd backend
npm start

# Expected in console:
# MongoDB connected
# Server running on port 3000
# In later logs: Found X reference face images in database
```

#### Test 7: Test API with Invalid Image
```bash
# Using curl or Postman
curl -X POST http://localhost:3000/face-match \
  -H "Content-Type: application/json" \
  -d '{"faceImage": "invalid_base64", "filename": "test.jpg"}'

# Expected Response (500):
# {
#   "message": "Face recognition failed: ...",
#   "matchFound": false
# }
```

#### Test 8: Test API with Valid Image
```bash
# Create base64 from image file
# On Windows (PowerShell):
[Convert]::ToBase64String([IO.File]::ReadAllBytes("path/to/image.jpg")) | Set-Clipboard

# Create JSON request:
{
  "faceImage": "<paste_base64_here>",
  "filename": "test_face.jpg"
}

# POST to http://localhost:3000/face-match
# Expected Response (200):
# {
#   "matchFound": true,
#   "matchedPerson": {...},
#   "confidence": 85.5,
#   "totalCompared": 5,
#   "processingTime": 8500
# }
```

### Mobile App Tests

#### Test 9: Facial Recognition Capture
1. Launch app
2. Navigate to Scan Screen
3. Select "Facial Recognition"
4. Camera opens
5. Position face in frame
6. Click capture button
7. Alert appears: "Before Capturing - Remove masks, glasses, coolers..."
8. Click "Capture"
9. App sends image to backend
10. Results modal shows match or no match

**Expected Results**:
- ✅ Alert appears before capture
- ✅ Image sent without errors
- ✅ Result displays quickly (5-10 seconds)
- ✅ Correct person identified if match found

#### Test 10: No Match Scenario
1. Take a photo of someone NOT in database
2. App processes and shows "No Match Found"
3. Shows number of faces compared
4. Shows processing time

**Expected Results**:
- ✅ No errors
- ✅ Clear "no match" message
- ✅ Can retry with another image

#### Test 11: Poor Quality Image
1. Take blurry photo or photo with mask/glasses
2. App might detect no face
3. Show appropriate error message

**Expected Results**:
- ✅ Error message is clear
- ✅ App doesn't crash
- ✅ Can retry

### Performance Tests

#### Test 12: Response Time
```bash
# Measure from capture to result display
# Expected:
# - First run: 15-30 seconds (downloads models)
# - Subsequent: 5-10 seconds per comparison
# - 100 database images: 15-20 seconds
```

#### Test 13: Multiple Consecutive Scans
1. Perform 5 facial recognition scans in a row
2. Note processing time for each
3. Check for memory issues
4. Verify results are accurate

**Expected Results**:
- ✅ All scans complete successfully
- ✅ Consistent accuracy
- ✅ No memory leaks
- ✅ Subsequent scans faster than first

#### Test 14: Large Database Test
```bash
# Add 50+ face images to db/
# Run facial recognition
# Note processing time and accuracy

# Expected:
# - Processing takes 15-25 seconds
# - Accuracy remains high
# - All images compared
```

### Error Handling Tests

#### Test 15: Python Not Found
1. Temporarily remove Python from PATH
2. Restart backend
3. Try facial recognition

**Expected Results**:
- ✅ Clear error: "Failed to start DeepFace process"
- ✅ Helpful message: "Make sure Python is installed"
- ✅ App doesn't crash

#### Test 16: DeepFace Not Installed
1. Uninstall deepface: `pip uninstall deepface`
2. Restart backend
3. Try facial recognition

**Expected Results**:
- ✅ Clear error: "DeepFace library not found"
- ✅ Installation instruction provided
- ✅ Helpful suggestion shown

#### Test 17: Corrupted Image File
1. Create invalid image file (random bytes)
2. Add to database or use in capture
3. Try facial recognition

**Expected Results**:
- ✅ Clear error message
- ✅ App handles gracefully
- ✅ No crash

## Test Result Log

### Environment Information
```
Date: ____________
OS: ____________
Python Version: ____________
DeepFace Version: ____________
Node.js Version: ____________
Database Images: ____________
```

### Test Results
```
Test 1 (Python Installed): PASS / FAIL
Test 2 (Python Script): PASS / FAIL
Test 3 (No Match): PASS / FAIL
Test 4 (No Face): PASS / FAIL
Test 5 (Invalid Path): PASS / FAIL
Test 6 (Backend Start): PASS / FAIL
Test 7 (API Invalid): PASS / FAIL
Test 8 (API Valid): PASS / FAIL
Test 9 (App Capture): PASS / FAIL
Test 10 (No Match App): PASS / FAIL
Test 11 (Poor Quality): PASS / FAIL
Test 12 (Response Time): PASS / FAIL - Time: ______
Test 13 (Multiple Scans): PASS / FAIL
Test 14 (Large DB): PASS / FAIL - Time: ______
Test 15 (Python Not Found): PASS / FAIL
Test 16 (DeepFace Not Installed): PASS / FAIL
Test 17 (Corrupted Image): PASS / FAIL
```

### Known Issues Found
```
Issue 1: ____________
Workaround: ____________

Issue 2: ____________
Workaround: ____________
```

## Success Criteria

All tests must pass for production readiness:
- ✅ Python and dependencies properly installed
- ✅ Database has reference images
- ✅ Python script executes correctly
- ✅ Backend API responds properly
- ✅ Mobile app captures and displays results
- ✅ Error handling works correctly
- ✅ Performance is acceptable (< 20 seconds)
- ✅ No crashes or unhandled exceptions

---

**Test Completed By**: ____________
**Date**: ____________
**Status**: READY / NEEDS FIXES
