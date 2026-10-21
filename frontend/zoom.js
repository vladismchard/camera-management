// frontend/zoom.js
// Единая система зума/перемещения для изображения #stream.
// Зум: только колесико мыши. Перемещение: зажатая левая кнопка и перетаскивание.
// Сброс: двойной щелчок.
// Все изменения отправляются на бэкенд (/set_zoom), который обрезает кадр
// реального разрешения, поэтому захват и склейка работают по видимой области.

class StreamZoom {
    constructor() {
        this.img = document.getElementById('stream');
        if (!this.img) return;

        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';

        this.state = {
            x: 0,
            y: 0,
            w: 1280,
            h: 720,
            imgW: 1280,
            imgH: 720
        };

        this.drag = {
            active: false,
            startX: 0,
            startY: 0,
            moved: false
        };

        this.pending = null;
        this.sendTimer = null;
        this.lastSent = null;

        this._wrap();
        this._bindEvents();
        this._initState();
    }

    _wrap() {
        this.img.draggable = false;
        this.img.style.cursor = 'default';
        this.img.style.userSelect = 'none';
        this.img.style.objectFit = 'contain';
    }

    _bindEvents() {
        this.img.addEventListener('wheel', (e) => this.onWheel(e), { passive: false });
        this.img.addEventListener('mousedown', (e) => this.onMouseDown(e));
        window.addEventListener('mousemove', (e) => this.onMouseMove(e));
        window.addEventListener('mouseup', () => this.onMouseUp());
        this.img.addEventListener('dblclick', () => this.reset());
    }

    async _initState() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            const data = await response.json();
            if (data.dimensions) {
                this.state.imgW = data.dimensions.width;
                this.state.imgH = data.dimensions.height;
                this.state.w = data.dimensions.width;
                this.state.h = data.dimensions.height;
            }
            await this._send({ x: 0, y: 0, w: this.state.imgW, h: this.state.imgH });
        } catch (e) {
            console.error('[Zoom] Не удалось получить размеры изображения:', e);
        }
    }

    _clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    _viewRect() {
        const rect = this.img.getBoundingClientRect();
        const containerW = rect.width;
        const containerH = rect.height;
        if (containerW === 0 || containerH === 0) return rect;

        const imgRatio = this.state.w / this.state.h;
        const boxRatio = containerW / containerH;

        if (imgRatio > boxRatio) {
            const h = containerW / imgRatio;
            return {
                left: rect.left,
                top: rect.top + (containerH - h) / 2,
                width: containerW,
                height: h
            };
        }
        const w = containerH * imgRatio;
        return {
            left: rect.left + (containerW - w) / 2,
            top: rect.top,
            width: w,
            height: containerH
        };
    }

    _cursorPosition(e) {
        const view = this._viewRect();
        const fx = (e.clientX - view.left) / view.width;
        const fy = (e.clientY - view.top) / view.height;
        return {
            imgX: fx * this.state.w,
            imgY: fy * this.state.h
        };
    }

    onWheel(e) {
        e.preventDefault();

        const delta = e.deltaY;
        const factor = delta < 0 ? 1 / 1.1 : 1.1;

        const { imgX, imgY } = this._cursorPosition(e);

        let newW = this.state.w * factor;
        let newH = this.state.h * factor;

        const minW = Math.max(32, this.state.imgW * 0.05);
        const minH = Math.max(32, this.state.imgH * 0.05);

        newW = this._clamp(newW, minW, this.state.imgW);
        newH = this._clamp(newH, minH, this.state.imgH);

        const ratioX = newW / this.state.w;
        const ratioY = newH / this.state.h;

        let newX = this.state.x + imgX - imgX * ratioX;
        let newY = this.state.y + imgY - imgY * ratioY;

        newX = this._clamp(newX, 0, this.state.imgW - newW);
        newY = this._clamp(newY, 0, this.state.imgH - newH);

        this.state.x = Math.round(newX);
        this.state.y = Math.round(newY);
        this.state.w = Math.round(newW);
        this.state.h = Math.round(newH);

        this._queueSend();
    }

    onMouseDown(e) {
        if (e.button !== 0) return;
        e.preventDefault();

        this.drag.active = true;
        this.drag.moved = false;
        this.drag.startX = e.clientX;
        this.drag.startY = e.clientY;
        this.img.style.cursor = 'grabbing';
    }

    onMouseMove(e) {
        if (!this.drag.active) return;

        const dx = e.clientX - this.drag.startX;
        const dy = e.clientY - this.drag.startY;

        if (Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

        if (!this.drag.moved) {
            this.drag.moved = true;
            this.drag.startX = e.clientX;
            this.drag.startY = e.clientY;
            return;
        }

        const view = this._viewRect();
        const scaleX = this.state.w / view.width;
        const scaleY = this.state.h / view.height;

        let newX = this.state.x - dx * scaleX;
        let newY = this.state.y - dy * scaleY;

        newX = this._clamp(newX, 0, this.state.imgW - this.state.w);
        newY = this._clamp(newY, 0, this.state.imgH - this.state.h);

        this.state.x = Math.round(newX);
        this.state.y = Math.round(newY);

        this.drag.startX = e.clientX;
        this.drag.startY = e.clientY;

        this.img.style.cursor = 'grabbing';
        this._queueSend();
    }

    onMouseUp() {
        this.drag.active = false;
        this.img.style.cursor = 'default';
    }

    async reset() {
        this.state.x = 0;
        this.state.y = 0;
        this.state.w = this.state.imgW;
        this.state.h = this.state.imgH;
        await this._send({ x: 0, y: 0, w: this.state.imgW, h: this.state.imgH });
    }

    _queueSend() {
        this.pending = { x: this.state.x, y: this.state.y, w: this.state.w, h: this.state.h };

        if (this.sendTimer) return;

        this.sendTimer = setTimeout(() => {
            this.sendTimer = null;
            if (this.pending) {
                const payload = this.pending;
                this.pending = null;
                this._send(payload);
            }
        }, 60);
    }

    async _send(payload) {
        if (this.lastSent &&
            this.lastSent.x === payload.x &&
            this.lastSent.y === payload.y &&
            this.lastSent.w === payload.w &&
            this.lastSent.h === payload.h) return;

        try {
            await fetch(`${this.apiUrl}/set_zoom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            this.lastSent = payload;
        } catch (e) {
            console.error('[Zoom] Ошибка отправки области:', e);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new StreamZoom();
});