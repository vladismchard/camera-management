# backend/autofocus.py
import logging
import time

logger = logging.getLogger(__name__)

class AutoFocus:
    def __init__(self, camera, focus_detector):
        self.camera = camera
        self.detector = focus_detector
        self.focus_results = []
        
    def capture_series(self, num_steps=3, step_size=1):
        """
        Захватывает серию изображений на разных позициях Z
        
        Args:
            num_steps: количество шагов (если четное, среднее фото пропускается)
            step_size: размер шага по Z
        """
        self.focus_results = []
        
        # Вычисляем позиции для захвата
        if num_steps % 2 == 0:
            # Четное число - пропускаем среднее
            positions = []
            half = num_steps // 2
            for i in range(-half, 0):
                positions.append(i * step_size)
            for i in range(1, half + 1):
                positions.append(i * step_size)
        else:
            # Нечетное число - включая 0
            half = num_steps // 2
            positions = [(i - half) * step_size for i in range(num_steps)]
        
        logger.info(f"Starting autofocus with {num_steps} steps at positions: {positions}")
        
        current_z = 0  # Начальная позиция
        
        for idx, z_offset in enumerate(positions):
            z_position = current_z + z_offset
            
            logger.info(f"Step {idx + 1}/{len(positions)}: Capturing at Z={z_position:+d}")
            
            # Ждем стабилизации (имитация движения камеры)
            time.sleep(0.5)
            
            # Захватываем кадр
            frame = self.camera.capture_single()
            
            if frame is not None:
                # Вычисляем фокус
                variance = self.detector.calculate_variance(frame)
                
                result = {
                    'step': idx + 1,
                    'z_position': z_position,
                    'z_offset': z_offset,
                    'variance': float(variance),
                    'frame': frame.copy(),
                    'is_focused': bool(variance > self.detector.threshold)
                }
                
                self.focus_results.append(result)
                
                logger.info(f"  Z={z_position:+d}, Variance={variance:.2f}, Focused={result['is_focused']}")
            else:
                logger.error(f"Failed to capture frame at Z={z_position}")
        
        # Находим лучший результат
        if self.focus_results:
            best = max(self.focus_results, key=lambda x: x['variance'])
            logger.info(f"Best focus at Z={best['z_position']:+d} with variance={best['variance']:.2f}")
            return best
        
        return None
    
    def get_results(self):
        """Возвращает все результаты серии"""
        return [{
            'step': r['step'],
            'z_position': r['z_position'],
            'z_offset': r['z_offset'],
            'variance': r['variance'],
            'is_focused': r['is_focused']
        } for r in self.focus_results]
    
    def get_best_frame(self):
        """Возвращает кадр с лучшим фокусом"""
        if not self.focus_results:
            return None
        best = max(self.focus_results, key=lambda x: x['variance'])
        return best['frame']
    
    def get_best_result(self):
        """Возвращает полную информацию о лучшем результате"""
        if not self.focus_results:
            return None
        best = max(self.focus_results, key=lambda x: x['variance'])
        return {
            'step': best['step'],
            'z_position': best['z_position'],
            'z_offset': best['z_offset'],
            'variance': best['variance'],
            'is_focused': best['is_focused']
        }
    
    def clear(self):
        """Очищает результаты"""
        self.focus_results.clear()