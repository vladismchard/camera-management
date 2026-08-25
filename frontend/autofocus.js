// frontend/autofocus.js
class AutofocusUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            autofocusBtn: document.getElementById('autofocusBtn'),
            numSteps: document.getElementById('numSteps'),
            stepSize: document.getElementById('stepSize'),
            autofocusResults: document.getElementById('autofocusResults'),
            framesGrid: document.getElementById('framesGrid'),
        };
        this.elements.autofocusBtn.addEventListener('click', () => this.runAutofocus());
        this.bestStep = null;
    }

    async runAutofocus() {
        this.elements.autofocusBtn.disabled = true;
        this.elements.autofocusBtn.textContent = 'Running...';
        this.elements.autofocusResults.innerHTML =
            '<p class="message-info">Running autofocus series...</p>';
        this.elements.framesGrid.innerHTML = '';
        this.bestStep = null;

        const numSteps = parseInt(this.elements.numSteps.value);
        const stepSize = parseInt(this.elements.stepSize.value);

        try {
            const response = await fetch(`${this.apiUrl}/autofocus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ num_steps: numSteps, step_size: stepSize })
            });
            const data = await response.json();

            if (data.status === 'success') {
                this.bestStep = data.best.step;
                this.displayResults(data);
                this.displayFrames(data.results);
            } else {
                this.elements.autofocusResults.innerHTML =
                    `<p class="message-error">Error: ${data.error}</p>`;
            }
        } catch (error) {
            this.elements.autofocusResults.innerHTML =
                `<p class="message-error">Failed to run autofocus</p>`;
        } finally {
            this.elements.autofocusBtn.disabled = false;
            this.elements.autofocusBtn.textContent = 'Run Autofocus';
        }
    }

    displayResults(data) {
        const { results, best, total_steps } = data;
        let html = `<p class="message-info">Completed ${total_steps} steps</p>`;

        results.forEach((result) => {
            const isBest = result.step === best.step;
            html += `
                <div class="af-result-item ${isBest ? 'best' : ''}">
                    <div class="step-info">
                        <span>Step ${result.step}: Z ${result.z_offset >= 0 ? '+' : ''}${result.z_offset}</span>
                        <span>${result.is_focused ? '✓ FOCUSED' : '✗ BLURRED'}</span>
                    </div>
                    <div class="variance-info">
                        Z=${result.z_position >= 0 ? '+' : ''}${result.z_position} |
                        Variance: ${result.variance.toFixed(2)} |
                        Threshold: ${result.adaptive_threshold.toFixed(2)}
                        ${isBest ? ' | 🌟 BEST' : ''}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="best-summary">
                <strong>Best Focus:</strong>
                Z = ${best.z_offset >= 0 ? '+' : ''}${best.z_offset}
                (abs: ${best.z_position >= 0 ? '+' : ''}${best.z_position}) |
                Variance: ${best.variance.toFixed(2)}
            </div>
        `;

        this.elements.autofocusResults.innerHTML = html;
    }

    displayFrames(results) {
        const grid = this.elements.framesGrid;
        grid.innerHTML = '';

        results.forEach((result) => {
            const isBest = result.step === this.bestStep;
            const timestamp = Date.now();

            const card = document.createElement('div');
            card.className = `frame-card ${isBest ? 'frame-best' : ''}`;

            card.innerHTML = `
                ${isBest ? '<div class="frame-best-badge">🌟 BEST</div>' : ''}
                <img
                    src="${this.apiUrl}/autofocus/frame/${result.step}?t=${timestamp}"
                    alt="Step ${result.step}"
                    loading="lazy"
                >
                <div class="frame-info">
                    <div class="frame-step">Step ${result.step} — Z ${result.z_offset >= 0 ? '+' : ''}${result.z_offset}</div>
                    <div class="frame-variance ${result.is_focused ? 'focused' : 'blurred'}">
                        ${result.is_focused ? '✓' : '✗'} ${result.variance.toFixed(2)}
                    </div>
                </div>
            `;

            grid.appendChild(card);
        });
    }
}

new AutofocusUI();