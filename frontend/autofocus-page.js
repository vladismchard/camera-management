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
                this.loadAllFrames(data.results, data.best);
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

    async loadAllFrames(results, best) {
        try {
            const timestamp = new Date().getTime();
            const bestStep = best ? best.step : null;

            const sorted = [...results].sort((a, b) => {
                if (a.step === bestStep) return -1;
                if (b.step === bestStep) return 1;
                return a.step - b.step;
            });

            let html = '';

            html += `
                <p class="af-frames-label">ЛУЧШИЙ КАДР</p>
                <div class="af-best-frame">
                    <div class="af-frame-caption">
                        <span>Шаг ${best.step}</span>
                        <span>Z ${best.z_offset >= 0 ? '+' : ''}${best.z_offset}</span>
                        <span>Дисперсия: ${best.variance.toFixed(2)}</span>
                        <span>${best.is_focused ? 'В ФОКУСЕ' : 'НЕ В ФОКУСЕ'}</span>
                    </div>
                    <img src="${this.apiUrl}/autofocus/frame/${best.step}?t=${timestamp}" 
                         alt="Лучший кадр (шаг ${best.step})">
                </div>
            `;

            const others = sorted.filter((r) => r.step !== bestStep);

            if (others.length > 0) {
                html += `<p class="af-frames-label">ВСЕ КАДРЫ</p>`;
                html += `<div class="frames-grid">`;

                others.forEach((result) => {
                    html += `
                        <div class="af-frame">
                            <div class="af-frame-caption">
                                <span>Шаг ${result.step}</span>
                                <span>Z ${result.z_offset >= 0 ? '+' : ''}${result.z_offset}</span>
                                <span>Дисперсия: ${result.variance.toFixed(2)}</span>
                                <span>${result.is_focused ? 'В ФОКУСЕ' : 'НЕ В ФОКУСЕ'}</span>
                            </div>
                            <img src="${this.apiUrl}/autofocus/frame/${result.step}?t=${timestamp}" 
                                 alt="Кадр шага ${result.step}">
                        </div>
                    `;
                });

                html += `</div>`;
            }

            this.elements.autofocusImage.innerHTML = html;
        } catch (error) {
            console.error('Failed to load frames:', error);
            this.elements.autofocusImage.innerHTML = `
                <p class="message-error">Не удалось загрузить изображения</p>
            `;
        }
    }
}

new AutofocusPageUI();