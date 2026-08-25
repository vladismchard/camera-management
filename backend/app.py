# backend/app.py
from flask import Flask, Response, jsonify, send_file, request
from flask_cors import CORS
from camera import Camera
from focus_detector import FocusDetector
from image_stitcher import ImageStitcher
from autofocus import AutoFocus
import logging
import cv2
import os
import json
import numpy as np

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Кастомный encoder — конвертирует все numpy типы в Python native
class NumpyEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.integer):
            return int(obj)
        if isinstance(obj, np.floating):
            return float(obj)
        if isinstance(obj, np.bool_):
            return bool(obj)
        if isinstance(obj, np.ndarray):
            return obj.tolist()
        return super().default(obj)

app = Flask(__name__)
app.json_encoder = NumpyEncoder
CORS(app)

try:
    camera = Camera()
    detector = FocusDetector()
    stitcher = ImageStitcher()
    autofocus = AutoFocus(camera, detector)
    logger.info("All components initialized successfully")
except Exception as e:
    logger.error(f"Failed to initialize: {e}")
    camera = None
    detector = None
    stitcher = None
    autofocus = None

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
        return jsonify({'error': 'Camera not available'}), 503

    try:
        frame = camera.capture_single()
        if frame is None:
            return jsonify({'error': 'Failed to capture frame'}), 500

        focus_info = detector.check_focus(frame)

        if not focus_info['is_focused']:
            logger.info(f"Frame skipped — not focused, variance={focus_info['variance']:.2f}")
            return jsonify({
                'status': 'skipped',
                'reason': 'not_focused',
                'variance': float(focus_info['variance']),
                'threshold': float(focus_info['adaptive_threshold']),
                'count': stitcher.get_count()
            })

        stitcher.add_image(frame)
        count = stitcher.get_count()
        logger.info(f"Frame added, count={count}, variance={focus_info['variance']:.2f}")

        return jsonify({
            'status': 'success',
            'count': count,
            'variance': float(focus_info['variance'])
        })

    except Exception as e:
        logger.error(f"Error in capture: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/autofocus', methods=['POST'])
def run_autofocus():
    logger.info("Autofocus endpoint called")
    if autofocus is None:
        return jsonify({'error': 'Autofocus not available'}), 503

    try:
        data = request.get_json() or {}
        num_steps = int(data.get('num_steps', 3))
        step_size = int(data.get('step_size', 1))

        autofocus.clear()
        best = autofocus.capture_series(num_steps, step_size)

        if best is None:
            return jsonify({'error': 'Autofocus failed'}), 500

        results = autofocus.get_results()
        best_info = autofocus.get_best_result()

        return jsonify({
            'status': 'success',
            'results': results,
            'best': best_info,
            'total_steps': int(len(results))
        })

    except Exception as e:
        logger.error(f"Error in autofocus: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/autofocus/frame/<int:step>')
def get_autofocus_frame(step):
    if autofocus is None:
        return jsonify({'error': 'Autofocus not available'}), 503

    frame = autofocus.get_frame_by_step(step)
    if frame is None:
        return jsonify({'error': f'No frame for step {step}'}), 404

    _, buffer = camera.encode_frame(frame)
    return Response(buffer.tobytes(), mimetype='image/jpeg')

@app.route('/autofocus/best-frame')
def get_best_frame():
    if autofocus is None:
        return jsonify({'error': 'Autofocus not available'}), 503

    frame = autofocus.get_best_frame()
    if frame is None:
        return jsonify({'error': 'No autofocus results available'}), 404

    _, buffer = camera.encode_frame(frame)
    return Response(buffer.tobytes(), mimetype='image/jpeg')

@app.route('/stitch', methods=['POST'])
def stitch():
    count = stitcher.get_count()
    if count < 2:
        return jsonify({'error': f'Need at least 2 images, have {count}'}), 400

    method = request.args.get('method', 'horizontal')
    stitched, result = stitcher.stitch(method=method)

    if stitched is not None:
        return jsonify({
            'status': 'success',
            'filepath': result,
            'count': count,
            'method': method
        })
    return jsonify({'error': result}), 500

@app.route('/clear', methods=['POST'])
def clear():
    stitcher.clear()
    return jsonify({'status': 'success', 'count': 0})

@app.route('/count')
def count():
    return jsonify({'count': stitcher.get_count()})

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
        'autofocus': autofocus is not None,
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