import sys
import json
import os
import warnings

# CRITICAL: Suppress ALL output before importing TensorFlow/DeepFace
# This prevents TensorFlow warnings from corrupting JSON output
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '3'
os.environ['TF_ENABLE_ONEDNN_OPTS'] = '0'
os.environ['CUDA_VISIBLE_DEVICES'] = '-1'  # Disable GPU to avoid CUDA messages

# Suppress all Python warnings
warnings.filterwarnings('ignore')

# Redirect stderr temporarily during imports to catch any stray output
import io
old_stderr = sys.stderr
sys.stderr = io.StringIO()

try:
    # Import TensorFlow first to catch its warnings
    import tensorflow as tf
    tf.get_logger().setLevel('ERROR')
    
    # Now import DeepFace
    from deepface import DeepFace
    import traceback
except ImportError as e:
    sys.stderr = old_stderr  # Restore stderr for error output
    error_json = {
        "error": "DeepFace library not found. Install with: pip install deepface tensorflow keras",
        "errorType": "IMPORT_ERROR",
        "details": str(e)
    }
    print(json.dumps(error_json))
    sys.exit(1)
finally:
    # Restore stderr
    sys.stderr = old_stderr

def main():
    # 1. Get arguments from Node.js
    if len(sys.argv) < 3:
        # Use default paths for testing
        script_dir = os.path.dirname(os.path.abspath(__file__))
        target_img_path = os.path.join(script_dir, "test.jpeg")
        db_path = os.path.join(script_dir, "db")
        # Log to stderr for debugging without affecting JSON output
        sys.stderr.write(f"Using default paths - Image: {target_img_path}, DB: {db_path}\n")
    else:
        target_img_path = sys.argv[1]  # The photo sent from the mobile app
        db_path = sys.argv[2]          # The folder containing known person photos

    # Validate inputs
    if not os.path.exists(target_img_path):
        error_json = {
            "error": f"Target image not found: {target_img_path}",
            "errorType": "IMAGE_NOT_FOUND"
        }
        print(json.dumps(error_json))
        sys.exit(1)
    
    if not os.path.exists(db_path):
        error_json = {
            "error": f"Database path not found: {db_path}",
            "errorType": "DB_PATH_NOT_FOUND"
        }
        print(json.dumps(error_json))
        sys.exit(1)
    
    # Check if db_path has any images
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.gif'}
    db_images = [f for f in os.listdir(db_path) 
                 if os.path.isfile(os.path.join(db_path, f)) 
                 and os.path.splitext(f)[1].lower() in image_extensions]
    
    if len(db_images) == 0:
        error_json = {
            "error": f"No images found in database path: {db_path}",
            "errorType": "NO_DB_IMAGES",
            "foundFiles": os.listdir(db_path)
        }
        print(json.dumps(error_json))
        sys.exit(1)

    try:
        # 2. Run the DeepFace algorithm
        # model_name="ArcFace": Best balance of speed and accuracy
        # enforce_detection=False: Prevents crashing if the face is blurry or partial
        sys.stderr.write(f"Starting DeepFace recognition on {len(db_images)} database images...\n")
        
        results = DeepFace.find(
            img_path=target_img_path,
            db_path=db_path, 
            model_name="ArcFace", 
            enforce_detection=False,
            silent=True
        )

        # 3. Process Results
        # DeepFace returns a list of pandas DataFrames. 
        # We check if the first dataframe has any rows.
        if len(results) > 0 and not results[0].empty:
            # Get the best match (first row)
            best_match = results[0].iloc[0]
            
            # The 'identity' column contains the full path of the matched file in the DB
            matched_file_path = best_match['identity']
            
            # Extract just the filename (e.g., "person_123.jpg")
            filename = os.path.basename(matched_file_path)
            
            # Extract person identifier from filename (assumes format: personId_name.jpg or personId.jpg)
            person_identifier = os.path.splitext(filename)[0]
            
            # Calculate confidence percentage (lower distance = higher confidence)
            distance = float(best_match['distance'])
            # ArcFace typically uses cosine distance, threshold around 0.68
            # Convert to percentage: 100% at distance 0, ~30% at threshold
            confidence = max(0, min(100, (1 - distance) * 100))

            # Return success JSON
            success_json = {
                "match": True,
                "filename": filename,
                "personIdentifier": person_identifier,
                "distance": round(distance, 4),
                "confidence": round(confidence, 2),
                "matchedFilePath": matched_file_path
            }
            print(json.dumps(success_json))
            sys.exit(0)
        else:
            # Return no match found
            no_match_json = {
                "match": False,
                "message": "No matching person found in database.",
                "confidence": 0
            }
            print(json.dumps(no_match_json))
            sys.exit(0)

    except Exception as e:
        # Handle any unexpected errors (corrupt file, no face detected, etc.)
        error_msg = str(e)
        error_type = "PROCESSING_ERROR"
        
        # Specific error handling
        if "Face could not be detected" in error_msg or "No face" in error_msg:
            error_type = "NO_FACE_DETECTED"
            error_msg = "No face detected in the image. Please ensure the face is clearly visible."
        elif "tensorflow" in error_msg.lower():
            error_type = "TENSORFLOW_ERROR"
            error_msg = "TensorFlow error. Ensure TensorFlow is properly installed: pip install tensorflow"
        elif "OutOfMemory" in error_msg:
            error_type = "OUT_OF_MEMORY"
            error_msg = "Out of memory. Try with smaller images or close other applications."
        
        error_json = {
            "error": error_msg,
            "errorType": error_type,
            "match": False
        }
        
        # Log full traceback to stderr for debugging
        sys.stderr.write(f"DeepFace error: {traceback.format_exc()}\n")
        
        print(json.dumps(error_json))
        sys.exit(1)

if __name__ == "__main__":
    main()
