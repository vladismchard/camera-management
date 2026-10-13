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
        this.finalZoomTimeout = null;
        this.waitingForCrop = false;
        this.currentCropArea = null;
        
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
        
        Object.assign(this.wrapper.style, {
            overflow: 'hidden',
            position: 'relative',
            cursor: 'grab',
            userSelect: 'none',
            display: 'block',
            width: '100%',
            height: '100%'
        });
        
        this.img.style.transformOrigin = '0 0';
        this.img.style.pointerEvents = 'none';
        this.img.style.display = 'block';
        this.img.style.width = '100%';
        this.img.style.height = '100%';
        this.img.style.objectFit = 'contain';
    }

    _initEvents() {
        this.wrapper.addEventListener('wheel', (e) => {
            e.preventDefault();
            
            const rect = this.wrapper.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const xs = (mouseX - this.pointX) / this.scale;
            const ys = (mouseY - this.pointY) / this.scale;
            
            // Более плавный коэффициент зума
            const delta = e.deltaY;
            const factor = delta < 0 ? 1.1 : 1 / 1.1;
            
            let newScale = this.scale * factor;
            newScale = Math.max(1, Math.min(15, newScale));
            
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
        });

        this.wrapper.addEventListener('dblclick', () => {
            this._resetZoom();
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
        
        if (this.finalZoomTimeout) clearTimeout(this.finalZoomTimeout);
        
        if (Math.abs(this.scale - 1) < 0.01 && this.pointX === 0 && this.pointY === 0) {
            this.finalZoomTimeout = setTimeout(() => this._sendResetToBackend(), 500);
            return;
        }
        
        this.finalZoomTimeout = setTimeout(() => {
            this._sendZoomToBackend();
        }, 600);
    }

    _resetZoom() {
        this.scale = 1;
        this.pointX = 0;
        this.pointY = 0;
        this.img.style.transition = 'transform 0.2s ease-out';
        this._applyTransform();
        setTimeout(() => { this.img.style.transition = ''; }, 200);
        this.wrapper.style.cursor = 'default';
    }

    _sendResetToBackend() {
        if (this.currentBackendCrop.x === 0 && this.currentBackendCrop.y === 0 && 
            this.currentBackendCrop.w === this.baseW && this.currentBackendCrop.h === this.baseH) return;

        this.waitingForCrop = true;
        fetch(`${window.location.protocol}//${window.location.hostname}:5000/set_zoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x: 0, y: 0, w: this.baseW, h: this.baseH })
        })
        .then(() => {
            setTimeout(() => {
                this.currentBackendCrop = { x: 0, y: 0, w: this.baseW, h: this.baseH };
                this.actualImageW = this.baseW;
                this.actualImageH = this.baseH;
                this.waitingForCrop = false;
            }, 300);
        })
        .catch(() => { this.waitingForCrop = false; });
    }

    _sendZoomToBackend() {
        const rect = this.wrapper.getBoundingClientRect();
        const domW = this.img.clientWidth;
        const domH = this.img.clientHeight;
        if (!domW || !domH) return;

        const scaleFactorX = this.baseW / domW;
        const scaleFactorY = this.baseH / domH;
        
        let localX = (-this.pointX / this.scale) * scaleFactorX;
        let localY = (-this.pointY / this.scale) * scaleFactorY;
        let localW = (rect.width / this.scale) * scaleFactorX;
        let localH = (rect.height / this.scale) * scaleFactorY;

        let x = Math.max(0, Math.round(localX));
        let y = Math.max(0, Math.round(localY));
        let w = Math.min(this.baseW - x, Math.round(localW));
        let h = Math.min(this.baseH - y, Math.round(localH));

        if (this.currentCropArea && this.currentCropArea.x === x && this.currentCropArea.y === y && 
            this.currentCropArea.w === w && this.currentCropArea.h === h) return;

        this.currentCropArea = { x, y, w, h };
        this.waitingForCrop = true;

        fetch(`${window.location.protocol}//${window.location.hostname}:5000/set_zoom`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y, w, h })
        })
        .then(() => {
            setTimeout(() => {
                this.currentBackendCrop = { x, y, w, h };
                this.actualImageW = w;
                this.actualImageH = h;
                this.waitingForCrop = false;
            }, 300);
        })
        .catch(() => { this.waitingForCrop = false; });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const streamImg = document.getElementById('stream');
    if (streamImg) {
        if (streamImg.complete) {
            new ImageZoomPan(streamImg);
        } else {
            streamImg.addEventListener('load', () => new ImageZoomPan(streamImg), { once: true });
        }
    }
});
