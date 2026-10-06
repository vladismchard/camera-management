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
        
        // Таймеры для оптимизации
        this.zoomTimeout = null;
        this.rAF = null;

        this._wrapImage();
        this._initEvents();
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
        this.img.style.willChange = 'transform'; // Подсказка браузеру для аппаратного ускорения
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

            // Жестко ограничиваем масштаб: не меньше 1 и не больше 10
            newScale = Math.max(1, Math.min(10, newScale));

            // Защита от floating point багов: если масштаб близок к 1, сбрасываем в 1
            if (newScale <= 1.01) {
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
            this.wrapper.style.cursor = 'grab';
        });

        // ── Двойной клик — сброс зума ────────────────────────────────
        this.wrapper.addEventListener('dblclick', () => {
            this.scale = 1;
            this.pointX = 0;
            this.pointY = 0;
            this.img.style.transition = 'transform 0.25s ease';
            this._applyTransform();
            setTimeout(() => (this.img.style.transition = ''), 260);
        });
    }

    _clamp() {
        // Упрощенный clamp, так как scale теперь всегда >= 1
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
        // Отрисовка визуала 60 FPS без лагов
        if (this.rAF) cancelAnimationFrame(this.rAF);
        this.rAF = requestAnimationFrame(() => {
            this.img.style.transform = `translate(${this.pointX}px, ${this.pointY}px) scale(${this.scale})`;
        });

        // Отправка на бэкенд с задержкой 150мс (Debounce), 
        // чтобы не спамить Flask запросами каждую миллисекунду
        if (this.zoomTimeout) clearTimeout(this.zoomTimeout);
        this.zoomTimeout = setTimeout(() => {
            this._sendZoomToBackend();
        }, 150); 
    }

    _sendZoomToBackend() {
        const rect = this.wrapper.getBoundingClientRect();
        
        const naturalW = this.img.naturalWidth || 1280; 
        const naturalH = this.img.naturalHeight || 720;
        const domW = this.img.clientWidth;
        const domH = this.img.clientHeight;

        if (!domW || !domH) return;

        const scaleFactorX = naturalW / domW;
        const scaleFactorY = naturalH / domH;

        let x = (-this.pointX / this.scale) * scaleFactorX;
        let y = (-this.pointY / this.scale) * scaleFactorY;
        let w = (rect.width / this.scale) * scaleFactorX;
        let h = (rect.height / this.scale) * scaleFactorY;

        // Округляем и защищаем от выхода за границы оригинала
        x = Math.max(0, Math.round(x));
        y = Math.max(0, Math.round(y));
        w = Math.min(naturalW - x, Math.round(w));
        h = Math.min(naturalH - y, Math.round(h));

        console.log(`Sending zoom to backend: x=${x}, y=${y}, w=${w}, h=${h}`);
        fetch(`${window.location.protocol}//${window.location.hostname}:5000/set_zoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, w, h })
        }).catch(err => console.error('Failed to set zoom on backend:', err));
    }
}