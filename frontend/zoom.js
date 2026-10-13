class ImageZoomPan {
    constructor(imageElement) {
        if (!imageElement) return;
        this.img = imageElement;
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.panning = false;
        this.startX = 0;
        this.startY = 0;
        this.baseW = 1280;
        this.baseH = 720;
        this.currentBackendCrop = { x: 0, y: 0, w: 1280, h: 720 };
        this.actualImageW = 1280;
        this.actualImageH = 720;
        this.zoomTimeout = null;
        this.finalZoomTimeout = null;
        this.waitingForCrop = false;
        this.currentCropArea = null;
        this.isResetting = false;
        
        this._wrapImage();
        this._initEvents();
        console.log(`[Zoom] Инициализация. Базовое разрешение: ${this.baseW}x${this.baseH}`);
    }

    _wrapImage() {
        const parent = this.img.parentElement;
        if (!parent.classList.contains('zoom-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'zoom-wrapper';
            parent.insertBefore(wrapper, this.img);
            wrapper.appendChild(this.img);
        }
        this.wrapper = this.img.parentElement;
        const initialWidth = this.img.clientWidth || 800;
        const initialHeight = this.img.clientHeight || 450;
        Object.assign(this.wrapper.style, {
            overflow: 'hidden',
            position: 'relative',
            cursor: 'grab',
            userSelect: 'none',
            display: 'block',
            width: `${initialWidth}px`,
            height: `${initialHeight}px`,
            minWidth: `${initialWidth}px`,
            minHeight: `${initialHeight}px`
        });
        this.img.style.transformOrigin = '0 0';
        this.img.style.pointerEvents = 'none';
        this.img.style.display = 'block';
        this.img.style.width = '100%';
        this.img.style.height = '100%';
        this.img.style.objectFit = 'contain';
        console.log(`[Zoom] Wrapper зафиксирован: ${initialWidth}×${initialHeight}`);
    }

    _initEvents() {
        this.wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            if (this.waitingForCrop || this.isResetting) {
                console.log('[Zoom] Wheel заблокирован: ожидание применения crop');
                return;
            }
            
            const rect = this.wrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            const xs = (mouseX - this.pointX) / this.scale;
            const ys = (mouseY - this.pointY) / this.scale;
            const factor = e.deltaY < 0 ? 1.05 : 1 / 1.05;
            let newScale = this.scale * factor;
            newScale = Math.max(1, Math.min(10, newScale));
            console.log(`[Zoom] Wheel: oldScale=${this.scale.toFixed(2)}, newScale=${newScale.toFixed(2)}, deltaY=${e.deltaY}`);
            this.scale = newScale;
            this.pointX = mouseX - xs * this.scale;
            this.pointY = mouseY - ys * this.scale;
            this._clamp();
            this._applyTransform();
        }, { passive: false });

        this.wrapper.addEventListener('mousedown', (e) => {
            if (this.scale <= 1) return;
            e.preventDefault();
            this.panning = true;
            this.startX = e.clientX - this.pointX;
            this.startY = e.clientY - this.pointY;
            this.wrapper.style.cursor = 'grabbing';
            console.log(`[Zoom] Pan start: scale=${this.scale.toFixed(2)}, pos=(${this.pointX.toFixed(0)}, ${this.pointY.toFixed(0)})`);
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.panning) return;
            this.pointX = e.clientX - this.startX;
            this.pointY = e.clientY - this.startY;
            this._clamp();
            this._applyTransform();
        });

        window.addEventListener('mouseup', () => {
            if (!this.panning) return;
            this.panning = false;
            this.wrapper.style.cursor = this.scale > 1 ? 'grab' : 'default';
            console.log(`[Zoom] Pan end: pos=(${this.pointX.toFixed(0)}, ${this.pointY.toFixed(0)})`);
        });

        this.wrapper.addEventListener('dblclick', () => {
            console.log('[Zoom] Double click: сброс зума');
            this._resetZoom();
        });

        this.img.addEventListener('load', () => {
            console.log(`[Zoom] Изображение загружено: naturalWidth=${this.img.naturalWidth}, naturalHeight=${this.img.naturalHeight}, clientWidth=${this.img.clientWidth}, clientHeight=${this.img.clientHeight}`);
        });
    }

    _clamp() {
        const ww = this.wrapper.clientWidth;
        const wh = this.wrapper.clientHeight;
        const iw = this.img.clientWidth * this.scale;
        const ih = this.img.clientHeight * this.scale;
        const minX = Math.min(0, ww - iw);
        const minY = Math.min(0, wh - ih);
        const oldX = this.pointX;
        const oldY = this.pointY;
        this.pointX = Math.min(0, Math.max(minX, this.pointX));
        this.pointY = Math.min(0, Math.max(minY, this.pointY));
        if (oldX !== this.pointX || oldY !== this.pointY) {
            console.log(`[Zoom] Clamp: (${oldX.toFixed(0)}, ${oldY.toFixed(0)}) → (${this.pointX.toFixed(0)}, ${this.pointY.toFixed(0)})`);
        }
    }

    _applyTransform() {
        this.img.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
        if (this.zoomTimeout) clearTimeout(this.zoomTimeout);
        if (this.finalZoomTimeout) clearTimeout(this.finalZoomTimeout);
        
        if (this.isResetting) {
            console.log('[Zoom] Сброс уже выполняется, новый таймер не ставится');
            return;
        }
        
        if (this.waitingForCrop) {
            console.log('[Zoom] Ожидание применения предыдущего crop, отправка блокирована');
            return;
        }

        if (Math.abs(this.scale - 1) < 0.01) {
            console.log('[Zoom] Scale ≈ 1, отправка сброса через 500ms');
            this.zoomTimeout = setTimeout(() => {
                this._sendResetToBackend();
            }, 500);
            return;
        }

        console.log(`[Zoom] Scale=${this.scale.toFixed(2)}, отправка crop через 800ms`);
        this.finalZoomTimeout = setTimeout(() => {
            this._sendZoomToBackend();
        }, 800);
    }

    _resetZoom() {
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.img.style.transition = 'transform 0.25s ease';
        this._applyTransform();
        setTimeout(() => {
            this.img.style.transition = '';
        }, 260);
        this.wrapper.style.cursor = 'default';
    }

    _sendResetToBackend() {
        console.log('[Zoom] Отправка сброса crop на бэкенд: x=0, y=0, w=1280, h=720');
        
        if (this.currentBackendCrop.x === 0 && 
            this.currentBackendCrop.y === 0 && 
            this.currentBackendCrop.w === this.baseW && 
            this.currentBackendCrop.h === this.baseH) {
            console.log('[Zoom] Бэкенд уже сброшен, отправка не нужна');
            return;
        }
        
        this.isResetting = true;
        this.waitingForCrop = true;
        this.currentCropArea = { x: 0, y: 0, w: this.baseW, h: this.baseH };
        
        fetch(`${window.location.protocol}//${window.location.hostname}:5000/set_zoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: 0, y: 0, w: this.baseW, h: this.baseH })
        })
        .then(() => {
            console.log('[Zoom] Сброс отправлен, ожидание применения crop');
            setTimeout(() => {
                this.currentBackendCrop = { x: 0, y: 0, w: this.baseW, h: this.baseH };
                this.actualImageW = this.baseW;
                this.actualImageH = this.baseH;
                
                // Мгновенный сброс без анимации
                this.scale = 1;
                this.pointX = 0;
                this.pointY = 0;
                this.img.style.transform = 'translate(0px, 0px) scale(1)';
                this.wrapper.style.cursor = 'default';
                
                this.waitingForCrop = false;
                this.isResetting = false;
                console.log('[Zoom] Сброс применён на бэкенде');
            }, 400);
        })
        .catch(err => {
            console.error('[Zoom] Ошибка при сбросе:', err);
            this.waitingForCrop = false;
            this.isResetting = false;
        });
    }

    _sendZoomToBackend() {
        const rect = this.wrapper.getBoundingClientRect();
        const domW = this.img.clientWidth;
        const domH = this.img.clientHeight;
        
        console.log('[Zoom] _sendZoomToBackend вызван:');
        console.log(`  wrapper: ${rect.width.toFixed(0)}×${rect.height.toFixed(0)}`);
        console.log(`  img.client: ${domW}×${domH}`);
        console.log(`  actual backend image: ${this.actualImageW}×${this.actualImageH}`);
        console.log(`  backend crop: x=${this.currentBackendCrop.x}, y=${this.currentBackendCrop.y}, w=${this.currentBackendCrop.w}×${this.currentBackendCrop.h}`);
        console.log(`  scale: ${this.scale.toFixed(2)}`);
        console.log(`  translate: (${this.pointX.toFixed(0)}, ${this.pointY.toFixed(0)})`);

        if (!domW || !domH) {
            console.error('[Zoom] Ошибка: domW или domH = 0');
            return;
        }

        const scaleFactorX = this.actualImageW / domW;
        const scaleFactorY = this.actualImageH / domH;
        
        console.log(`  scaleFactor: X=${scaleFactorX.toFixed(3)}, Y=${scaleFactorY.toFixed(3)}`);

        let localX = (-this.pointX / this.scale) * scaleFactorX;
        let localY = (-this.pointY / this.scale) * scaleFactorY;
        let localW = (rect.width / this.scale) * scaleFactorX;
        let localH = (rect.height / this.scale) * scaleFactorY;

        let x = this.currentBackendCrop.x + localX;
        let y = this.currentBackendCrop.y + localY;
        let w = localW;
        let h = localH;

        console.log(`  локальные координаты: x=${localX.toFixed(1)}, y=${localY.toFixed(1)}, w=${localW.toFixed(1)}, h=${localH.toFixed(1)}`);
        console.log(`  абсолютные координаты (до clamp): x=${x.toFixed(1)}, y=${y.toFixed(1)}, w=${w.toFixed(1)}, h=${h.toFixed(1)}`);

        x = Math.max(0, Math.round(x));
        y = Math.max(0, Math.round(y));
        w = Math.min(this.baseW - x, Math.round(w));
        h = Math.min(this.baseH - y, Math.round(h));

        console.log(`  абсолютные координаты (после clamp): x=${x}, y=${y}, w=${w}, h=${h}`);

        if (this.currentCropArea && 
            this.currentCropArea.x === x && 
            this.currentCropArea.y === y && 
            this.currentCropArea.w === w && 
            this.currentCropArea.h === h) {
            console.log('[Zoom] Координаты не изменились, отправка отменена');
            return;
        }

        this.currentCropArea = { x, y, w, h };
        console.log(`[Zoom] Отправка на бэкенд: x=${x}, y=${y}, w=${w}, h=${h}`);
        
        this.waitingForCrop = true;

        fetch(`${window.location.protocol}//${window.location.hostname}:5000/set_zoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, w, h })
        })
        .then(() => {
            console.log('[Zoom] Запрос отправлен, ожидание применения crop');
            setTimeout(() => {
                this.currentBackendCrop = { x, y, w, h };
                this.actualImageW = w;
                this.actualImageH = h;
                
                // Мгновенный сброс без анимации
                this.scale = 1;
                this.pointX = 0;
                this.pointY = 0;
                this.img.style.transform = 'translate(0px, 0px) scale(1)';
                this.wrapper.style.cursor = 'default';
                
                this.waitingForCrop = false;
                console.log(`[Zoom] Crop применён: ${w}x${h}, actualImage обновлён`);
            }, 400);
        })
        .catch(err => {
            console.error('[Zoom] Ошибка:', err);
            this.waitingForCrop = false;
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const streamImg = document.getElementById('stream');
    if (streamImg) {
        if (streamImg.complete && streamImg.naturalWidth) {
            new ImageZoomPan(streamImg);
        } else {
            streamImg.addEventListener('load', () => new ImageZoomPan(streamImg), { once: true });
        }
    }
});