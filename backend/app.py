# backend/app.py
from flask import Flask, Response, jsonify
from flask_cors import CORS
from camera import Camera
from focus_detector import FocusDetector
import json

app = Flask(__name__)
CORS(app)

camera = Camera()
detector = FocusDetector()

@app.route('/stream')
def stream():
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )

@app.route('/metrics')
def metrics():
    return jsonify(detector.get_metrics())

def generate_frames():
    for frame in camera.capture_stream():
        result = detector.analyze(frame)
        _, buffer = camera.encode_frame(result['annotated_frame'])
        yield (b'--frame\r\n'
               b'Content-Type: image/jpeg\r\n\r\n' + buffer.tobytes() + b'\r\n')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)