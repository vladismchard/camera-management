# backend/focus_detector.py
import cv2
import numpy as np
import logging

logger = logging.getLogger(__name__)

class FocusDetector:
    def __init__(self, base_threshold=100.0, sensitivity=1.0):
        """
        Args:
            base_threshold: Базовый порог variance для определения фокуса
            sensitivity: Множитель для адаптивного порога (0.1-1.5, 1.0 = 100%)
        """
        self.base_threshold = base_threshold
        self.sensitivity = sensitivity
        self.variance_history = []
        self.max_history = 50

    def set_threshold(self, base_threshold, sensitivity=None):
        """Изменить порог фокуса"""
        self.base_threshold = base_threshold
        if sensitivity is not None:
            self.sensitivity = sensitivity
        logger.info(f"Threshold updated: base={base_threshold}, sensitivity={sensitivity}")

    def get_threshold_config(self):
        """Получить текущую конфигурацию порога"""
        return {
            'base_threshold': float(self.base_threshold),
            'sensitivity': float(self.sensitivity)
        }

    def calculate_variance(self, frame):
        """Вычислить variance of Laplacian для оценки фокуса"""
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        variance = laplacian.var()
        return variance

    def check_focus(self, frame):
        """Проверить фокус кадра"""
        variance = self.calculate_variance(frame)
        
        # Добавляем в историю
        self.variance_history.append(variance)
        if len(self.variance_history) > self.max_history:
            self.variance_history.pop(0)
        
        # Вычисляем адаптивный порог
        if len(self.variance_history) >= 5:
            avg_variance = np.mean(self.variance_history)
            adaptive_threshold = max(self.base_threshold, avg_variance * self.sensitivity)
        else:
            adaptive_threshold = self.base_threshold
        
        is_focused = variance > adaptive_threshold
        
        return {
            'variance': float(variance),
            'is_focused': bool(is_focused),
            'adaptive_threshold': float(adaptive_threshold),
            'avg_variance': float(np.mean(self.variance_history)) if self.variance_history else 0.0
        }

    def get_metrics(self):
        """Получить текущие метрики"""
        current_variance = self.variance_history[-1] if self.variance_history else 0.0
        avg_variance = np.mean(self.variance_history) if self.variance_history else 0.0
        
        adaptive_threshold = max(
            self.base_threshold,
            avg_variance * self.sensitivity
        ) if len(self.variance_history) >= 5 else self.base_threshold
        
        is_focused = current_variance > adaptive_threshold
        
        return {
            'current_variance': float(current_variance),
            'avg_variance': float(avg_variance),
            'adaptive_threshold': float(adaptive_threshold),
            'base_threshold': float(self.base_threshold),
            'sensitivity': float(self.sensitivity),
            'is_focused': bool(is_focused),
            'history_size': len(self.variance_history),
            'history': [float(v) for v in self.variance_history[-20:]]
        }

    def clear_history(self):
        """Очистить историю variance"""
        self.variance_history.clear()