# DeepFace Quick Reference Card

## 📋 Quick Setup (5 minutes)

```bash
# 1. Install dependencies (2 min)
pip install deepface tensorflow keras

# 2. Add face images to database
# Copy photos to: backend/face_recognition/db/
# Use clear, front-facing photos

# 3. Start backend
cd backend && npm start

# 4. Test in app
# Scan > Facial Recognition > Capture face
```

## ⚠️ Common Errors & Quick Fixes

| Error | Fix |
|-------|-----|
| `"Python is not found"` | Install Python from python.org, restart terminal |
| `"JSON Parse error: <"` | Check Python installed: `python --version` |
| `"No reference faces"` | Add .jpg files to `backend/face_recognition/db/` |
| `"No face detected"` | Use clearer photo, remove mask/glasses, better lighting |
| `"Timeout"` | Normal on first run (30s), subsequent runs faster (5-10s) |

## 🗂️ File Structure

```
backend/face_recognition/
├── recognizer.py          ← Python DeepFace script
├── db/                    ← Face images (add your images here)
├── README.md              ← Full documentation
├── SETUP.md               ← Installation guide
├── TROUBLESHOOTING.md     ← Detailed troubleshooting
├── TESTING.md             ← Testing procedures
└── setup.bat              ← Windows auto-setup script
```

## ✅ Pre-Flight Checklist

```
□ Python 3.7+ installed      → python --version
□ DeepFace installed         → pip list | grep deepface
□ Database folder created    → mkdir backend/face_recognition/db
□ Face images added          → At least 1 photo in db/
□ Backend running            → npm start
□ No error in logs           → Server logs clean
```

## 📖 Documentation Map

| Document | Use For |
|----------|---------|
| **README.md** | Overview and architecture |
| **SETUP.md** | Installation and configuration |
| **TROUBLESHOOTING.md** | Fixing problems |
| **TESTING.md** | Verification and testing |
| **setup.bat** | Automatic Windows setup |

## 🔧 Manual Python Test

```bash
# Navigate to face_recognition folder
cd backend/face_recognition

# Test with existing database images
python recognizer.py db/person_name.jpg db/

# Expected output (JSON):
# {"match": true, "confidence": 85.5, ...}
# or
# {"match": false, "message": "No match found"}
```

## 🚀 Quick Performance Reference

| Phase | Time | Notes |
|-------|------|-------|
| First run | 15-30 sec | Downloads AI models (~200MB) |
| Subsequent | 5-10 sec | Models cached |
| 100 DB images | 15-20 sec | More comparisons = more time |

## 📱 App Usage

1. **Open app** → Scan page
2. **Select** "Facial Recognition"
3. **Alert appears** → Remove masks/glasses
4. **Click Capture** → Take photo
5. **Wait** → 5-10 seconds processing
6. **See results** → Match or "No Match"

## 🎯 Image Requirements

### For Database Photos
- ✅ Clear, front-facing face
- ✅ Good lighting
- ✅ 500x500 pixels or larger
- ✅ Formats: .jpg, .png, .bmp
- ❌ No masks, sunglasses, hats
- ❌ No blurry images
- ❌ No extreme angles

### For App Captures
- ✅ Face directly toward camera
- ✅ Remove glasses/sunglasses
- ✅ Good lighting
- ✅ Face fills frame
- ❌ Avoid masks
- ❌ Avoid backlighting

## 🔍 Debugging Steps

```bash
# Step 1: Check Python
python --version

# Step 2: Check DeepFace
python -c "from deepface import DeepFace; print('OK')"

# Step 3: Check files
ls backend/face_recognition/recognizer.py
ls backend/face_recognition/db/

# Step 4: Check server logs
npm start
# Look for: "Found X reference face images in database"

# Step 5: Check database
ls backend/face_recognition/db/*.jpg
```

## 💡 Tips for Best Results

1. **Database images**: Use multiple photos of each person
2. **Lighting**: Ensure consistent lighting between database and captures
3. **Angles**: Database images should match capture angles
4. **Resolution**: Higher resolution = better accuracy
5. **Single face**: Only one face per database image
6. **Professional photos**: ID photo quality works best

## 📊 Success Indicators

✅ **Working**:
- Python script outputs valid JSON
- Server logs show "Found X reference face images"
- Facial recognition completes in 5-10 seconds
- App displays match results
- No error messages

❌ **Not Working**:
- Python errors in console
- "JSON Parse error" messages
- Server won't start
- App crashes on facial recognition
- Timeout errors (> 30 seconds)

## 🆘 Get Help

1. Read **TROUBLESHOOTING.md** first
2. Check server logs for error messages
3. Verify Python installation: `python --version`
4. Verify DeepFace: `pip list | grep deepface`
5. Check database folder has images
6. Run manual Python test above

## 🔗 Useful Commands

```bash
# Test Python installation
python --version
python -c "from deepface import DeepFace; print('OK')"

# Check installed packages
pip list | grep deepface
pip list | grep tensorflow

# Install/upgrade packages
pip install --upgrade deepface tensorflow keras

# Test the Python script
python backend/face_recognition/recognizer.py db/test.jpg db/

# Check database
ls -la backend/face_recognition/db/

# View server logs while running
npm start
```

## 📝 Notes

- First run downloads ~200MB of AI models - this is normal
- Processing time varies based on CPU and database size
- Accuracy improves with better quality images
- Multiple captures of same person improves matching
- Keep database organized with clear naming

---

**Last Updated**: January 2, 2026
**Version**: 1.0
**Status**: Production Ready ✅
