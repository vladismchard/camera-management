# backend/image_stitcher.py
import cv2
import numpy as np
import logging
from datetime import datetime
import os

logger = logging.getLogger(__name__)

class ImageStitcher:
    def __init__(self, output_dir='stitched'):
        self.images = []
        self.output_dir = output_dir
        os.makedirs(output_dir, exist_ok=True)
        logger.info(f"ImageStitcher initialized, output dir: {output_dir}")
    
    def add_image(self, frame):
        self.images.append(frame.copy())
        logger.info(f"Added image {len(self.images)}, shape: {frame.shape}")
    
    def stitch(self, method='panorama'):
        if len(self.images) < 2:
            logger.warning("Need at least 2 images to stitch")
            return None, "Need at least 2 images"
        
        logger.info(f"Starting stitching with {len(self.images)} images using {method} method")
        
        if method == 'panorama':
            return self._stitch_panorama()
        elif method == 'vertical':
            return self._stitch_vertical()
        elif method == 'horizontal':
            return self._stitch_horizontal()
        else:
            return self._stitch_simple()
    
    def _stitch_panorama(self):
        """Использует OpenCV Stitcher для создания панорамы"""
        try:
            stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
            status, stitched = stitcher.stitch(self.images)
            
            if status == cv2.Stitcher_OK:
                filepath = self._save_image(stitched, 'panorama')
                logger.info(f"Panorama stitched successfully: {filepath}")
                return stitched, filepath
            else:
                error_msg = self._get_error_message(status)
                logger.warning(f"Panorama stitching failed: {error_msg}, trying simple concatenation")
                return self._stitch_simple()
                
        except Exception as e:
            logger.error(f"Panorama stitching error: {e}, falling back to simple method")
            return self._stitch_simple()
    
    def _stitch_vertical(self):
        """Вертикальная конкатенация изображений"""
        try:
            # Находим максимальную ширину
            max_width = max(img.shape[1] for img in self.images)
            
            # Масштабируем все изображения до одинаковой ширины
            resized = []
            for img in self.images:
                if img.shape[1] != max_width:
                    scale = max_width / img.shape[1]
                    new_height = int(img.shape[0] * scale)
                    img = cv2.resize(img, (max_width, new_height))
                resized.append(img)
            
            # Конкатенация по вертикали
            stitched = np.vstack(resized)
            filepath = self._save_image(stitched, 'vertical')
            logger.info(f"Vertical stitching successful: {filepath}")
            return stitched, filepath
            
        except Exception as e:
            logger.error(f"Vertical stitching error: {e}")
            return None, str(e)
    
    def _stitch_horizontal(self):
        """Горизонтальная конкатенация изображений"""
        try:
            # Находим максимальную высоту
            max_height = max(img.shape[0] for img in self.images)
            
            # Масштабируем все изображения до одинаковой высоты
            resized = []
            for img in self.images:
                if img.shape[0] != max_height:
                    scale = max_height / img.shape[0]
                    new_width = int(img.shape[1] * scale)
                    img = cv2.resize(img, (new_width, max_height))
                resized.append(img)
            
            # Конкатенация по горизонтали
            stitched = np.hstack(resized)
            filepath = self._save_image(stitched, 'horizontal')
            logger.info(f"Horizontal stitching successful: {filepath}")
            return stitched, filepath
            
        except Exception as e:
            logger.error(f"Horizontal stitching error: {e}")
            return None, str(e)
    
    def _stitch_simple(self):
        """Простая сетка изображений"""
        try:
            num_images = len(self.images)
            
            # Определяем размер сетки
            cols = int(np.ceil(np.sqrt(num_images)))
            rows = int(np.ceil(num_images / cols))
            
            logger.info(f"Creating {rows}x{cols} grid for {num_images} images")
            
            # Находим размер для всех изображений
            target_height = self.images[0].shape[0]
            target_width = self.images[0].shape[1]
            
            # Масштабируем все изображения
            resized = []
            for img in self.images:
                img_resized = cv2.resize(img, (target_width, target_height))
                resized.append(img_resized)
            
            # Добавляем пустые изображения если нужно
            while len(resized) < rows * cols:
                resized.append(np.zeros_like(resized[0]))
            
            # Создаем сетку
            grid_rows = []
            for r in range(rows):
                row_images = resized[r * cols:(r + 1) * cols]
                grid_row = np.hstack(row_images)
                grid_rows.append(grid_row)
            
            stitched = np.vstack(grid_rows)
            filepath = self._save_image(stitched, 'grid')
            logger.info(f"Grid stitching successful: {filepath}")
            return stitched, filepath
            
        except Exception as e:
            logger.error(f"Grid stitching error: {e}")
            return None, str(e)
    
    def _save_image(self, image, method):
        timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        filename = f"welding_{method}_{timestamp}.jpg"
        filepath = os.path.join(self.output_dir, filename)
        cv2.imwrite(filepath, image, [cv2.IMWRITE_JPEG_QUALITY, 95])
        return filepath
    
    def _get_error_message(self, status):
        errors = {
            cv2.Stitcher_ERR_NEED_MORE_IMGS: "Need more images",
            cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: "Homography estimation failed - images don't overlap enough",
            cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: "Camera parameters adjustment failed"
        }
        return errors.get(status, f"Unknown error: {status}")
    
    def clear(self):
        count = len(self.images)
        self.images.clear()
        logger.info(f"Cleared {count} images")
    
    def get_count(self):
        return len(self.images)