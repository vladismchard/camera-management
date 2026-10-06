// frontend/zoom.js
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

        // Фиксируем ИСХОДНОЕ разрешение камеры ОДИН РАЗ (чтобы не застрять в кропе бэкенда)
        // Если при загрузке картинка уже обрезана, ставим стандартные 1280x720 (поменяй, если у тебя 1920x1080)
        this.baseW = (imageElement.naturalWidth > 300) ? imageElement.naturalWidth : 1280;
        this.baseH = (imageElement.naturalHeight > 300) ? imageElement.naturalHeight : 720;

        this.zoomTimeout = null;

        this._wrapImage();
        this._initEvents();
        console.log(`[Zoom] Инициализация. Базовое разрешение зафиксировано: ${this.baseW}x${this.baseH}`);
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

        Object.assign(this.wrapper.style, {
            overflow: 'hidden',
            position: 'relative',
            cursor: 'grab',
            userSelect: 'none',
            display: 'block',
        });

        this.img.style.transformOrigin = '0 0';
        this.img.style.pointerEvents = 'none';
    }

    _initEvents() {
        // ── Колесико мыши — зум ──────────────────────────────────────
        this.wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = this.wrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const xs = (mouseX - this.pointX) / this.scale;
            const ys = (mouseY - this.pointY) / this.scale;

            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            let newScale = this.scale * factor;

            // Не даем масштабу стать меньше 1 (оригинал) и больше 10
            newScale = Math.max(1, Math.min(10, newScale));

            this.scale = newScale;
            this.pointX = mouseX - xs * this.scale;
            this.pointY = mouseY - ys * this.scale;
            
            this._clamp();
            this._applyTransform();
        }, { passive: false });

        // ── Начало перетаскивания ─────────────────────────────────────
        this.wrapper.addEventListener('mousedown', (e) => {
            if (this.scale <= 1) return;
            e.preventDefault();
            this.panning = true;
            this.startX = e.clientX - this.pointX;
            this.startY = e.clientY - this.pointY;
            this.wrapper.style.cursor = 'grabbing';
        });

        // ── Движение мыши ─────────────────────────────────────────────
        window.addEventListener('mousemove', (e) => {
            if (!this.panning) return;
            this.pointX = e.clientX - this.startX;
            this.pointY = e.clientY - this.startY;
            this._clamp();
            this._applyTransform();
        });

        // ── Конец перетаскивания ──────────────────────────────────────
        window.addEventListener('mouseup', () => {
            if (!this.panning) return;
            this.panning = false;
            this.wrapper.style.cursor = this.scale > 1 ? 'grab' : 'default';
        });

        // ── Двойной клик — сброс зума ────────────────────────────────
        this.wrapper.addEventListener('dblclick', () => {
            this.scale = 1;
            this.pointX = 0;
            this.pointY = 0;
            this.img.style.transition = 'transform 0.25s ease';
            this._applyTransform();
            setTimeout(() => (this.img.style.transition = ''), 260);
            this.wrapper.style.cursor = 'default';
        });
    }

    _clamp() {
        const ww = this.wrapper.clientWidth;
        const wh = this.wrapper.clientHeight;
        const iw = this.img.clientWidth * this.scale;
        const ih = this.img.clientHeight * this.scale;
 
        const minX = Math.min(0, ww - iw);
        const minY = Math.min(0, wh - ih);
        
        this.pointX = Math.min(0, Math.max(minX, this.pointX));
        this.pointY = Math.min(0, Math.max(minY, this.pointY));
    }

    _applyTransform() {
        this.img.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
        
        if (this.zoomTimeout) clearTimeout(this.zoomTimeout);
        this.zoomTimeout = setTimeout(() => {
            this._sendZoomToBackend();
        }, 150);
    }

    _sendZoomToBackend() {
        const rect = this.wrapper.getBoundingClientRect();
        
        // ВАЖНО: используем ЗАФИКСИРОВАННЫЙ размер камеры, а не текущий (обрезанный бэкендом)
        const naturalW = this.baseW; 
        const naturalH = this.baseH;
        
        const domW = this.img.clientWidth;
        const domH = this.img.clientHeight;

        if (!domW || !domH) return;

        const scaleFactorX = naturalW / domW;
        const scaleFactorY = naturalH / domH;

        let x = (-this.pointX / this.scale) * scaleFactorX;
        let y = (-this.pointY / this.scale) * scaleFactorY;
        let w = (rect.width / this.scale) * scaleFactorX;
        let h = (rect.height / this.scale) * scaleFactorY;

        x = Math.max(0, Math.round(x));
        y = Math.max(0, Math.round(y));
        w = Math.min(naturalW - x, Math.round(w));
        h = Math.min(naturalH - y, Math.round(h));

        console.log(`[Zoom] Отправка на бэкенд: x=${x}, y=${y}, w=${w}, h=${h}`);

        fetch(`${window.location.protocol}//${window.location.hostname}:5000/set_zoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, w, h })
        }).catch(err => console.error('[Zoom] Ошибка:', err));
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