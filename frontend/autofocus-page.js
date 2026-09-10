// frontend/autofocus-page.js
class AutofocusPageUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            autofocusBtn: document.getElementById('autofocusBtn'),
            numSteps: document.getElementById('numSteps'),
            stepSize: document.getElementById('stepSize'),
            autofocusResults: document.getElementById('autofocusResults'),
            autofocusImage: document.getElementById('autofocusImage')
        };

        this.modeToggle = new FocusModeToggle(this.apiUrl);
        this.elements.autofocusBtn.addEventListener('click', () => this.runAutofocus());
    }

    async runAutofocus() {
        this.elements.autofocusBtn.disabled = true;
        this.elements.autofocusBtn.textContent = 'Выполняется...';

        const numSteps = parseInt(this.elements.numSteps.value);
        const stepSize = parseInt(this.elements.stepSize.value);

        console.log(`Running autofocus: steps=${numSteps}, step_size=${stepSize}`);

        this.elements.autofocusResults.innerHTML = '<p class="message-info">Запуск сканирования автофокуса...</p>';
        this.elements.autofocusImage.innerHTML = '<p class="message-info">Обработка...</p>';

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
                    <p class="message-error">Ошибка: ${data.error || 'Неизвестная ошибка'}</p>
                `;
                this.elements.autofocusImage.innerHTML = `
                    <p class="message-error">Не удалось захватить кадры</p>
                `;
            }
        } catch (error) {
            console.error('Autofocus failed:', error);
            this.elements.autofocusResults.innerHTML = `
                <p class="message-error">Ошибка соединения: ${error.message}</p>
            `;
            this.elements.autofocusImage.innerHTML = `
                <p class="message-error">Нет доступа к серверу</p>
            `;
        } finally {
            this.elements.autofocusBtn.disabled = false;
            this.elements.autofocusBtn.textContent = 'Запустить автофокус';
        }
    }

    displayAutofocusResults(data) {
        const { results, best, total_steps } = data;

        let html = `<p class="message-info">Выполнено шагов: ${total_steps}</p>`;

        results.forEach((result) => {
            const isBest = result.step === best.step;
            const cssClass = isBest ? 'af-result-item best' : 'af-result-item';

            html += `
                <div class="${cssClass}">
                    <div class="step-info">
                        <span>Шаг ${result.step}: Z ${result.z_offset >= 0 ? '+' : ''}${result.z_offset}</span>
                        <span>${result.is_focused ? 'В ФОКУСЕ' : 'НЕ В ФОКУСЕ'}</span>
                    </div>
                    <div class="variance-info">
                        Позиция: Z=${result.z_position >= 0 ? '+' : ''}${result.z_position} |
                        Дисперсия: ${result.variance.toFixed(2)}
                        ${isBest ? ' | ЛУЧШИЙ' : ''}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="best-summary">
                <strong>Лучшая позиция фокуса:</strong><br>
                Z Смещение: ${best.z_offset >= 0 ? '+' : ''}${best.z_offset}<br>
                Z Абсолютная: ${best.z_position >= 0 ? '+' : ''}${best.z_position}<br>
                Дисперсия: ${best.variance.toFixed(2)}<br>
                ${best.is_focused ? 'В фокусе' : 'Ниже порога'}
            </div>
        `;

        this.elements.autofocusResults.innerHTML = html;
    }

    async loadBestFrame() {
        try {
            const timestamp = new Date().getTime();
            this.elements.autofocusImage.innerHTML = `
                <img src="${this.apiUrl}/autofocus/best-frame?t=${timestamp}" 
                     alt="Лучший кадр в фокусе" 
                     style="width: 100%; border-radius: 4px; border: 1px solid #1e1e1e;">
                <p style="text-align: center; margin-top: 12px; color: #2ecc8f; font-weight: 600; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em;">
                    Лучшее изображение в фокусе
                </p>
            `;
        } catch (error) {
            console.error('Failed to load best frame:', error);
            this.elements.autofocusImage.innerHTML = `
                <p class="message-error">Не удалось загрузить изображение</p>
            `;
        }
    }
}

new AutofocusPageUI();