# backend/focus_detector.py
import cv2
import numpy as np
from collections import deque

class FocusDetector:
    def __init__(self, history_size=10, baseline_size=50, threshold=100.0):
        self.history_size = history_size
        self.baseline_size = baseline_size
        self.fixed_threshold = threshold
        self.history = deque(maxlen=history_size)
        self.baseline_history = deque(maxlen=baseline_size)
        self.current_variance = 0.0
        self.adaptive_threshold = threshold
        self.is_focused = False

        # Коэффициенты адаптивного порога
        self.ADAPTIVE_COEFF = 0.75      # порог = baseline * 0.75
        self.RELATIVE_DROP_K = 0.6     # relative drop: variance < mean * 0.6 → blurred
        self.SCENE_CHANGE_FACTOR = 3.0  # сброс baseline при скачке > 3x

    def calculate_variance(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        laplacian = cv2.Laplacian(gray, cv2.CV_64F)
        return float(laplacian.var())

    def _update_adaptive_threshold(self, variance):
        # Проверяем резкое изменение сцены — сбрасываем baseline
        if len(self.baseline_history) >= 5:
            recent_mean = np.mean(list(self.baseline_history)[-5:])
            if recent_mean > 0 and variance > recent_mean * self.SCENE_CHANGE_FACTOR:
                self.baseline_history.clear()

        self.baseline_history.append(variance)

        if len(self.baseline_history) >= 10:
            baseline = np.mean(self.baseline_history)
            self.adaptive_threshold = baseline * self.ADAPTIVE_COEFF
        else:
            # Пока baseline не накоплен — используем фиксированный
            self.adaptive_threshold = self.fixed_threshold

    def _is_focused(self, variance):
        # Условие 1: абсолютный адаптивный порог
        above_threshold = variance > self.adaptive_threshold

        # Условие 2: relative drop — не падаем ниже 60% от baseline среднего
        if len(self.baseline_history) >= 10:
            baseline_mean = np.mean(self.baseline_history)
            relative_ok = variance >= baseline_mean * self.RELATIVE_DROP_K
        else:
            relative_ok = True

        return above_threshold and relative_ok

    def analyze(self, frame):
        variance = self.calculate_variance(frame)
        self._update_adaptive_threshold(variance)

        self.history.append(variance)
        self.current_variance = variance
        self.is_focused = self._is_focused(variance)

        annotated = self._annotate_frame(frame.copy())

        return {
            'variance': variance,
            'is_focused': self.is_focused,
            'annotated_frame': annotated
        }

    def check_focus(self, frame):
        """Проверяет фокус без обновления истории стрима — для capture/autofocus"""
        variance = self.calculate_variance(frame)
        self._update_adaptive_threshold(variance)
        return {
            'variance': variance,
            'is_focused': self._is_focused(variance),
            'adaptive_threshold': self.adaptive_threshold
        }

    def _annotate_frame(self, frame):
        color = (0, 255, 0) if self.is_focused else (0, 0, 255)
        status = "FOCUSED" if self.is_focused else "BLURRED"

        cv2.rectangle(frame, (10, 10), (340, 90), (0, 0, 0), -1)
        cv2.rectangle(frame, (10, 10), (340, 90), color, 2)
        cv2.putText(frame, status, (20, 52),
                    cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 2)
        cv2.putText(frame, f"Variance: {self.current_variance:.2f}",
                    (20, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
        cv2.putText(frame, f"Threshold: {self.adaptive_threshold:.2f}",
                    (20, 86), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (200, 200, 200), 1)

        return frame

    def get_metrics(self):
        history_list = [float(v) for v in self.history]
        return {
            'current_variance': float(self.current_variance),
            'is_focused': bool(self.is_focused),
            'threshold': float(self.adaptive_threshold),
            'fixed_threshold': float(self.fixed_threshold),
            'history': history_list,
            'avg_variance': float(np.mean(self.history)) if self.history else 0.0,
            'history_size': int(len(self.history)),
            'baseline_size': int(len(self.baseline_history)),
            'adaptive_mode': len(self.baseline_history) >= 10
        }