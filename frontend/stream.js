// frontend/stream.js
class StreamUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            variance: document.getElementById('variance'),
            threshold: document.getElementById('threshold'),
            stream: document.getElementById('stream'),
            checkFocusBtn: document.getElementById('checkFocusBtn'),
            lastCheckTime: document.getElementById('lastCheckTime'),
            baseThreshold: document.getElementById('baseThreshold'),
            applyThresholdBtn: document.getElementById('applyThresholdBtn'),
        };

        this.zoomState = {
            x: 0,
            y: 0,
            w: 1280,
            h: 720,
            imgW: 1280,
            imgH: 720,
            isDragging: false,
            lastX: 0,
            lastY: 0
        };

        this.modeToggle = new FocusModeToggle(this.apiUrl);
        this.modeToggle.onChange((autoMode) => this.onModeChanged(autoMode));

        this.checkHealthAndInit();
        this.initZoomEvents();
        this.resetZoomOnLoad();
        this.elements.checkFocusBtn.addEventListener('click', () => this.checkFocus());
        this.elements.applyThresholdBtn.addEventListener('click', () => this.applyThreshold());

        this.loadThresholdSettings();
        setInterval(() => this.fetchMetrics(), 2000);
    }

    initZoomEvents() {
        const stream = this.elements.stream;

        stream.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY;
            const zoomFactor = delta > 0 ? 1.1 : 0.9;
            
            const newW = Math.max(100, Math.min(this.zoomState.imgW, this.zoomState.w * zoomFactor));
            const newH = Math.max(100, Math.min(this.zoomState.imgH, this.zoomState.h * zoomFactor));
            
            // Zoom towards the mouse cursor
            const rect = stream.getBoundingClientRect();
            const mouseX = (e.clientX - rect.left) / rect.width;
            const mouseY = (e.clientY - rect.top) / rect.height;
            
            const dx = (newW - this.zoomState.w) * mouseX;
            const dy = (newH - this.zoomState.h) * mouseY;
            
            this.zoomState.x = this.clamp(this.zoomState.x - dx / 2, 0, this.zoomState.imgW - newW);
            this.zoomState.y = this.clamp(this.zoomState.y - dy / 2, 0, this.zoomState.imgH - newH);
            this.zoomState.w = newW;
            this.zoomState.h = newH;
            
            this.updateZoom();
        }, { passive: false });

        stream.addEventListener('mousedown', (e) => {
            this.zoomState.isDragging = true;
            this.zoomState.lastX = e.clientX;
            this.zoomState.lastY = e.clientY;
            stream.style.cursor = 'grabbing';
        });

        window.addEventListener('mousemove', (e) => {
            if (!this.zoomState.isDragging) return;
            
            const dx = e.clientX - this.zoomState.lastX;
            const dy = e.clientY - this.zoomState.lastY;
            
            // Adjust movement speed based on zoom level
            const moveX = dx * (this.zoomState.w / stream.offsetWidth);
            const moveY = dy * (this.zoomState.h / stream.offsetHeight);
            
            this.zoomState.x = this.clamp(this.zoomState.x - moveX, 0, this.zoomState.imgW - this.zoomState.w);
            this.zoomState.y = this.clamp(this.zoomState.y - moveY, 0, this.zoomState.imgH - this.zoomState.h);
            
            this.zoomState.lastX = e.clientX;
            this.zoomState.lastY = e.clientY;
            
            this.updateZoom();
        });

        window.addEventListener('mouseup', () => {
            this.zoomState.isDragging = false;
            stream.style.cursor = 'default';
        });
    }

    clamp(val, min, max) {
        return Math.max(min, Math.min(max, val));
    }

    async updateZoom() {
        try {
            await fetch(`${this.apiUrl}/set_zoom`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    x: Math.round(this.zoomState.x), 
                    y: Math.round(this.zoomState.y), 
                    w: Math.round(this.zoomState.w), 
                    h: Math.round(this.zoomState.h) 
                })
            });
        } catch (e) {
            console.error('Failed to update zoom:', e);
        }
    }

    async checkHealthAndInit() {
        try {
            const response = await fetch(`${this.apiUrl}/health`);
            const data = await response.json();
            
            if (data.camera === false) {
                window.location.href = 'error.html';
                return;
            }
            
            if (data.dimensions) {
                this.zoomState.imgW = data.dimensions.width;
                this.zoomState.imgH = data.dimensions.height;
            }
            
            this.elements.stream.src = `${this.apiUrl}/stream`;
        } catch (error) {
            console.error('Health check failed:', error);
            window.location.href = 'error.html';
        }
    }

    async resetZoomOnLoad() {
        this.zoomState = {
            x: 0, y: 0, w: 1280, h: 720, imgW: 1280, imgH: 720,
            isDragging: false, lastX: 0, lastY: 0
        };
        await this.updateZoom();
    }

    async loadThresholdSettings() {
        try {
            const response = await fetch(`${this.apiUrl}/focus/threshold`);
            const data = await response.json();
            
            if (data.status === 'success') {
                this.elements.baseThreshold.value = data.base_threshold;
            }
        } catch (error) {
            console.error('Failed to load threshold settings:', error);
        }
    }

    async applyThreshold() {
        try {
            this.elements.applyThresholdBtn.disabled = true;
            this.elements.applyThresholdBtn.textContent = 'Применение...';

            const baseThreshold = parseFloat(this.elements.baseThreshold.value);

            const response = await fetch(`${this.apiUrl}/focus/threshold`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    base_threshold: baseThreshold
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                await this.fetchMetrics();
            } else {
                alert('Не удалось обновить порог: ' + data.error);
            }
        } catch (error) {
            console.error('Failed to apply threshold:', error);
            alert('Не удалось применить порог');
        } finally {
            this.elements.applyThresholdBtn.disabled = false;
            this.elements.applyThresholdBtn.textContent = 'Применить';
        }
    }

    onModeChanged(autoMode) {
        if (autoMode) {
            this.elements.checkFocusBtn.disabled = true;
            this.elements.checkFocusBtn.textContent = 'Авторежим активен';
            this.elements.statusText.textContent = 'Наблюдение за потоком...';
            this.elements.statusIndicator.className = 'status-indicator';
        } else {
            this.elements.checkFocusBtn.disabled = false;
            this.elements.checkFocusBtn.textContent = 'Проверить фокус';
            this.elements.statusText.textContent = 'Нажмите «Проверить фокус»';
        }
    }

    async checkFocus() {
        try {
            this.elements.checkFocusBtn.disabled = true;
            this.elements.checkFocusBtn.textContent = 'Проверка...';

            const response = await fetch(`${this.apiUrl}/focus/check`, { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                this.elements.statusIndicator.className = `status-indicator ${data.is_focused ? 'focused' : 'blurred'}`;
                this.elements.statusText.textContent = data.is_focused ? 'В ФОКУСЕ' : 'НЕ В ФОКУСЕ';
                this.elements.variance.textContent = data.variance.toFixed(2);
                this.elements.threshold.textContent = data.adaptive_threshold.toFixed(2);

                const now = new Date().toLocaleTimeString();
                this.elements.lastCheckTime.textContent = `Последняя проверка: ${now}`;
                this.elements.lastCheckTime.style.color = data.is_focused ? '#4ade80' : '#f87171';
            }
        } catch (error) {
            console.error('Failed to check focus:', error);
            this.elements.statusText.textContent = 'Ошибка соединения';
        } finally {
            this.elements.checkFocusBtn.disabled = false;
            this.elements.checkFocusBtn.textContent = 'Проверить фокус';
        }
    }

    async fetchMetrics() {
        try {
            const response = await fetch(`${this.apiUrl}/metrics`);
            const data = await response.json();

            if (this.modeToggle.getMode()) {
                this.elements.statusIndicator.className = `status-indicator ${data.is_focused ? 'focused' : 'blurred'}`;
                this.elements.statusText.textContent = data.is_focused ? 'В ФОКУСЕ' : 'НЕ В ФОКУСЕ';
            }

            this.elements.variance.textContent = data.current_variance.toFixed(2);
            this.elements.threshold.textContent = data.adaptive_threshold.toFixed(2);

        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    }
}

new StreamUI();