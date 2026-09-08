// frontend/autofocus.js
class AutofocusUI {
    constructor() {
        this.apiUrl = window.location.protocol + '//' + window.location.hostname + ':5000';
        this.elements = {
            startBtn: document.getElementById('startBtn'),
            numSteps: document.getElementById('numSteps'),
            stepSize: document.getElementById('stepSize'),
            resultsContainer: document.getElementById('resultsContainer'),
            bestFrame: document.getElementById('bestFrame')
        };
        
        this.modeToggle = new FocusModeToggle(this.apiUrl);
        
        this.elements.startBtn.addEventListener('click', () => this.startAutofocus());
    }

    async startAutofocus() {
        try {
            this.elements.startBtn.disabled = true;
            this.elements.startBtn.textContent = 'Running...';
            this.elements.resultsContainer.innerHTML = '<p>Scanning...</p>';

            const response = await fetch(`${this.apiUrl}/autofocus`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    num_steps: parseInt(this.elements.numSteps.value),
                    step_size: parseInt(this.elements.stepSize.value)
                })
            });

            const data = await response.json();

            if (data.status === 'success') {
                this.displayResults(data.results);
                this.displayBestFrame(data.best_frame);
            }
        } catch (error) {
            console.error('Autofocus failed:', error);
            this.elements.resultsContainer.innerHTML = '<p class="error">Failed to run autofocus</p>';
        } finally {
            this.elements.startBtn.disabled = false;
            this.elements.startBtn.textContent = 'Start Autofocus';
        }
    }

    displayResults(results) {
        this.elements.resultsContainer.innerHTML = results.map((r, i) => `
            <div class="result-item ${r.step === results.find(x => x.is_best).step ? 'best' : ''}">
                <span>Step ${r.step}</span>
                <span>Z: ${r.z_position}</span>
                <span>Variance: ${r.variance.toFixed(2)}</span>
                <span>${r.is_focused ? '✓' : '✗'}</span>
            </div>
        `).join('');
    }

    displayBestFrame(bestFrame) {
        this.elements.bestFrame.src = `${this.apiUrl}/autofocus/best-frame?t=${Date.now()}`;
    }
}

new AutofocusUI();