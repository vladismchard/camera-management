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

        this.modeToggle = new FocusModeToggle(this.apiUrl);
        this.modeToggle.onChange((autoMode) => this.onModeChanged(autoMode));

        this.elements.stream.src = `${this.apiUrl}/stream`;
        this.elements.checkFocusBtn.addEventListener('click', () => this.checkFocus());
        this.elements.applyThresholdBtn.addEventListener('click', () => this.applyThreshold());

        this.loadThresholdSettings();
        setInterval(() => this.fetchMetrics(), 2000);
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