// frontend/focus-mode-toggle.js

class FocusModeToggle {
    constructor(apiUrl) {
        this.apiUrl = apiUrl;
        this.autoMode = false;
        this.callbacks = [];
        this.init();
    }

    async init() {
        // Создаём UI элемент
        this.createToggleUI();
        
        // Загружаем текущий режим с сервера
        await this.loadMode();
        
        // Настраиваем обработчик
        this.setupEventListeners();
    }

    createToggleUI() {
        const container = document.createElement('div');
        container.className = 'focus-mode-toggle';
        container.innerHTML = `
            <div class="toggle-container">
                <label class="toggle-label">
                    <input type="checkbox" id="focusModeToggle" class="toggle-checkbox">
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-text">
                    <span class="mode-icon"><svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><line x1="1" y1="8" x2="15" y2="8"/><line x1="8" y1="1" x2="8" y2="15"/></svg></span>
                    <span id="modeText">Manual Mode</span>
                </span>
            </div>
        `;
        
        // Вставляем в navbar
        const navbar = document.querySelector('.navbar');
        if (navbar) {
            navbar.appendChild(container);
        }
        
        this.checkbox = document.getElementById('focusModeToggle');
        this.modeText = document.getElementById('modeText');
    }

    setupEventListeners() {
        this.checkbox.addEventListener('change', async (e) => {
            await this.toggleMode(e.target.checked);
        });
    }

    async loadMode() {
        try {
            const response = await fetch(`${this.apiUrl}/focus/mode`);
            const data = await response.json();
            this.autoMode = data.auto_mode;
            this.updateUI();
        } catch (error) {
            console.error('Failed to load focus mode:', error);
        }
    }

    async toggleMode(enabled) {
        try {
            const response = await fetch(`${this.apiUrl}/focus/mode`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ auto_mode: enabled })
            });
            
            const data = await response.json();
            if (data.status === 'success') {
                this.autoMode = data.auto_mode;
                this.updateUI();
                this.notifyCallbacks();
            }
        } catch (error) {
            console.error('Failed to toggle focus mode:', error);
            // Откатываем UI при ошибке
            this.checkbox.checked = this.autoMode;
        }
    }

    updateUI() {
        this.checkbox.checked = this.autoMode;
        this.modeText.textContent = this.autoMode ? 'Auto Mode' : 'Manual Mode';
        this.modeText.style.color = this.autoMode ? '#2ecc8f' : '#4f8cff';
    }

    // Позволяет другим компонентам подписаться на изменения режима
    onChange(callback) {
        this.callbacks.push(callback);
    }

    notifyCallbacks() {
        this.callbacks.forEach(cb => cb(this.autoMode));
    }

    getMode() {
        return this.autoMode;
    }
}

window.FocusModeToggle = FocusModeToggle;