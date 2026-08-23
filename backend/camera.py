# backend/camera.py
import cv2
import os

class Camera:
    def __init__(self):
        self.device = int(os.getenv('CAMERA_DEVICE', '0'))
        self.cap = None
        self._init_camera()
    
    def _init_camera(self):
        self.cap = cv2.VideoCapture(self.device)
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
        if self.cap:
            self.cap.release()