// frontend/autofocus-page.js
class AutofocusPageUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            autofocusBtn: document.getElementById('autofocusBtn'),
            numSteps: document.getElementById('numSteps'),
            stepSize: document.getElementById('stepSize'),
            autofocusResults: document.getElementById('autofocusResults'),
            autofocusImage: document.getElementById('autofocusImage'),
            lightbox: document.getElementById('lightbox'),
            lightboxImg: document.getElementById('lightboxImg'),
            lightboxCaption: document.getElementById('lightboxCaption'),
            lightboxClose: document.getElementById('lightboxClose')
        };

        this.modeToggle = new FocusModeToggle(this.apiUrl);
        this.elements.autofocusBtn.addEventListener('click', () => this.runAutofocus());
        this.scanId = new Date().getTime();

        this.elements.lightboxClose.addEventListener('click', () => this.closeLightbox());
        this.elements.lightbox.addEventListener('click', (e) => {
            if (e.target === this.elements.lightbox) this.closeLightbox();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.closeLightbox();
        });

        this.elements.autofocusImage.addEventListener('click', (e) => {
            const frameEl = e.target.closest('.af-best-frame, .af-frame');
            if (!frameEl) return;
            const img = frameEl.querySelector('img');
            const caption = frameEl.querySelector('.af-frame-caption');
            this.openLightbox(img.src, caption ? caption.textContent.trim() : '');
        });
    }

    async runAutofocus() {
        this.elements.autofocusBtn.disabled = true;
        this.elements.autofocusBtn.textContent = 'Выполняется...';
        this.closeLightbox();

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

            if (data.status !== 'started') {
                this.elements.autofocusResults.innerHTML = `
                    <p class="message-error">Ошибка: ${data.error || 'Неизвестная ошибка'}</p>
                `;
                this.elements.autofocusImage.innerHTML = `
                    <p class="message-error">Не удалось захватить кадры</p>
                `;
                return;
            }

            this.scanId = new Date().getTime();
            this.elements.autofocusResults.innerHTML = '<p class="message-info">Сканирование запущено. Интервал между кадрами: 5 секунд</p>';

            let running = true;
            while (running) {
                await new Promise((r) => setTimeout(r, 500));
                const progress = await this.fetchProgress();
                if (progress === null) break;
                running = progress.running;

                const delay = progress.delay || 5;
                const startedAt = progress.started_at || 0;

                if (progress.results.length > 0) {
                    this.displayAutofocusResults({
                        results: progress.results,
                        best: progress.best,
                        total_steps: progress.results.length,
                        expected_steps: progress.expected_steps,
                        running: running,
                        delay: delay,
                        started_at: startedAt
                    });
                    this.renderFrames(progress.results, progress.best);
                } else if (running) {
                    const secondsLeft = this.secondsToNext(delay, startedAt, 0);
                    this.elements.autofocusResults.innerHTML = `
                        <p class="message-info">Захвачено кадров: 0 из ${progress.expected_steps}</p>
                    `;
                    this.elements.autofocusImage.innerHTML = `
                        <p class="message-info">Ожидание первого кадра... Через ~${secondsLeft} сек.</p>
                    `;
                } else if (!running) {
                    this.elements.autofocusImage.innerHTML = `
                        <p class="message-error">Не удалось захватить кадры</p>
                    `;
                }
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

    async fetchProgress() {
        try {
            const response = await fetch(`${this.apiUrl}/autofocus/progress`);
            return await response.json();
        } catch (error) {
            console.error('Failed to fetch autofocus progress:', error);
            return null;
        }
    }

    secondsToNext(delay, startedAt, numResults) {
        if (!startedAt) return delay;
        const elapsed = (Date.now() / 1000) - startedAt;
        const nextAt = (numResults + 1) * delay;
        return Math.max(0, Math.round(nextAt - elapsed));
    }

    displayAutofocusResults(data) {
        const { results, best, total_steps, expected_steps, running, delay, started_at } = data;

        let header;
        if (running) {
            const secondsLeft = this.secondsToNext(delay, started_at, results.length);
            header = `<p class="message-info">Захвачено кадров: ${total_steps} из ${expected_steps} · Следующий кадр через ~${secondsLeft} сек.</p>`;
        } else {
            header = `<p class="message-info">Выполнено шагов: ${total_steps}</p>`;
        }

        let html = header;

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

    renderFrames(results, best) {
        const timestamp = this.scanId;
        const bestStep = best ? best.step : results.reduce((acc, r) => (r.variance > acc.variance ? r : acc), results[0]).step;

        const sorted = [...results].sort((a, b) => {
            if (a.step === bestStep) return -1;
            if (b.step === bestStep) return 1;
            return a.step - b.step;
        });

        const bestFrame = sorted.find((r) => r.step === bestStep);

        let html = '';

        html += `<p class="af-frames-label">ЛУЧШИЙ КАДР</p>`;
        html += `
            <div class="af-best-frame">
                <div class="af-frame-caption">
                    <span>Шаг ${bestFrame.step}</span>
                    <span>Z ${bestFrame.z_offset >= 0 ? '+' : ''}${bestFrame.z_offset}</span>
                    <span>Дисперсия: ${bestFrame.variance.toFixed(2)}</span>
                    <span>${bestFrame.is_focused ? 'В ФОКУСЕ' : 'НЕ В ФОКУСЕ'}</span>
                </div>
                <img src="${this.apiUrl}/autofocus/frame/${bestFrame.step}?t=${timestamp}" 
                     alt="Лучший кадр (шаг ${bestFrame.step})">
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
    }

    openLightbox(src, caption) {
        this.elements.lightboxImg.src = src;
        this.elements.lightboxCaption.textContent = caption;
        this.elements.lightbox.hidden = false;
        document.body.style.overflow = 'hidden';
    }

    closeLightbox() {
        this.elements.lightbox.hidden = true;
        this.elements.lightboxImg.src = '';
        this.elements.lightboxCaption.textContent = '';
        document.body.style.overflow = '';
    }
}

new AutofocusPageUI();