# backend/app.py
from flask import Flask, Response, jsonify, send_file, request
from flask_cors import CORS
from camera import Camera
from focus_detector import FocusDetector
from image_stitcher import ImageStitcher
from autofocus import AutoFocus
import logging
import threading
import cv2
import os
import json
import numpy as np

auto_focus_mode = False
autofocus_status = {'running': False, 'total_steps': 0}

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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


def _annotate_frame(frame, focus_info):
    """Добавляет аннотации фокуса на кадр"""
    annotated = frame.copy()
    h, w = annotated.shape[:2]
    
    # Определяем цвет и текст статуса
    is_focused = focus_info['is_focused']
    color = (0, 255, 0) if is_focused else (0, 0, 255)  # BGR: зелёный/красный
    status_text = "FOCUSED" if is_focused else "BLURRED"
    
    # Рисуем полупрозрачный фон для текста
    overlay = annotated.copy()
    cv2.rectangle(overlay, (10, 10), (300, 100), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.6, annotated, 0.4, 0, annotated)
    
    # Добавляем текст статуса
    cv2.putText(annotated, status_text, (20, 50), 
                cv2.FONT_HERSHEY_SIMPLEX, 1.2, color, 3)
    
    # Добавляем метрики
    variance_text = f"Variance: {focus_info['variance']:.2f}"
    threshold_text = f"Threshold: {focus_info['adaptive_threshold']:.2f}"
    
    cv2.putText(annotated, variance_text, (20, 80), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    cv2.putText(annotated, threshold_text, (20, 95), 
                cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 255, 255), 1)
    
    return annotated


def generate_frames():
    """Generate video frames with optional focus detection overlay"""
    if camera is None:
        logger.error("Camera not available for streaming")
        return
    
    try:
        for frame in camera.capture_stream():
            if frame is None:
                continue
            
            # Проверяем фокус только если включен auto_mode
            if auto_focus_mode:
                focus_info = detector.check_focus(frame)
                annotated_frame = _annotate_frame(frame, focus_info)
            else:
                # В ручном режиме просто показываем кадр
                annotated_frame = frame
            
            ret, buffer = cv2.imencode('.jpg', annotated_frame)
            if ret:
                frame_bytes = buffer.tobytes()
                yield (b'--frame\r\n'
                       b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
    except Exception as e:
        logger.error(f"Error in frame generation: {e}", exc_info=True)


@app.route('/stream')
def stream():
    if camera is None:
        return jsonify({'error': 'Камера недоступна'}), 503
    return Response(
        generate_frames(),
        mimetype='multipart/x-mixed-replace; boundary=frame'
    )


@app.route('/metrics')
def metrics():
    if detector is None:
        return jsonify({'error': 'Детектор недоступен'}), 503
    return jsonify(detector.get_metrics())


@app.route('/capture', methods=['POST'])
def capture():
    logger.info("Capture endpoint called")
    if camera is None:
        return jsonify({'error': 'Камера недоступна'}), 503

    try:
        frame = camera.capture_single()
        if frame is None:
            return jsonify({'error': 'Не удалось захватить кадр'}), 500

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
        return jsonify({'error': 'Автофокус недоступен'}), 503

    if autofocus_status['running']:
        return jsonify({'error': 'Автофокус уже выполняется'}), 409

    try:
        data = request.get_json() or {}
        num_steps = int(data.get('num_steps', 3))
        step_size = int(data.get('step_size', 1))

        autofocus_status['running'] = True
        autofocus_status['total_steps'] = num_steps

        def worker():
            try:
                autofocus.clear()
                autofocus.capture_series(num_steps, step_size)
            except Exception as e:
                logger.error(f"Error in autofocus worker: {e}", exc_info=True)
            finally:
                autofocus_status['running'] = False

        threading.Thread(target=worker, daemon=True).start()

        return jsonify({
            'status': 'started',
            'total_steps': int(num_steps)
        })

    except Exception as e:
        logger.error(f"Error starting autofocus: {e}", exc_info=True)
        autofocus_status['running'] = False
        return jsonify({'error': str(e)}), 500


@app.route('/autofocus/progress')
def autofocus_progress():
    if autofocus is None:
        return jsonify({'error': 'Автофокус недоступен'}), 503

    results = autofocus.get_results()
    best = autofocus.get_best_result()

    return jsonify({
        'status': 'success',
        'running': bool(autofocus_status['running']),
        'results': results,
        'best': best,
        'total_steps': int(len(results)),
        'expected_steps': int(autofocus_status['total_steps'])
    })


@app.route('/autofocus/frame/<int:step>')
def get_autofocus_frame(step):
    if autofocus is None:
        return jsonify({'error': 'Автофокус недоступен'}), 503

    frame = autofocus.get_frame_by_step(step)
    if frame is None:
        return jsonify({'error': f'Нет кадра для шага {step}'}), 404

    _, buffer = camera.encode_frame(frame)
    return Response(buffer.tobytes(), mimetype='image/jpeg')


@app.route('/autofocus/best-frame')
def get_best_frame():
    if autofocus is None:
        return jsonify({'error': 'Автофокус недоступен'}), 503

    frame = autofocus.get_best_frame()
    if frame is None:
        return jsonify({'error': 'Нет результатов автофокуса'}), 404

    _, buffer = camera.encode_frame(frame)
    return Response(buffer.tobytes(), mimetype='image/jpeg')


@app.route('/stitch', methods=['POST'])
def stitch():
    count = stitcher.get_count()
    if count < 2:
        return jsonify({'error': f'Нужно минимум 2 изображения, сейчас {count}'}), 400

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
    return jsonify({'error': 'Файл не найден'}), 404


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


@app.route('/focus/mode', methods=['GET'])
def get_focus_mode():
    """Получить текущий режим проверки фокуса"""
    return jsonify({
        'status': 'success',
        'auto_mode': auto_focus_mode
    })


@app.route('/focus/mode', methods=['POST'])
def set_focus_mode():
    """Установить режим проверки фокуса"""
    global auto_focus_mode
    try:
        data = request.get_json()
        auto_focus_mode = data.get('auto_mode', False)
        logger.info(f"Focus mode changed to: {'AUTO' if auto_focus_mode else 'MANUAL'}")
        return jsonify({
            'status': 'success',
            'auto_mode': auto_focus_mode
        })
    except Exception as e:
        logger.error(f"Error setting focus mode: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/focus/check', methods=['POST'])
def check_focus_manual():
    """Ручная проверка фокуса без обновления истории стрима"""
    if camera is None:
        return jsonify({'error': 'Камера недоступна'}), 503
    
    try:
        frame = camera.capture_single()
        if frame is None:
            return jsonify({'error': 'Не удалось захватить кадр'}), 500
        
        focus_info = detector.check_focus(frame)
        
        return jsonify({
            'status': 'success',
            'is_focused': bool(focus_info['is_focused']),
            'variance': float(focus_info['variance']),
            'adaptive_threshold': float(focus_info['adaptive_threshold'])
        })
    except Exception as e:
        logger.error(f"Error in check_focus_manual: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500
@app.route('/focus/threshold', methods=['GET'])
def get_threshold():
    """Получить текущие настройки порога"""
    if detector is None:
        return jsonify({'error': 'Детектор недоступен'}), 503
    
    config = detector.get_threshold_config()
    return jsonify({
        'status': 'success',
        **config
    })


@app.route('/focus/threshold', methods=['POST'])
def set_threshold():
    """Установить новые настройки порога"""
    if detector is None:
        return jsonify({'error': 'Детектор недоступен'}), 503
    
    try:
        data = request.get_json()
        base_threshold = float(data.get('base_threshold', 100.0))
        sensitivity = float(data.get('sensitivity', 0.7))
        
        # Валидация
        if base_threshold < 0:
            return jsonify({'error': 'Базовый порог должен быть >= 0'}), 400
        if not (0.1 <= sensitivity <= 1.5):
            return jsonify({'error': 'Чувствительность должна быть в диапазоне 0.1–1.5'}), 400
        
        detector.set_threshold(base_threshold, sensitivity)
        
        return jsonify({
            'status': 'success',
            'base_threshold': base_threshold,
            'sensitivity': sensitivity
        })
    except Exception as e:
        logger.error(f"Error setting threshold: {e}")
        return jsonify({'error': str(e)}), 500
if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)