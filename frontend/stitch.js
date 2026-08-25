// frontend/stitch.js
class StitchUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            stream: document.getElementById('stream'),
            captureBtn: document.getElementById('captureBtn'),
            stitchBtn: document.getElementById('stitchBtn'),
            stitchMethod: document.getElementById('stitchMethod'),
            clearBtn: document.getElementById('clearBtn'),
            imageCount: document.getElementById('imageCount'),
            stitchedResult: document.getElementById('stitchedResult'),
            captureLog: document.getElementById('captureLog'),
        };
        this.elements.stream.src = `${this.apiUrl}/stream`;
        this.elements.captureBtn.addEventListener('click', () => this.captureImage());
        this.elements.stitchBtn.addEventListener('click', () => this.stitchImages());
        this.elements.clearBtn.addEventListener('click', () => this.clearImages());
        this.updateImageCount();
    }

    logCapture(message, type = 'info') {
        const log = this.elements.captureLog;
        const item = document.createElement('div');
        item.className = `log-item log-${type}`;
        item.textContent = `${new Date().toLocaleTimeString()} — ${message}`;
        log.prepend(item);

        // Оставляем только последние 20 записей
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
                    `Image captured ✓  Variance: ${data.variance.toFixed(2)}`,
                    'success'
                );
            } else if (data.status === 'skipped') {
                this.logCapture(
                    `Frame skipped — not focused. Variance: ${data.variance.toFixed(2)}, Threshold: ${data.threshold.toFixed(2)}`,
                    'warning'
                );
            } else {
                this.logCapture(`Error: ${data.error}`, 'error');
            }
        } catch (error) {
            this.logCapture('Failed to capture: ' + error.message, 'error');
        }
    }

    async stitchImages() {
        this.elements.stitchBtn.disabled = true;
        this.elements.stitchBtn.textContent = 'Stitching...';
        const method = this.elements.stitchMethod.value;

        try {
            const response = await fetch(`${this.apiUrl}/stitch?method=${method}`, { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
                const filename = data.filepath.split('/').pop();
                this.elements.stitchedResult.innerHTML = `
                    <img src="${this.apiUrl}/stitched/${filename}?t=${Date.now()}" alt="Stitched Result">
                    <p class="success-label">Stitched ${data.count} images — ${data.method}</p>
                `;
            } else {
                this.elements.stitchedResult.innerHTML =
                    `<p class="message-error">Error: ${data.error}</p>`;
            }
        } catch (error) {
            this.elements.stitchedResult.innerHTML =
                `<p class="message-error">Failed to stitch images</p>`;
        } finally {
            this.elements.stitchBtn.disabled = false;
            this.elements.stitchBtn.textContent = 'Stitch Images';
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
                    '<p class="message-empty">Cleared all images</p>';
                this.logCapture('All images cleared', 'info');
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