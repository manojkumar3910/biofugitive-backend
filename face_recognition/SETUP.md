# Face Recognition (DeepFace) Setup Guide

## Prerequisites
- Python 3.7 or higher installed
- Node.js backend running

## Installation Steps

### 1. Install Python Dependencies
Run the following command in the project root or virtual environment:

```bash
pip install deepface tensorflow keras
```

Or for a specific version:
```bash
pip install deepface==0.0.77 tensorflow==2.11.0 keras==2.11.0
```

### 2. Add Reference Face Images
Create a folder structure in the face_recognition directory:

```
biofugitive-backend/face_recognition/db/
├── person_1.jpg
├── john_doe.jpg
├── criminal_123.png
└── ...
```

**Important:**
- Use clear, well-lit face images
- Recommended image size: 500x500 pixels or larger
- Supported formats: .jpg, .jpeg, .png, .bmp
- One face per image
- Filename format: `personId_name.jpg` or `person_identifier.jpg`

### 3. Verify Python Path
Ensure Python is in your system PATH. Test by running:

```bash
python --version
```

or

```bash
python3 --version
```

### 4. Test the Script Manually

```bash
python face_recognition/recognizer.py face_recognition/db/test_image.jpg face_recognition/db
```

Expected output (JSON):
```json
{
  "match": true,
  "filename": "john_doe.jpg",
  "personIdentifier": "john_doe",
  "distance": 0.35,
  "confidence": 65.5,
  "matchedFilePath": "/path/to/john_doe.jpg"
}
```

## Troubleshooting

### Error: "Python is not found"
- Install Python from https://www.python.org/downloads/
- Ensure Python is added to PATH during installation
- On Windows, use `python` or `python3` command

### Error: "DeepFace library not found"
```bash
pip install deepface tf-keras
```

### Error: "No matching person found"
- Verify face images are in `face_recognition/db/` folder
- Check that image names are correct (.jpg, .jpeg, .png, .bmp)
- Ensure face is clearly visible in the image
- Try with a better quality image

### Error: "Face could not be detected"
- The image quality might be poor
- Face might be at an angle or partially obscured
- Use a clearer, front-facing image
- The app now shows an alert to remove masks/glasses before capture

### Script Takes Too Long
- DeepFace processing can take 10-30 seconds on first run (downloading models)
- Subsequent runs are faster (5-10 seconds)
- Reduce image size for faster processing

## Performance Tips

1. **Image Quality**: Use high-quality, well-lit face images
2. **Database Size**: Having 100+ reference images will increase processing time
3. **Server Resources**: DeepFace uses significant CPU and memory
4. **Lighting**: Ensure good lighting in both reference and capture images

## API Response Format

### Success Response
```json
{
  "matchFound": true,
  "matchedPerson": {
    "personId": "john_doe",
    "name": "John Doe",
    "matchedFile": "john_doe.jpg"
  },
  "confidence": 85.5,
  "distance": 0.35,
  "totalCompared": 10,
  "processingTime": 12500
}
```

### No Match Response
```json
{
  "matchFound": false,
  "message": "No matching person found in database.",
  "totalCompared": 10,
  "processingTime": 8200
}
```

## Verifying Backend Configuration

The backend automatically checks for:
1. Python script at: `backend/face_recognition/recognizer.py`
2. Database folder at: `backend/face_recognition/db/`
3. At least one face image in the database

Check the server logs for detailed error messages if issues occur.
