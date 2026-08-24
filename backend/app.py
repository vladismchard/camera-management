# backend/app.py
from flask import Flask, Response, jsonify, send_file, request
from flask_cors import CORS
from camera import Camera
from focus_detector import FocusDetector
from image_stitcher import ImageStitcher
import logging
import cv2
import os

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

try:
    camera = Camera()
    detector = FocusDetector()
    stitcher = ImageStitcher()
    logger.info("Camera, detector and stitcher initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize: {e}")
    camera = None
    detector = None
    stitcher = None

@app.route('/stream')
def stream():
    if camera is None:
        return jsonify({'error': 'Camera not available'}), 503
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/metrics')
def metrics():
    if detector is None:
        return jsonify({'error': 'Detector not available'}), 503
    return jsonify(detector.get_metrics())

@app.route('/capture', methods=['POST'])
def capture():
    logger.info("Capture endpoint called")
    if camera is None:
        logger.error("Camera not available")
        return jsonify({'error': 'Camera not available'}), 503
    
    try:
        frame = camera.capture_single()
        logger.info(f"Frame captured: {frame is not None}, shape: {frame.shape if frame is not None else 'None'}")
        
        if frame is not None:
            stitcher.add_image(frame)
            count = stitcher.get_count()
            logger.info(f"Image added to stitcher, total count: {count}")
            return jsonify({
                'status': 'success',
                'count': count
            })
        else:
            logger.error("Failed to capture frame")
            return jsonify({'error': 'Failed to capture frame'}), 500
    except Exception as e:
        logger.error(f"Error in capture: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/stitch', methods=['POST'])
def stitch():
    count = stitcher.get_count()
    logger.info(f"Stitch endpoint called with {count} images")
    
    if count < 2:
        logger.warning(f"Not enough images: {count}")
        return jsonify({'error': f'Need at least 2 images, have {count}'}), 400
    
    stitched, result = stitcher.stitch()
    if stitched is not None:
        return jsonify({
            'status': 'success',
            'filepath': result,
            'count': count
        })
    return jsonify({'error': result}), 500

@app.route('/clear', methods=['POST'])
def clear():
    logger.info("Clear endpoint called")
    stitcher.clear()
    return jsonify({'status': 'success', 'count': 0})

@app.route('/count')
def count():
    count = stitcher.get_count()
    return jsonify({'count': count})

@app.route('/stitched/<filename>')
def get_stitched(filename):
    filepath = os.path.join('stitched', filename)
    if os.path.exists(filepath):
        return send_file(filepath, mimetype='image/jpeg')
    return jsonify({'error': 'File not found'}), 404

@app.route('/health')
def health():
    return jsonify({
        'status': 'ok' if camera is not None else 'error',
        'camera': camera is not None,
        'detector': detector is not None,
        'stitcher': stitcher is not None,
        'image_count': stitcher.get_count() if stitcher else 0
    })

def generate_frames():
    try:
        for frame in camera.capture_stream():
            result = detector.analyze(frame)
            _, buffer = camera.encode_frame(result['annotated_frame'])
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')
    except Exception as e:
        logger.error(f"Error generating frames: {e}")

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)