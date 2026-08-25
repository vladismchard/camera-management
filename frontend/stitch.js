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
        };
        this.elements.stream.src = `${this.apiUrl}/stream`;
        this.elements.captureBtn.addEventListener('click', () => this.captureImage());
        this.elements.stitchBtn.addEventListener('click', () => this.stitchImages());
        this.elements.clearBtn.addEventListener('click', () => this.clearImages());
        this.updateImageCount();
    }

    async captureImage() {
        try {
            const response = await fetch(`${this.apiUrl}/capture`, { method: 'POST' });
            const data = await response.json();
            if (data.status === 'success') {
                this.elements.imageCount.textContent = data.count;
                this.elements.stitchBtn.disabled = data.count < 2;
            } else {
                alert(`Failed to capture: ${data.error}`);
            }
        } catch (error) {
            alert('Failed to capture image: ' + error.message);
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
                    <p class="success-label">
                        Stitched ${data.count} images using ${data.method} method
                    </p>
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
                this.elements.stitchedResult.innerHTML = '<p class="message-empty">Cleared all images</p>';
            }
        } catch (error) {
            console.error('Failed to clear images:', error);
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