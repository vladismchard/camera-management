// frontend/autofocus.js
class AutofocusUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            autofocusBtn: document.getElementById('autofocusBtn'),
            numSteps: document.getElementById('numSteps'),
            stepSize: document.getElementById('stepSize'),
            autofocusResults: document.getElementById('autofocusResults'),
            autofocusImage: document.getElementById('autofocusImage'),
        };
        this.elements.autofocusBtn.addEventListener('click', () => this.runAutofocus());
    }

    async runAutofocus() {
        this.elements.autofocusBtn.disabled = true;
        this.elements.autofocusBtn.textContent = 'Running...';
        this.elements.autofocusResults.innerHTML = '<p class="message-info">Starting autofocus...</p>';
        this.elements.autofocusImage.innerHTML = '';

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
                this.displayResults(data);
                this.loadBestFrame();
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
                        Position: Z=${result.z_position >= 0 ? '+' : ''}${result.z_position} |
                        Variance: ${result.variance.toFixed(2)}
                        ${isBest ? ' | 🌟 BEST' : ''}
                    </div>
                </div>
            `;
        });

        html += `
            <div class="best-summary">
                <strong>Best Focus Position:</strong><br>
                Z = ${best.z_offset >= 0 ? '+' : ''}${best.z_offset}
                (absolute: ${best.z_position >= 0 ? '+' : ''}${best.z_position})<br>
                Variance: ${best.variance.toFixed(2)}
            </div>
        `;

        this.elements.autofocusResults.innerHTML = html;
    }

    loadBestFrame() {
        const timestamp = Date.now();
        this.elements.autofocusImage.innerHTML = `
            <img src="${this.apiUrl}/autofocus/best-frame?t=${timestamp}" alt="Best Focus Frame">
            <p class="best-frame-label">Best focused image</p>
        `;
    }
}

new AutofocusUI();