// frontend/stream.js
class StreamUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            statusIndicator: document.getElementById('statusIndicator'),
            statusText: document.getElementById('statusText'),
            variance: document.getElementById('variance'),
            avgVariance: document.getElementById('avgVariance'),
            threshold: document.getElementById('threshold'),
            historySize: document.getElementById('historySize'),
            stream: document.getElementById('stream'),
            checkFocusBtn: document.getElementById('checkFocusBtn'),
            lastCheckTime: document.getElementById('lastCheckTime'),
        };
        this.elements.stream.src = `${this.apiUrl}/stream`;
        this.elements.checkFocusBtn.addEventListener('click', () => this.checkFocus());
        setInterval(() => this.fetchMetrics(), 2000);
    }

    async checkFocus() {
        try {
            this.elements.checkFocusBtn.disabled = true;
            this.elements.checkFocusBtn.textContent = 'Checking...';

            const response = await fetch(`${this.apiUrl}/focus/check`, { method: 'POST' });
            const data = await response.json();

            if (data.status === 'success') {
 
                this.elements.statusIndicator.className = `status-indicator ${data.is_focused ? 'focused' : 'blurred'}`;
                this.elements.statusText.textContent = data.is_focused ? '✓ FOCUSED' : '✗ BLURRED';
                
                this.elements.variance.textContent = data.variance.toFixed(2);
                this.elements.threshold.textContent = data.adaptive_threshold.toFixed(2);
                const now = new Date().toLocaleTimeString();
                this.elements.lastCheckTime.textContent = `Last check: ${now}`;
                this.elements.lastCheckTime.style.color = data.is_focused ? '#4ade80' : '#f87171';
            } else {
                this.elements.statusText.textContent = 'Error';
                console.error('Check failed:', data);
            }
        } catch (error) {
            console.error('Failed to check focus:', error);
            this.elements.statusText.textContent = 'Connection Error';
        } finally {
            this.elements.checkFocusBtn.disabled = false;
            this.elements.checkFocusBtn.textContent = 'Check Focus';
        }
    }

    async fetchMetrics() {
        try {
            const response = await fetch(`${this.apiUrl}/metrics`);
            const data = await response.json();
            if (this.elements.avgVariance.textContent === '—') {
                this.elements.avgVariance.textContent = data.avg_variance.toFixed(2);
            }
            this.elements.historySize.textContent = data.history_size;
            
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    }
}

new StreamUI();