// frontend/app.js
class FocusDetectionUI {
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
            stream: document.getElementById('stream')
        };
        this.chartCtx = this.elements.chart.getContext('2d');
        this.elements.stream.src = `${this.apiUrl}/stream`;
        this.initMetricsPolling();
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

new FocusDetectionUI();