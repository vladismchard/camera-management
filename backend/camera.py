# backend/camera.py
import cv2
import os
import re

class Camera:
    def __init__(self):
        self.cap = None
        self.device = self._parse_device(os.getenv('CAMERA_DEVICE', '0'))
        self._init_camera()
    
    def _parse_device(self, device_str):
        if device_str.startswith('/dev/video'):
            match = re.search(r'\d+$', device_str)
            return int(match.group()) if match else 0
        return int(device_str)
    
    def _init_camera(self):
        self.cap = cv2.VideoCapture(self.device)
        if not self.cap.isOpened():
            raise RuntimeError(f"Cannot open camera device {self.device}")
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
    
    def capture_stream(self):
        while True:
            success, frame = self.cap.read()
            if success:
                yield frame
    
    def capture_single(self):
        success, frame = self.cap.read()
        return frame if success else None
    
    def encode_frame(self, frame, quality=85):
        return cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    
    def __del__(self):
        if self.cap is not None:
            self.cap.release()