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
        
        // Инициализация переключателя режима
        this.modeToggle = new FocusModeToggle(this.apiUrl);
        
        // Подписываемся на изменения режима
        this.modeToggle.onChange((autoMode) => {
            this.onModeChanged(autoMode);
        });
        
        this.elements.stream.src = `${this.apiUrl}/stream`;
        this.elements.checkFocusBtn.addEventListener('click', () => this.checkFocus());
        
        // Загружаем метрики раз в 2 секунды
        setInterval(() => this.fetchMetrics(), 2000);
    }

    onModeChanged(autoMode) {
        // В автоматическом режиме отключаем ручную кнопку
        if (autoMode) {
            this.elements.checkFocusBtn.disabled = true;
            this.elements.checkFocusBtn.textContent = 'Auto Mode Active';
            this.elements.statusText.textContent = 'Watching stream...';
            this.elements.statusIndicator.className = 'status-indicator';
        } else {
            this.elements.checkFocusBtn.disabled = false;
            this.elements.checkFocusBtn.textContent = 'Check Focus';
            this.elements.statusText.textContent = 'Press "Check Focus"';
        }
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
            
            // В автоматическом режиме обновляем все метрики из стрима
            if (this.modeToggle.getMode()) {
                this.elements.variance.textContent = data.current_variance.toFixed(2);
                this.elements.threshold.textContent = data.adaptive_threshold.toFixed(2);
                this.elements.statusIndicator.className = `status-indicator ${data.is_focused ? 'focused' : 'blurred'}`;
                this.elements.statusText.textContent = data.is_focused ? '✓ FOCUSED' : '✗ BLURRED';
            }
            
            this.elements.avgVariance.textContent = data.avg_variance.toFixed(2);
            this.elements.historySize.textContent = data.history_size;
            
        } catch (error) {
            console.error('Failed to fetch metrics:', error);
        }
    }
}

new StreamUI();