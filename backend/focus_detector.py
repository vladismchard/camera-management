# backend/focus_detector.py
import cv2
import numpy as np
from collections import deque

class FocusDetector:
    def __init__(self, history_size=10, threshold=100.0):
        self.history_size = history_size
        self.threshold = threshold
        self.history = deque(maxlen=history_size)
        self.current_variance = 0.0
        self.is_focused = False
    
    def calculate_variance(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        return float(laplacian.var())
    
    def analyze(self, frame):
        variance = self.calculate_variance(frame)
        self.history.append(variance)
        self.current_variance = variance
        self.is_focused = bool(variance > self.threshold)
        
        annotated = self._annotate_frame(frame.copy())
        
        return {
            'variance': variance,
            'is_focused': self.is_focused,
            'annotated_frame': annotated
        }
    
    def _annotate_frame(self, frame):
        color = (0, 255, 0) if self.is_focused else (0, 0, 255)
        status = "FOCUSED" if self.is_focused else "BLURRED"
        
        cv2.rectangle(frame, (10, 10), (300, 80), (0, 0, 0), -1)
        cv2.rectangle(frame, (10, 10), (300, 80), color, 2)
        cv2.putText(frame, status, (20, 50), cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 2)
        cv2.putText(frame, f"Variance: {self.current_variance:.2f}", (20, 75), 
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        
        return frame
    
    def get_metrics(self):
        history_list = [float(v) for v in self.history]
        return {
            'current_variance': float(self.current_variance),
            'is_focused': bool(self.is_focused),
            'threshold': float(self.threshold),
            'history': history_list,
            'avg_variance': float(np.mean(self.history)) if self.history else 0.0,
            'history_size': int(len(self.history))
        } 