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
        self.focus_results = []

        if num_steps % 2 == 0:
            half = num_steps // 2
            positions = list(range(-half, 0)) + list(range(1, half + 1))
            positions = [p * step_size for p in positions]
        else:
            half = num_steps // 2
            positions = [(i - half) * step_size for i in range(num_steps)]

        logger.info(f"Starting autofocus: {num_steps} steps at positions {positions}")

        current_z = 0

        for idx, z_offset in enumerate(positions):
            z_position = current_z + z_offset
            logger.info(f"Step {idx+1}/{len(positions)}: Z={z_position:+d}")

            time.sleep(0.5)

            frame = self.camera.capture_single()

            if frame is not None:
                focus_info = self.detector.check_focus(frame)
                variance = focus_info['variance']

                result = {
                    'step': idx + 1,
                    'z_position': z_position,
                    'z_offset': z_offset,
                    'variance': float(variance),
                    'frame': frame.copy(),
                    'is_focused': focus_info['is_focused'],
                    'adaptive_threshold': focus_info['adaptive_threshold']
                }

                self.focus_results.append(result)
                logger.info(f"  Z={z_position:+d}, Variance={variance:.2f}, "
                           f"Focused={result['is_focused']}")
            else:
                logger.error(f"Failed to capture at Z={z_position}")

        if self.focus_results:
            best = max(self.focus_results, key=lambda x: x['variance'])
            logger.info(f"Best: Z={best['z_position']:+d}, variance={best['variance']:.2f}")
            return best

        return None

    def get_results(self):
        return [{
            'step': r['step'],
            'z_position': r['z_position'],
            'z_offset': r['z_offset'],
            'variance': r['variance'],
            'is_focused': r['is_focused'],
            'adaptive_threshold': r['adaptive_threshold']
        } for r in self.focus_results]

    def get_best_frame(self):
        if not self.focus_results:
            return None
        best = max(self.focus_results, key=lambda x: x['variance'])
        return best['frame']

    def get_frame_by_step(self, step):
        """Возвращает кадр по номеру шага"""
        for r in self.focus_results:
            if r['step'] == step:
                return r['frame']
        return None

    def get_best_result(self):
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
        self.focus_results.clear()