// frontend/stitch.js
class StitchUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.modeToggle = new FocusModeToggle(this.apiUrl);
        this.elements = {
            stream: document.getElementById('stream'),
            captureBtn: document.getElementById('captureBtn'),
            stitchBtn: document.getElementById('stitchBtn'),
            stitchMethod: document.getElementById('stitchMethod'),
            clearBtn: document.getElementById('clearBtn'),
            imageCount: document.getElementById('imageCount'),
            stitchedResult: document.getElementById('stitchedResult'),
            captureLog: document.getElementById('captureLog'),
            checkFocusBtn: document.getElementById('checkFocusBtn'),
        };
        this.elements.stream.src = `${this.apiUrl}/stream`;
        this.elements.captureBtn.addEventListener('click', () => this.captureImage());
        this.elements.stitchBtn.addEventListener('click', () => this.stitchImages());
        this.elements.clearBtn.addEventListener('click', () => this.clearImages());
        this.elements.checkFocusBtn.addEventListener('click', () => this.checkFocus());
        this.updateImageCount();
    }

    async checkFocus() {
        try {
            this.elements.checkFocusBtn.disabled = true;
            this.elements.checkFocusBtn.textContent = 'Проверка...';
            
            const response = await fetch(`${this.apiUrl}/focus/check`, { method: 'POST' });
            const data = await response.json();
            
            if (data.status === 'success') {
                const focusStatus = data.is_focused ? 'В ФОКУСЕ' : 'НЕ В ФОКУСЕ';
                const logType = data.is_focused ? 'success' : 'warning';
                this.logCapture(
                    `Проверка фокуса: ${focusStatus} | Дисперсия: ${data.variance.toFixed(2)} | Порог: ${data.adaptive_threshold.toFixed(2)}`,
                    logType
                );
            }
        } catch (error) {
            this.logCapture('Не удалось проверить фокус: ' + error.message, 'error');
        } finally {
            this.elements.checkFocusBtn.disabled = false;
            this.elements.checkFocusBtn.textContent = 'Проверить фокус';
        }
    }

    logCapture(message, type = 'info') {
        const log = this.elements.captureLog;
        const item = document.createElement('div');
        item.className = `log-item log-${type}`;
        item.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
        log.prepend(item);

        while (log.children.length > 20) {
            log.removeChild(log.lastChild);
        }
    }

    async captureImage() {
        try {
            const response = await fetch(`${this.apiUrl}/capture`, { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                this.elements.imageCount.textContent = data.count;
                this.elements.stitchBtn.disabled = data.count < 2;
                this.logCapture(
                    `Изображение захвачено. Дисперсия: ${data.variance.toFixed(2)}`,
                    'success'
                );
            } else if (data.status === 'skipped') {
                this.logCapture(
                    `Кадр пропущен — не в фокусе. Дисперсия: ${data.variance.toFixed(2)}, Порог: ${data.threshold.toFixed(2)}`,
                    'warning'
                );
            } else {
                this.logCapture(`Ошибка: ${data.error}`, 'error');
            }
        } catch (error) {
            this.logCapture('Не удалось захватить кадр: ' + error.message, 'error');
        }
    }

    async stitchImages() {
        this.elements.stitchBtn.disabled = true;
        this.elements.stitchBtn.textContent = 'Склейка...';
        const method = this.elements.stitchMethod.value;

        const methodNames = {
            grid: 'Сетка',
            panorama: 'Панорама'
        };

        try {
            const response = await fetch(`${this.apiUrl}/stitch?method=${method}`, { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                const filename = data.filepath.split('/').pop();
                this.elements.stitchedResult.innerHTML = `
                    <img src="${this.apiUrl}/stitched/${filename}?t=${Date.now()}" alt="Результат склейки">
                    <p class="success-label">Склеено изображений: ${data.count} — ${methodNames[data.method] || data.method}</p>
                `;
            } else {
                this.elements.stitchedResult.innerHTML =
                    `<p class="message-error">Ошибка: ${data.error}</p>`;
            }
        } catch (error) {
            this.elements.stitchedResult.innerHTML =
                `<p class="message-error">Не удалось склеить изображения</p>`;
        } finally {
            this.elements.stitchBtn.disabled = false;
            this.elements.stitchBtn.textContent = 'Склеить изображения';
        }
    }

    async clearImages() {
        try {
            const response = await fetch(`${this.apiUrl}/clear`, { method: 'POST' });
            const data = await response.json();
            if (data.status === 'success') {
                this.elements.imageCount.textContent = data.count;
                this.elements.stitchBtn.disabled = true;
                this.elements.stitchedResult.innerHTML =
                    '<p class="message-empty">Все изображения очищены</p>';
                this.logCapture('Все изображения очищены', 'info');
            }
        } catch (error) {
            console.error('Failed to clear:', error);
        }
    }

    async updateImageCount() {
        try {
            const response = await fetch(`${this.apiUrl}/count`);
            const data = await response.json();
            this.elements.imageCount.textContent = data.count;
            this.elements.stitchBtn.disabled = data.count < 2;
        } catch (error) {
            console.error('Failed to update count:', error);
        }
    }
}

new StitchUI();