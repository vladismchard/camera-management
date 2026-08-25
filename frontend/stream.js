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
        };
        this.elements.stream.src = `${this.apiUrl}/stream`;
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

    updateUI(data) {
        const { is_focused, current_variance, avg_variance, threshold, history_size } = data;

        this.elements.statusIndicator.className = `status-indicator ${is_focused ? 'focused' : 'blurred'}`;
        this.elements.statusText.textContent = is_focused ? 'FOCUSED' : 'BLURRED';
        this.elements.variance.textContent = current_variance.toFixed(2);
        this.elements.avgVariance.textContent = avg_variance.toFixed(2);
        this.elements.threshold.textContent = threshold.toFixed(2);
        this.elements.historySize.textContent = history_size;
    }
}

new StreamUI();