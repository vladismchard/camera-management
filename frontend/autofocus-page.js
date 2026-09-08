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
        this.elements.autofocusBtn.textContent = 'Running...';

        const numSteps = parseInt(this.elements.numSteps.value);
        const stepSize = parseInt(this.elements.stepSize.value);

        console.log(`Running autofocus: steps=${numSteps}, step_size=${stepSize}`);

        this.elements.autofocusResults.innerHTML = '<p class="message-info">Starting autofocus scan...</p>';
        this.elements.autofocusImage.innerHTML = '<p class="message-info">Processing...</p>';

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
                    <p class="message-error">Error: ${data.error || 'Unknown error'}</p>
                `;
                this.elements.autofocusImage.innerHTML = `
                    <p class="message-error">Failed to capture frames</p>
                `;
            }
        } catch (error) {
            console.error('Autofocus failed:', error);
            this.elements.autofocusResults.innerHTML = `
                <p class="message-error">Connection failed: ${error.message}</p>
            `;
            this.elements.autofocusImage.innerHTML = `
                <p class="message-error">Cannot reach backend</p>
            `;
        } finally {
            this.elements.autofocusBtn.disabled = false;
            this.elements.autofocusBtn.textContent = 'Run Autofocus';
        }
    }

    displayAutofocusResults(data) {
        const { results, best, total_steps } = data;

        let html = `<p class="message-info">✓ Completed ${total_steps} steps</p>`;

        results.forEach((result) => {
            const isBest = result.step === best.step;
            const cssClass = isBest ? 'af-result-item best' : 'af-result-item';

            html += `
                <div class="${cssClass}">
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
                <strong>✓ Best Focus Position:</strong><br>
                Z Offset: ${best.z_offset >= 0 ? '+' : ''}${best.z_offset}<br>
                Z Absolute: ${best.z_position >= 0 ? '+' : ''}${best.z_position}<br>
                Variance: ${best.variance.toFixed(2)}<br>
                ${best.is_focused ? '✓ In Focus' : '✗ Below Threshold'}
            </div>
        `;

        this.elements.autofocusResults.innerHTML = html;
    }

    async loadBestFrame() {
        try {
            const timestamp = new Date().getTime();
            this.elements.autofocusImage.innerHTML = `
                <img src="${this.apiUrl}/autofocus/best-frame?t=${timestamp}" 
                     alt="Best Focus Frame" 
                     style="width: 100%; border-radius: 4px; border: 1px solid #1e1e1e;">
                <p style="text-align: center; margin-top: 12px; color: #4ade80; font-weight: 600; font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.05em;">
                    ✓ Best Focused Image
                </p>
            `;
        } catch (error) {
            console.error('Failed to load best frame:', error);
            this.elements.autofocusImage.innerHTML = `
                <p class="message-error">Failed to load image</p>
            `;
        }
    }
}

new AutofocusPageUI();