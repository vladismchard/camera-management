/ frontend/app.js
class WeldingFocusDetectionUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            variance: document.getElementById('variance'),
            avgVariance: document.getElementById('avgVariance'),
            threshold: document.getElementById('threshold'),
            historySize: document.getElementById('historySize'),
            chart: document.getElementById('chart'),
            stream: document.getElementById('stream'),
            captureBtn: document.getElementById('captureBtn'),
            stitchBtn: document.getElementById('stitchBtn'),
            stitchMethod: document.getElementById('stitchMethod'),
            clearBtn: document.getElementById('clearBtn'),
            imageCount: document.getElementById('imageCount'),
            stitchedResult: document.getElementById('stitchedResult'),
            autofocusBtn: document.getElementById('autofocusBtn'),
            numSteps: document.getElementById('numSteps'),
            stepSize: document.getElementById('stepSize'),
            autofocusResults: document.getElementById('autofocusResults'),
            autofocusImage: document.getElementById('autofocusImage')
        };
        this.chartCtx = this.elements.chart.getContext('2d');
        this.elements.stream.src = `${this.apiUrl}/stream`;
        
        this.initEventListeners();
        this.initMetricsPolling();
        this.updateImageCount();
    }

    initEventListeners() {
        this.elements.captureBtn.addEventListener('click', () => this.captureImage());
        this.elements.stitchBtn.addEventListener('click', () => this.stitchImages());
        this.elements.clearBtn.addEventListener('click', () => this.clearImages());
        this.elements.autofocusBtn.addEventListener('click', () => this.runAutofocus());
    }

    initMetricsPolling() {
        setInterval(() => this.fetchMetrics(), 500);
    }

    async fetchMetrics() {
        try {
            const response = await fetch(`${this.apiUrl}/metrics`);
            const data = await response.json();
            this.updateUI(data);
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    }

    async captureImage() {
        try {
            console.log('Capturing image...');
            const response = await fetch(`${this.apiUrl}/capture`, { method: 'POST' });
            console.log('Response status:', response.status);
            const data = await response.json();
            console.log('Response data:', data);
            
            if (data.status === 'success') {
                this.elements.imageCount.textContent = data.count;
                this.elements.stitchBtn.disabled = data.count < 2;
                console.log(`Image captured, total count: ${data.count}`);
            } else {
                console.error('Capture failed:', data);
                alert(`Failed to capture: ${data.error}`);
            }
        } catch (error) {
            console.error('Failed to capture image:', error);
            alert('Failed to capture image: ' + error.message);
        }
    }

    async runAutofocus() {
        this.elements.autofocusBtn.disabled = true;
        this.elements.autofocusBtn.textContent = 'Running...';
        
        const numSteps = parseInt(this.elements.numSteps.value);
        const stepSize = parseInt(this.elements.stepSize.value);
        
        console.log(`Running autofocus: steps=${numSteps}, step_size=${stepSize}`);
        
        // Очищаем предыдущие результаты
        this.elements.autofocusResults.innerHTML = '<p class="message-info">Starting autofocus...</p>';
        this.elements.autofocusImage.innerHTML = '';
        
        try {
            const response = await fetch(`${this.apiUrl}/autofocus`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    num_steps: numSteps,
                    step_size: stepSize
                })
            });
            
            const data = await response.json();
            console.log('Autofocus response:', data);
            
            if (data.status === 'success') {
                this.displayAutofocusResults(data);
                this.loadBestFrame();
            } else {
                this.elements.autofocusResults.innerHTML = `
                    <p class="message" style="color: #ef4444;">Error: ${data.error}</p>
                `;
            }
        } catch (error) {
            console.error('Autofocus failed:', error);
            this.elements.autofocusResults.innerHTML = `
                <p class="message" style="color: #ef4444;">Failed to run autofocus</p>
            `;
        } finally {
            this.elements.autofocusBtn.disabled = false;
            this.elements.autofocusBtn.textContent = 'Run Autofocus';
        }
    }

    displayAutofocusResults(data) {
        const { results, best, total_steps } = data;
        
        let html = `<p class="message-info">Completed ${total_steps} steps</p>`;
        
        results.forEach((result) => {
            const isBest = result.step === best.step;
            const cssClass = isBest ? 'af-result-item best' : 'af-result-item';
            
            html += `
                <div class="${cssClass}">
                    <div class="step-info">
                        <span>Step ${result.step}: Z ${result.z_offset >= 0 ? '+' : ''}${result.z_offset}</span>
                        <span>${result.is_focused ? '✓ FOCUSED' : '✗ BLURRED'}</span>
                    </div>
                    <div class="variance-info">
                        Position: Z=${result.z_position >= 0 ? '+' : ''}${result.z_position} | 
                        Variance: ${result.variance.toFixed(2)}
                        ${isBest ? ' | 🌟 BEST' : ''}
                    </div>
                </div>
            `;
        });
        
        html += `
            <div style="margin-top: 15px; padding: 12px; background: #dcfce7; border-radius: 8px; border-left: 4px solid #10b981;">
                <strong>Best Focus Position:</strong><br>
                Z = ${best.z_offset >= 0 ? '+' : ''}${best.z_offset} 
                (absolute: ${best.z_position >= 0 ? '+' : ''}${best.z_position})<br>
                Variance: ${best.variance.toFixed(2)}
            </div>
        `;
        
        this.elements.autofocusResults.innerHTML = html;
    }

    async loadBestFrame() {
        try {
            const timestamp = new Date().getTime();
            this.elements.autofocusImage.innerHTML = `
                <img src="${this.apiUrl}/autofocus/best-frame?t=${timestamp}" alt="Best Focus Frame">
                <p style="text-align: center; margin-top: 10px; color: #10b981; font-weight: 600;">
                    Best focused image
                </p>
            `;
        } catch (error) {
            console.error('Failed to load best frame:', error);
        }
    }

    async stitchImages() {
        this.elements.stitchBtn.disabled = true;
        this.elements.stitchBtn.textContent = 'Stitching...';
        
        const method = this.elements.stitchMethod.value;
        console.log(`Stitching with method: ${method}`);
        
        try {
            const response = await fetch(`${this.apiUrl}/stitch?method=${method}`, { method: 'POST' });
            const data = await response.json();
            
            if (data.status === 'success') {
                const filename = data.filepath.split('/').pop();
                this.elements.stitchedResult.innerHTML = `
                    <img src="${this.apiUrl}/stitched/${filename}?t=${Date.now()}" alt="Stitched Result">
                    <p style="margin-top: 10px; color: #10b981; font-weight: 600;">
                        Successfully stitched ${data.count} images using ${data.method} method
                    </p>
                `;
            } else {
                this.elements.stitchedResult.innerHTML = `
                    <p class="message" style="color: #ef4444;">Error: ${data.error}</p>
                `;
            }
        } catch (error) {
            this.elements.stitchedResult.innerHTML = `
                <p class="message" style="color: #ef4444;">Failed to stitch images</p>
            `;
            console.error('Failed to stitch images:', error);
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
                this.elements.stitchedResult.innerHTML = '<p class="message">Cleared all images</p>';
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

    updateUI(data) {
        const { is_focused, current_variance, avg_variance, threshold, history, history_size } = data;

        this.elements.statusIndicator.className = `status-indicator ${is_focused ? 'focused' : 'blurred'}`;
        this.elements.statusText.textContent = is_focused ? 'FOCUSED' : 'BLURRED';
        this.elements.variance.textContent = current_variance.toFixed(2);
        this.elements.avgVariance.textContent = avg_variance.toFixed(2);
        this.elements.threshold.textContent = threshold.toFixed(2);
        this.elements.historySize.textContent = history_size;

        this.drawChart(history, threshold);
    }

    drawChart(history, threshold) {
        const canvas = this.elements.chart;
        const ctx = this.chartCtx;
        const width = canvas.width = canvas.offsetWidth;
        const height = canvas.height = canvas.offsetHeight;

        ctx.clearRect(0, 0, width, height);

        if (history.length === 0) return;

        const maxValue = Math.max(...history, threshold) * 1.2;
        const stepX = width / Math.max(history.length - 1, 1);
        const padding = 20;

        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        ctx.beginPath();

        history.forEach((value, index) => {
            const x = index * stepX;
            const y = height - padding - ((value / maxValue) * (height - padding * 2));
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        const thresholdY = height - padding - ((threshold / maxValue) * (height - padding * 2));
        ctx.beginPath();
        ctx.moveTo(0, thresholdY);
        ctx.lineTo(width, thresholdY);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = '#6b7280';
        ctx.font = '12px sans-serif';
        ctx.fillText(`Threshold: ${threshold.toFixed(2)}`, 5, thresholdY - 5);
    }
}

new WeldingFocusDetectionUI();