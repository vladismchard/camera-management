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

        // Оборачиваем картинку в контейнер для зума
        this._wrapImage();
        this._initEvents();
    }

    _wrapImage() {
        const parent = this.img.parentElement;

        // Создаём обёртку, если её ещё нет
        if (!parent.classList.contains('zoom-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'zoom-wrapper';
            parent.insertBefore(wrapper, this.img);
            wrapper.appendChild(this.img);
        }

        this.wrapper = this.img.parentElement;

        // Стили обёртки — фиксируем размер и скрываем выход за границы
        Object.assign(this.wrapper.style, {
            overflow: 'hidden',
            position: 'relative',
            cursor: 'grab',
            userSelect: 'none',
            display: 'block',
        });

        // Убираем transition с картинки, чтобы не было лага при перетаскивании
        this.img.style.transformOrigin = '0 0';
        this.img.style.pointerEvents = 'none'; // события ловит обёртка
    }

    _initEvents() {
        // ── Колесико мыши — зум ──────────────────────────────────────
        this.wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();

            const rect = this.wrapper.getBoundingClientRect();

            // Координаты курсора относительно контента (с учётом текущего transform)
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            const xs = (mouseX - this.pointX) / this.scale;
            const ys = (mouseY - this.pointY) / this.scale;

            const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
            const newScale = Math.min(10, Math.max(0.1, this.scale * factor));

            if (newScale === 1) {
                // Сброс к исходному состоянию
                this.scale = 1;
                this.pointX = 0;
                this.pointY = 0;
            } else {
                this.scale = newScale;
                this.pointX = mouseX - xs * this.scale;
                this.pointY = mouseY - ys * this.scale;
                this._clamp();
            }

            this._applyTransform();
        }, { passive: false });

        // ── Начало перетаскивания ─────────────────────────────────────
        this.wrapper.addEventListener('mousedown', (e) => {
            if (this.scale === 1) return; // нет смысла тащить при 100%
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

    // Не даём картинке уехать за края обёртки
    _clamp() {
        const ww = this.wrapper.clientWidth;
        const wh = this.wrapper.clientHeight;
        const iw = this.img.clientWidth  * this.scale;
        const ih = this.img.clientHeight * this.scale;
 
        if (this.scale >= 1) {
            const minX = Math.min(0, ww - iw);
            const minY = Math.min(0, wh - ih);
            this.pointX = Math.min(0, Math.max(minX, this.pointX));
            this.pointY = Math.min(0, Math.max(minY, this.pointY));
        } else {
            // When scale < 1, the image is smaller than the wrapper.
            // We center it to avoid "jumping" or stick it to 0,0.
            this.pointX = (ww - iw) / 2;
            this.pointY = (wh - ih) / 2;
        }
    }


    _applyTransform() {
        this.img.style.transform =
            `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
        
        this._sendZoomToBackend();
    }

    _sendZoomToBackend() {
        const rect = this.wrapper.getBoundingClientRect();
        
        // Натуральный размер изображения (из свойств img или дефолты камеры)
        const naturalW = this.img.naturalWidth || 1280; 
        const naturalH = this.img.naturalHeight || 720;

        // Размер изображения в DOM до применения scale (текущий layout размер)
        const domW = this.img.clientWidth;
        const domH = this.img.clientHeight;

        // Коэффициент пересчета: 1 пиксель DOM = X пикселей оригинала
        const scaleFactorX = naturalW / domW;
        const scaleFactorY = naturalH / domH;

        // Координаты смещения pointX/pointY в CSS-пикселях.
        //-pointX / scale дает сдвиг относительно левого края картинки в DOM-пикселях.
        const x = (-this.pointX / this.scale) * scaleFactorX;
        const y = (-this.pointY / this.scale) * scaleFactorY;
        
        // Размер видимой области в DOM-пикселях: rect.width / scale
        const w = (rect.width / this.scale) * scaleFactorX;
        const h = (rect.height / this.scale) * scaleFactorY;

        console.log(`Sending zoom to backend: x=${x.toFixed(2)}, y=${y.toFixed(2)}, w=${w.toFixed(2)}, h=${h.toFixed(2)}`);

        fetch(`${window.location.protocol}//${window.location.hostname}:5000/set_zoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, w, h })
        }).catch(err => console.error('Failed to set zoom on backend:', err));
    }

}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const streamImg = document.getElementById('stream');
    if (streamImg) {
        // Картинка может ещё не иметь размеров — ждём первого кадра
        if (streamImg.complete && streamImg.naturalWidth) {
            new ImageZoomPan(streamImg);
        } else {
            streamImg.addEventListener('load', () => new ImageZoomPan(streamImg), { once: true });
        }
    }
});