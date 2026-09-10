# backend/camera.py
import cv2
import os
import re
import threading
import time

class Camera:
    def __init__(self):
        self.cap = None
        self.device = self._parse_device(os.getenv('CAMERA_DEVICE', '0'))
        
        # Переменные для фонового потока
        self.current_frame = None
        self.is_running = True
        self.lock = threading.Lock()
        
        self._init_camera()
        
        # Запускаем фоновое чтение кадров
        self.thread = threading.Thread(target=self._update_frame, daemon=True)
        self.thread.start()
        
        # Ждем, пока появится первый кадр
        time.sleep(1.0)
    
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
    
    def _update_frame(self):
        """Фоновый поток, который постоянно вычитывает камеру, опустошая буфер"""
        while self.is_running:
            if self.cap is not None and self.cap.isOpened():
                success, frame = self.cap.read()
                if success:
                    with self.lock:
                        self.current_frame = frame
            time.sleep(0.01) 
    
    def capture_stream(self):
        """Возвращает кадры для видеотрансляции на сайте"""
        while True:
            with self.lock:
                frame = self.current_frame.copy() if self.current_frame is not None else None
            
            if frame is not None:
                yield frame
            
            time.sleep(0.05) # ~20 FPS для потока
    
    def capture_single(self):
        """Возвращает самый свежий кадр мгновенно"""
        with self.lock:
            if self.current_frame is not None:
                return self.current_frame.copy()
        return None
    
    def encode_frame(self, frame, quality=85):
        return cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
    
    def __del__(self):
        self.is_running = False
        if hasattr(self, 'thread'):
            self.thread.join(timeout=1.0)
        if self.cap is not None:
            self.cap.release()