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
        logger.info(f"Added image {len(self.images)}")
    
    def stitch(self):
        if len(self.images) < 2:
            logger.warning("Need at least 2 images to stitch")
            return None, "Need at least 2 images"
        
        try:
            stitcher = cv2.Stitcher_create(cv2.Stitcher_PANORAMA)
            status, stitched = stitcher.stitch(self.images)
            
            if status == cv2.Stitcher_OK:
                timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
                filename = f"welding_{timestamp}.jpg"
                filepath = os.path.join(self.output_dir, filename)
                cv2.imwrite(filepath, stitched)
                logger.info(f"Stitched {len(self.images)} images successfully: {filepath}")
                return stitched, filepath
            else:
                error_msg = self._get_error_message(status)
                logger.error(f"Stitching failed: {error_msg}")
                return None, error_msg
                
        except Exception as e:
            logger.error(f"Stitching error: {e}")
            return None, str(e)
    
    def _get_error_message(self, status):
        errors = {
            cv2.Stitcher_ERR_NEED_MORE_IMGS: "Need more images",
            cv2.Stitcher_ERR_HOMOGRAPHY_EST_FAIL: "Homography estimation failed",
            cv2.Stitcher_ERR_CAMERA_PARAMS_ADJUST_FAIL: "Camera parameters adjustment failed"
        }
        return errors.get(status, f"Unknown error: {status}")
    
    def clear(self):
        count = len(self.images)
        self.images.clear()
        logger.info(f"Cleared {count} images")
    
    def get_count(self):
        return len(self.images)