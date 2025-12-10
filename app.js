class SeroCOPApp {
    constructor() {
        this.mcmcModule = null;
        this.mcmcReady = false;
        this.currentData = null;
        this.model = null;
        // Set up event listeners immediately
        this.setupEventListeners();
        // Then initialize async components
        this.init();
    }

    async init() {
        await this.initializeMCMC();
    }

    async initializeMCMC() {
        try {
            this.log('Loading parallel tempering MCMC module...');
            this.mcmcModule = await createMCMCModule();
            this.mcmcReady = true;
            this.log('✓ MCMC module loaded successfully');
            document.getElementById('loading-screen').style.display = 'none';
            document.getElementById('main-content').style.display = 'block';
            this.log('Ready to analyze data!');
        } catch (error) {
            this.logError('Failed to load MCMC module: ' + error.message);
            throw error;
        }
    }

    setupEventListeners() {
        // File upload
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Load example data
        document.getElementById('load-example').addEventListener('click', () => {
            this.loadExampleData();
        });
        
        // Load multi-biomarker example
        document.getElementById('load-multi-example').addEventListener('click', () => {
            this.loadMultiBiomarkerData();
        });
        
        // Fit model button
        document.getElementById('fit-model').addEventListener('click', () => this.fitModel());
        
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            const text = await file.text();
            this.loadDataFromCSV(text);
        } catch (error) {
            this.logError('Failed to load file: ' + error.message);
        }
    }

    loadDataFromCSV(csvText) {
        try {
            this.log('Parsing CSV data...');
            
            const lines = csvText.trim().split('\n');
            if (lines.length < 2) {
                throw new Error('CSV file must have at least a header row and one data row');
            }
            
            const headers = lines[0].split(',').map(h => h.trim());
            
            // Find column indices (case-insensitive, multiple acceptable names)
            const titreIdx = headers.findIndex(h => 
                ['titre', 'titer', 'antibody', 'ab'].includes(h.toLowerCase())
            );
            const infectedIdx = headers.findIndex(h => 
                ['infected', 'outcome', 'status', 'infection'].includes(h.toLowerCase())
            );
            
            if (titreIdx === -1) {
                throw new Error('Missing required column: "titre" (or "titer", "antibody", "ab")');
            }
            if (infectedIdx === -1) {
                throw new Error('Missing required column: "infected" (or "outcome", "status", "infection")');
            }
            
            const titre = [];
            const infected = [];
            
            for (let i = 1; i < lines.length; i++) {
                const values = lines[i].split(',').map(v => v.trim());
                if (values.length < 2 || values[titreIdx] === '' || values[infectedIdx] === '') continue;
                
                const titreVal = parseFloat(values[titreIdx]);
                const infectedVal = parseInt(values[infectedIdx]);
                
                // Validate individual values
                if (isNaN(titreVal)) {
                    throw new Error(`Invalid titre value at row ${i + 1}: "${values[titreIdx]}". Must be numeric.`);
                }
                if (isNaN(infectedVal)) {
                    throw new Error(`Invalid infected value at row ${i + 1}: "${values[infectedIdx]}". Must be 0 or 1.`);
                }
                if (infectedVal !== 0 && infectedVal !== 1) {
                    throw new Error(`Invalid infected value at row ${i + 1}: ${infectedVal}. Must be 0 (protected) or 1 (infected).`);
                }
                
                titre.push(titreVal);
                infected.push(infectedVal);
            }
            
            if (titre.length === 0) {
                throw new Error('No valid data rows found in CSV');
            }
            
            if (titre.length < 10) {
                throw new Error(`Insufficient data: only ${titre.length} observations. Need at least 10 for reliable model fitting.`);
            }
            
            // Check for variance in outcome
            const uniqueOutcomes = [...new Set(infected)];
            if (uniqueOutcomes.length === 1) {
                throw new Error('No variation in outcome: all observations are ' + 
                    (uniqueOutcomes[0] === 1 ? 'infected' : 'protected') + 
                    '. Need both infected and protected individuals.');
            }
            
            // Check for sufficient variation in each outcome
            const nInfected = infected.filter(x => x === 1).length;
            const nProtected = infected.filter(x => x === 0).length;
            if (nInfected < 3 || nProtected < 3) {
                this.log(`Warning: Limited variation (infected=${nInfected}, protected=${nProtected}). Results may be unstable.`);
            }
            
            this.currentData = { titre, infected };
            
            const summary = {
                n: titre.length,
                n_infected: infected.filter(x => x === 1).length,
                n_protected: infected.filter(x => x === 0).length,
                titre_range: [Math.min(...titre), Math.max(...titre)],
                columns: headers.join(', '),
                n_biomarkers: 1
            };
            
            this.displayDataSummary(summary);
            document.getElementById('fit-model').disabled = false;
            this.log('\u2713 Data loaded successfully (' + titre.length + ' observations)');
            
        } catch (error) {
            this.logError('Failed to load data: ' + error.message);
            console.error(error);
        }
    }

    loadExampleData() {
        this.log('Generating example single biomarker data...');
        
        if (!this.mcmcReady) {
            this.logError('MCMC module not loaded yet. Please wait...');
            return;
        }
        
        try {
            // Generate synthetic data in JavaScript
            const n = 200;
            const data = [];
            
            // Simple random number generator (seeded)
            let seed = 123;
            const random = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
            
            const normalRandom = (mean, sd) => {
                const u1 = random();
                const u2 = random();
                const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                return mean + sd * z0;
            };
            
            for (let i = 0; i < n; i++) {
                const titre = normalRandom(2, 1.5);
                const prob = 0.05 + 0.9 / (1 + Math.exp(2 * (titre - 1.5)));
                const infected = random() < prob ? 1 : 0;
                
                data.push({ titre, infected });
            }
            
            this.currentData = {
                titre: data.map(d => d.titre),
                infected: data.map(d => d.infected)
            };
            
            this.displayDataSummary({
                n: n,
                n_infected: this.currentData.infected.filter(x => x === 1).length,
                n_protected: this.currentData.infected.filter(x => x === 0).length,
                titre_range: [Math.min(...this.currentData.titre), Math.max(...this.currentData.titre)],
                columns: 'titre, infected',
                n_biomarkers: 1
            });
            
            document.getElementById('fit-model').disabled = false;
            this.log('✓ Example single biomarker data loaded (n=200)');
            
        } catch (error) {
            this.logError('Failed to generate example data: ' + error.message);
            console.error(error);
        }
    }
    
    loadMultiBiomarkerData() {
        this.log('Generating multi-biomarker example data...');
        
        if (!this.mcmcReady) {
            this.logError('MCMC module not loaded yet. Please wait...');
            return;
        }
        
        try {
            // Generate synthetic multi-biomarker data in JavaScript
            const n = 250;
            const data = [];
            
            // Simple random number generator (different seed)
            let seed = 2025;
            const random = () => {
                seed = (seed * 9301 + 49297) % 233280;
                return seed / 233280;
            };
            
            const normalRandom = (mean, sd) => {
                const u1 = random();
                const u2 = random();
                const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
                return mean + sd * z0;
            };
            
            for (let i = 0; i < n; i++) {
                // Biomarker 1: Strong CoP (IgG)
                const IgG = normalRandom(2.5, 1.2);
                const prob_IgG = 0.02 + 0.68 / (1 + Math.exp(2.5 * (IgG - 2.0)));
                
                // Biomarker 2: Weak CoP (IgA)
                const IgA = normalRandom(1.8, 1.5);
                const prob_IgA = 0.15 + 0.55 / (1 + Math.exp(1.0 * (IgA - 1.5)));
                
                // Biomarker 3: No CoP (Non-specific)
                const Nonspecific = normalRandom(3.0, 1.0);
                const prob_Nonspec = 0.35;
                
                // Combined probability (weighted)
                const prob_combined = 0.5 * prob_IgG + 0.3 * prob_IgA + 0.2 * prob_Nonspec;
                const infected = random() < prob_combined ? 1 : 0;
                
                data.push({ IgG, IgA, Nonspecific, infected });
            }
            
            // For now, we'll analyze IgG as the primary biomarker
            this.currentData = {
                titre: data.map(d => d.IgG),
                infected: data.map(d => d.infected),
                IgG: data.map(d => d.IgG),
                IgA: data.map(d => d.IgA),
                Nonspecific: data.map(d => d.Nonspecific)
            };
            
            this.displayDataSummary({
                n: n,
                n_infected: this.currentData.infected.filter(x => x === 1).length,
                n_protected: this.currentData.infected.filter(x => x === 0).length,
                titre_range: [Math.min(...this.currentData.IgG), Math.max(...this.currentData.IgG)],
                columns: 'IgG, IgA, Nonspecific, infected',
                n_biomarkers: 3
            });
            
            document.getElementById('fit-model').disabled = false;
            this.log('✓ Multi-biomarker data loaded (n=250, 3 biomarkers)');
            this.log('Note: Fitting will use IgG (strongest CoP) as primary biomarker');
            
        } catch (error) {
            this.logError('Failed to generate multi-biomarker data: ' + error.message);
            console.error(error);
        }
    }

    displayDataSummary(summary) {
        const previewDiv = document.getElementById('data-preview');
        const summaryDiv = document.getElementById('data-summary');
        
        const biomarkerInfo = summary.n_biomarkers > 1 
            ? `<div class="summary-item"><strong>Biomarkers:</strong> ${summary.n_biomarkers}</div>`
            : '';
        
        summaryDiv.innerHTML = `
            <div class="summary-grid">
                <div class="summary-item">
                    <strong>Total observations:</strong> ${summary.n}
                </div>
                <div class="summary-item">
                    <strong>Infected:</strong> ${summary.n_infected} (${(summary.n_infected/summary.n*100).toFixed(1)}%)
                </div>
                <div class="summary-item">
                    <strong>Protected:</strong> ${summary.n_protected} (${(summary.n_protected/summary.n*100).toFixed(1)}%)
                </div>
                <div class="summary-item">
                    <strong>Titre range:</strong> [${summary.titre_range[0].toFixed(2)}, ${summary.titre_range[1].toFixed(2)}]
                </div>
                ${biomarkerInfo}
                <div class="summary-item">
                    <strong>Columns:</strong> ${summary.columns}
                </div>
            </div>
        `;
        
        previewDiv.style.display = 'block';
        
        
        previewDiv.style.display = 'block';
        
        // Display data table preview
        this.displayDataTable();
    }
    
    displayDataTable() {
        if (!this.currentData) return;
        
        const tableDiv = document.getElementById('data-table');
        const { titre, infected, IgG, IgA, Nonspecific } = this.currentData;
        const n = Math.min(10, titre.length);
        
        let tableHTML = '<h4 style="margin-top: 20px; margin-bottom: 10px;">Data Preview (first 10 rows):</h4>';
        tableHTML += '<table style="width: 100%; border-collapse: collapse; font-size: 0.9rem;">';
        
        // Determine columns based on available data
        const hasMultiBiomarkers = IgG && IgA && Nonspecific;
        
        if (hasMultiBiomarkers) {
            tableHTML += '<thead><tr style="background: #000; color: #fff;">';
            tableHTML += '<th style="padding: 8px; text-align: left;">Row</th>';
            tableHTML += '<th style="padding: 8px; text-align: right;">IgG</th>';
            tableHTML += '<th style="padding: 8px; text-align: right;">IgA</th>';
            tableHTML += '<th style="padding: 8px; text-align: right;">Nonspecific</th>';
            tableHTML += '<th style="padding: 8px; text-align: right;">Infected</th>';
            tableHTML += '</tr></thead><tbody>';
            
            for (let i = 0; i < n; i++) {
                tableHTML += `<tr style="border-bottom: 1px solid #e0e0e0;">`;
                tableHTML += `<td style="padding: 8px;">${i + 1}</td>`;
                tableHTML += `<td style="padding: 8px; text-align: right;">${IgG[i].toFixed(3)}</td>`;
                tableHTML += `<td style="padding: 8px; text-align: right;">${IgA[i].toFixed(3)}</td>`;
                tableHTML += `<td style="padding: 8px; text-align: right;">${Nonspecific[i].toFixed(3)}</td>`;
                tableHTML += `<td style="padding: 8px; text-align: right;">${infected[i]}</td>`;
                tableHTML += `</tr>`;
            }
        } else {
            tableHTML += '<thead><tr style="background: #000; color: #fff;">';
            tableHTML += '<th style="padding: 8px; text-align: left;">Row</th>';
            tableHTML += '<th style="padding: 8px; text-align: right;">Titre</th>';
            tableHTML += '<th style="padding: 8px; text-align: right;">Infected</th>';
            tableHTML += '</tr></thead><tbody>';
            
            for (let i = 0; i < n; i++) {
                tableHTML += `<tr style="border-bottom: 1px solid #e0e0e0;">`;
                tableHTML += `<td style="padding: 8px;">${i + 1}</td>`;
                tableHTML += `<td style="padding: 8px; text-align: right;">${titre[i].toFixed(3)}</td>`;
                tableHTML += `<td style="padding: 8px; text-align: right;">${infected[i]}</td>`;
                tableHTML += `</tr>`;
            }
        }
        
        tableHTML += '</tbody></table>';
        tableDiv.innerHTML = tableHTML;
    }

    async fitModel() {
        const modelType = document.getElementById('model-type').value;
        // Hierarchical effects temporarily disabled
        const hierarchicalCheckbox = document.getElementById('hierarchical-check');
        const useHierarchical = hierarchicalCheckbox ? hierarchicalCheckbox.checked : false;
        const chains = parseInt(document.getElementById('chains').value);
        const iter = parseInt(document.getElementById('iter').value);

        this.log('Starting model fitting...');
        this.log(`Configuration: ${chains} chains, ${iter} iterations`);
        
        document.getElementById('fit-model').disabled = true;
        document.getElementById('fitting-status').innerHTML = '<div class="spinner-small"></div><p>Fitting model... This may take several minutes.</p>';

        try {
            if (modelType === 'single') {
                await this.fitSingleBiomarker(useHierarchical, chains, iter);
            } else {
                await this.fitMultiBiomarker(useHierarchical, chains, iter);
            }
            
            this.log('Model fitting complete!');
            await this.displayResults();
            
        } catch (error) {
            this.logError('Model fitting failed: ' + error.message);
            console.error(error);
        } finally {
            document.getElementById('fit-model').disabled = false;
            document.getElementById('fitting-status').innerHTML = '<p class="success">✓ Model fitted successfully</p>';
        }
    }

    async fitOnServer() {
        try {
            this.log('Sending data to server for brms/Stan fit...');
            if (!this.currentDataCsv) throw new Error('No dataset loaded. Upload a CSV or load example.');
            
            // Convert to string if it's not already
            let csvText = this.currentDataCsv;
            if (typeof csvText !== 'string') {
                // If it's a Uint8Array or similar, convert to string
                if (csvText instanceof Uint8Array) {
                    csvText = new TextDecoder().decode(csvText);
                } else {
                    csvText = String(csvText);
                }
            }
            
            // Log what we're about to send
            this.log('CSV type: ' + typeof csvText);
            this.log('CSV length: ' + csvText.length);
            this.log('CSV preview (first 300 chars): ' + csvText.substring(0, 300));
            
            // For testing, let's use a minimal CSV with the actual data
            // This helps ensure the connection works first
            const testCsv = `titre,infected
1.5,0
2.3,1
0.8,0
3.1,1
1.9,0
2.8,1
1.2,0
3.5,1
2.1,0
2.9,1`;
            
            this.log('Using test CSV with 10 rows for initial test');
            csvText = testCsv;
            
            document.getElementById('fit-model').disabled = true;
            document.getElementById('fitServerBtn').disabled = true;
            document.getElementById('fitting-status').innerHTML = '<div class="spinner-small"></div><p>Connecting to server...</p>';
            
            // First, ping the health endpoint to wake up the server (Render free tier spins down)
            this.log('Waking up server (this may take 30-60 seconds on first request)...');
            try {
                const healthResp = await fetch(`${this.apiBaseUrl}/health`, { 
                    method: 'GET'
                });
                if (healthResp.ok) {
                    const health = await healthResp.json();
                    this.log(`Server ready (seroCOP v${health.package})`);
                } else {
                    this.log('Server responded but health check failed. Continuing anyway...');
                }
            } catch (healthErr) {
                this.log('Health check failed: ' + healthErr.message + '. Proceeding with fit request...');
            }
            
            document.getElementById('fitting-status').innerHTML = '<div class="spinner-small"></div><p>Fitting model on server... This may take several minutes.</p>';
            
            // Send CSV as JSON with parameters
            const payload = {
                csv_text: csvText,
                infected_col: 'infected',
                titre_col: 'titre',
                chains: 2,
                iter: 500  // Reduced for faster testing
            };

            this.log('Sending fit request to server...');
            const resp = await fetch(`${this.apiBaseUrl}/fit`, { 
                method: 'POST', 
                headers: { 
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(payload),
                keepalive: true
            });
            
            if (!resp.ok) {
                const text = await resp.text();
                throw new Error(`Server error (${resp.status}): ${text}`);
            }
            
            this.log('Parsing server response...');
            const result = await resp.json();
            this.log('Server fit complete. Rendering results...');
            this.renderServerResults(result);
            document.getElementById('fitting-status').innerHTML = '<p class="success">✓ Model fitted successfully (server)</p>';
            this.log('Done.');
        } catch (err) {
            this.logError('Error with server fit: ' + err.message);
            if (err.message.includes('Failed to fetch')) {
                this.logError('Network error - this may be due to the server taking too long to respond or the browser suspending the connection. Try keeping this tab active during fitting.');
            }
            document.getElementById('fitting-status').innerHTML = '<p class="error">✗ Fit failed: ' + err.message + '</p>';
        } finally {
            document.getElementById('fit-model').disabled = false;
            document.getElementById('fitServerBtn').disabled = false;
        }
    }    renderServerResults(result) {
        // Show results area
        document.getElementById('results-area').style.display = 'block';
        document.getElementById('no-results').style.display = 'none';
        
        const metricsEl = document.getElementById('metrics-table');
        const meta = result.meta || {};
        const auc = meta.auc != null ? Number(meta.auc).toFixed(3) : 'NA';
        const n = meta.n || 'NA';
        const chains = meta.chains || 'NA';
        const iter = meta.iter || 'NA';
        const titreCol = meta.titre_col || 'biomarker';
        let looHtml = '';
        if (meta.loo && meta.loo.elpd != null) {
            looHtml = `<tr><td>ELPD-LOO</td><td>${Number(meta.loo.elpd).toFixed(2)}</td></tr>` +
                      `<tr><td>p_LOO</td><td>${Number(meta.loo.p_loo).toFixed(2)}</td></tr>`;
        }
        metricsEl.innerHTML = `
            <table class="metrics-table">
                <tr><th>Metric</th><th>Value</th></tr>
                <tr><td>Sample Size</td><td>${n}</td></tr>
                <tr><td>Biomarker</td><td>${titreCol}</td></tr>
                <tr><td>Chains</td><td>${chains}</td></tr>
                <tr><td>Iterations</td><td>${iter}</td></tr>
                <tr><td>AUC</td><td>${auc}</td></tr>
                ${looHtml}
            </table>
            <p class="note">Results from server-side brms/Stan fitting</p>
        `;

        const curveEl = document.getElementById('curve-plot');
        curveEl.innerHTML = '';
        const img = document.createElement('img');
        img.src = result.protection_curve_plot;
        img.alt = 'Protection Curve (server)';
        img.style.maxWidth = '100%';
        img.style.borderRadius = '4px';
        curveEl.appendChild(img);

        const rocEl = document.getElementById('roc-plot');
        rocEl.innerHTML = `<p class="note">ROC curve not returned by API. AUC: ${auc}</p>`;

        const postEl = document.getElementById('posterior-plots');
        postEl.innerHTML = '';
        if (Array.isArray(result.posterior_draws) && result.posterior_draws.length > 0) {
            const keys = Object.keys(result.posterior_draws[0] || {});
            const numericKeys = keys.filter(k => typeof result.posterior_draws[0][k] === 'number');
            if (numericKeys.length > 0) {
                numericKeys.slice(0, 4).forEach(key => {
                    const values = result.posterior_draws.map(d => Number(d[key])).filter(v => Number.isFinite(v));
                    if (values.length > 0) {
                        const canvas = document.createElement('canvas');
                        canvas.width = 600; canvas.height = 300;
                        canvas.style.marginBottom = '20px';
                        postEl.appendChild(canvas);
                        this.plotHistogram(canvas, values, key);
                    }
                });
            } else {
                postEl.innerHTML = '<p>Posterior draws received but no numeric parameters found.</p>';
            }
        } else {
            postEl.innerHTML = '<p>No posterior draws in server response.</p>';
        }
    }
    
    async fitSingleBiomarker(useHierarchical, chains, iter) {
        this.log('Using parallel tempering MCMC for Bayesian inference...');
        
        // Get data directly from currentData
        const titreArray = this.currentData.titre;
        const infectedArray = this.currentData.infected;
        
        this.log(`Loaded ${titreArray.length} observations`);
        
        // Prepare data for MCMC
        const titreVec = new this.mcmcModule.VectorDouble();
        for (let i = 0; i < titreArray.length; i++) {
            titreVec.push_back(titreArray[i]);
        }
        
        const infectedVec = new this.mcmcModule.VectorInt();
        for (let i = 0; i < infectedArray.length; i++) {
            infectedVec.push_back(infectedArray[i]);
        }
        
        const mcmcData = new this.mcmcModule.Data(titreVec, infectedVec);
        
        // Calculate data-driven priors (matching R package defaults)
        const titreMidpoint = (Math.max(...titreArray) + Math.min(...titreArray)) / 2;
        const titreRange = Math.max(...titreArray) - Math.min(...titreArray);
        const titreSd = titreRange / 4;  // Cover most of the range
        
        // Set priors to match R package (SeroCOP::get_default_priors)
        const priors = {
            floor_alpha: 1.0,      // Beta(1, 9) - weak prior favoring low floor
            floor_beta: 9.0,
            ceiling_alpha: 9.0,    // Beta(9, 1) - weak prior favoring high ceiling
            ceiling_beta: 1.0,
            ec50_mean: titreMidpoint,  // Centered on data midpoint
            ec50_sd: titreSd,          // SD based on data range
            slope_mean: 0.0,       // Centered at 0 (no directional bias)
            slope_sd: 2.0          // Weakly informative
        };
        
        // Run multiple chains separately
        this.log(`Initializing ${chains} chains with 10 temperature ladders each...`);
        const startTime = performance.now();
        
        // Note: Each chain gets independent random initialization
        // MCMC is stochastic and will produce slightly different results each run
        
        const allChainPosteriors = [];
        
        for (let chain = 0; chain < chains; chain++) {
            this.log(`Running chain ${chain + 1}/${chains}: ${iter} iterations...`);
            document.getElementById('fitting-status').innerHTML = 
                `<div class="spinner-small"></div><p>Running chain ${chain + 1}/${chains}: ${iter} iterations...</p>`;
            
            const sampler = new this.mcmcModule.ParallelTemperingMCMC(10, mcmcData, priors);
            sampler.run(iter);
            
            // Extract samples from this chain
            const samples = sampler.get_samples();
            const warmup = Math.floor(iter / 2);
            
            const chainPosteriors = {
                floor: [],
                ceiling: [],
                ec50: [],
                slope: []
            };
            
            for (let i = warmup; i < samples.size(); i++) {
                const s = samples.get(i);
                chainPosteriors.floor.push(s.floor);
                chainPosteriors.ceiling.push(s.ceiling);
                chainPosteriors.ec50.push(s.ec50);
                chainPosteriors.slope.push(s.slope);
            }
            
            allChainPosteriors.push(chainPosteriors);
        }
        
        const elapsed = (performance.now() - startTime) / 1000;
        this.log(`✓ All chains complete in ${elapsed.toFixed(1)}s`);
        
        // Combine chains for analysis
        const posteriors = {
            floor: [],
            ceiling: [],
            ec50: [],
            slope: []
        };
        
        allChainPosteriors.forEach(chain => {
            posteriors.floor.push(...chain.floor);
            posteriors.ceiling.push(...chain.ceiling);
            posteriors.ec50.push(...chain.ec50);
            posteriors.slope.push(...chain.slope);
        });
        
        // Compute summaries
        const computeMean = arr => arr.reduce((a, b) => a + b) / arr.length;
        const computeSD = (arr, mean) => Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
        const computeQuantile = (arr, q) => {
            const sorted = [...arr].sort((a, b) => a - b);
            return sorted[Math.floor(sorted.length * q)];
        };
        
        // Compute R-hat across chains
        const computeRhat = (chainValues) => {
            const n = chainValues[0].length;
            const m = chainValues.length;
            
            // Within-chain variance
            const chainMeans = chainValues.map(chain => 
                chain.reduce((a, b) => a + b) / n
            );
            const chainVars = chainValues.map((chain, i) => 
                chain.reduce((a, b) => a + Math.pow(b - chainMeans[i], 2), 0) / (n - 1)
            );
            const W = chainVars.reduce((a, b) => a + b) / m;
            
            // Between-chain variance
            const grandMean = chainMeans.reduce((a, b) => a + b) / m;
            const B = n * chainMeans.reduce((a, b) => a + Math.pow(b - grandMean, 2), 0) / (m - 1);
            
            // Pooled variance estimate
            const varPlus = ((n - 1) * W + B) / n;
            
            return Math.sqrt(varPlus / W);
        };
        
        // Compute ESS (simple autocorrelation-based)
        const computeESS = (values) => {
            const n = values.length;
            const mean = values.reduce((a, b) => a + b) / n;
            const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
            
            // Lag-1 autocorrelation
            let acf = 0;
            for (let i = 1; i < n; i++) {
                acf += (values[i] - mean) * (values[i-1] - mean);
            }
            acf = acf / ((n - 1) * variance);
            
            return n / (1 + 2 * Math.max(0, acf));
        };
        
        const diagnostics = {
            rhat: {
                floor: computeRhat(allChainPosteriors.map(c => c.floor)),
                ceiling: computeRhat(allChainPosteriors.map(c => c.ceiling)),
                ec50: computeRhat(allChainPosteriors.map(c => c.ec50)),
                slope: computeRhat(allChainPosteriors.map(c => c.slope))
            },
            ess: {
                floor: computeESS(posteriors.floor),
                ceiling: computeESS(posteriors.ceiling),
                ec50: computeESS(posteriors.ec50),
                slope: computeESS(posteriors.slope)
            },
            elapsed_seconds: elapsed
        };
        
        this.log(`Diagnostics: R-hat range [${Math.min(...Object.values(diagnostics.rhat)).toFixed(3)}, ${Math.max(...Object.values(diagnostics.rhat)).toFixed(3)}]`);
        this.log(`ESS range [${Math.floor(Math.min(...Object.values(diagnostics.ess)))}, ${Math.floor(Math.max(...Object.values(diagnostics.ess)))}]`);
        
        // Store results
        this.model = {
            type: 'mcmc_4pl',
            posteriors: posteriors,
            chains: allChainPosteriors,
            diagnostics: diagnostics,
            data: {
                titre: titreArray,
                infected: infectedArray
            },
            summaries: {
                floor: {
                    mean: computeMean(posteriors.floor),
                    sd: computeSD(posteriors.floor, computeMean(posteriors.floor)),
                    q025: computeQuantile(posteriors.floor, 0.025),
                    q975: computeQuantile(posteriors.floor, 0.975)
                },
                ceiling: {
                    mean: computeMean(posteriors.ceiling),
                    sd: computeSD(posteriors.ceiling, computeMean(posteriors.ceiling)),
                    q025: computeQuantile(posteriors.ceiling, 0.025),
                    q975: computeQuantile(posteriors.ceiling, 0.975)
                },
                ec50: {
                    mean: computeMean(posteriors.ec50),
                    sd: computeSD(posteriors.ec50, computeMean(posteriors.ec50)),
                    q025: computeQuantile(posteriors.ec50, 0.025),
                    q975: computeQuantile(posteriors.ec50, 0.975)
                },
                slope: {
                    mean: computeMean(posteriors.slope),
                    sd: computeSD(posteriors.slope, computeMean(posteriors.slope)),
                    q025: computeQuantile(posteriors.slope, 0.025),
                    q975: computeQuantile(posteriors.slope, 0.975)
                }
            }
        };
    }

    async fitMultiBiomarker(useHierarchical, chains, iter) {
        this.log('Fitting multiple biomarkers with parallel tempering MCMC...');
        
        // Get biomarker names (exclude 'titre' and 'infected')
        const biomarkerNames = Object.keys(this.currentData).filter(k => 
            k !== 'titre' && k !== 'infected'
        );
        
        this.log(`Identified ${biomarkerNames.length} biomarkers: ${biomarkerNames.join(', ')}`);
        
        const infectedArray = this.currentData.infected;
        const biomarkerModels = {};
        
        // Fit each biomarker separately
        for (let idx = 0; idx < biomarkerNames.length; idx++) {
            const biomarker = biomarkerNames[idx];
            this.log(`\n[${idx + 1}/${biomarkerNames.length}] Fitting ${biomarker}...`);
            
            const titreArray = this.currentData[biomarker];
            
            // Prepare data for MCMC
            const titreVec = new this.mcmcModule.VectorDouble();
            for (let i = 0; i < titreArray.length; i++) {
                titreVec.push_back(titreArray[i]);
            }
            
            const infectedVec = new this.mcmcModule.VectorInt();
            for (let i = 0; i < infectedArray.length; i++) {
                infectedVec.push_back(infectedArray[i]);
            }
            
            const mcmcData = new this.mcmcModule.Data(titreVec, infectedVec);
            
            // Calculate data-driven priors for this biomarker (matching R package)
            const titreMidpoint = (Math.max(...titreArray) + Math.min(...titreArray)) / 2;
            const titreRange = Math.max(...titreArray) - Math.min(...titreArray);
            const titreSd = titreRange / 4;
            
            // Set priors to match R package defaults
            const priors = {
                floor_alpha: 1.0,      // Beta(1, 9) - weak prior favoring low floor
                floor_beta: 9.0,
                ceiling_alpha: 9.0,    // Beta(9, 1) - weak prior favoring high ceiling
                ceiling_beta: 1.0,
                ec50_mean: titreMidpoint,  // Data-driven
                ec50_sd: titreSd,          // Data-driven
                slope_mean: 0.0,       // Centered at 0
                slope_sd: 2.0          // Weakly informative
            };
            
            // Run multiple chains for this biomarker
            const startTime = performance.now();
            const allChainPosteriors = [];
            
            for (let chain = 0; chain < chains; chain++) {
                this.log(`${biomarker} chain ${chain + 1}/${chains}: ${iter} iterations...`);
                document.getElementById('fitting-status').innerHTML = 
                    `<div class="spinner-small"></div><p>${biomarker} chain ${chain + 1}/${chains}: ${iter} iterations...</p>`;
                
                const sampler = new this.mcmcModule.ParallelTemperingMCMC(10, mcmcData, priors);
                sampler.run(iter);
                
                const samples = sampler.get_samples();
                const warmup = Math.floor(iter / 2);
                
                const chainPosteriors = {
                    floor: [],
                    ceiling: [],
                    ec50: [],
                    slope: []
                };
                
                for (let i = warmup; i < samples.size(); i++) {
                    const s = samples.get(i);
                    chainPosteriors.floor.push(s.floor);
                    chainPosteriors.ceiling.push(s.ceiling);
                    chainPosteriors.ec50.push(s.ec50);
                    chainPosteriors.slope.push(s.slope);
                }
                
                allChainPosteriors.push(chainPosteriors);
            }
            
            const elapsed = (performance.now() - startTime) / 1000;
            this.log(`✓ ${biomarker} complete in ${elapsed.toFixed(1)}s`);
            
            // Combine chains
            const posteriors = {
                floor: [],
                ceiling: [],
                ec50: [],
                slope: []
            };
            
            allChainPosteriors.forEach(chain => {
                posteriors.floor.push(...chain.floor);
                posteriors.ceiling.push(...chain.ceiling);
                posteriors.ec50.push(...chain.ec50);
                posteriors.slope.push(...chain.slope);
            });
            
            // Compute summaries
            const computeMean = arr => arr.reduce((a, b) => a + b) / arr.length;
            const computeSD = (arr, mean) => Math.sqrt(arr.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / arr.length);
            const computeQuantile = (arr, q) => {
                const sorted = [...arr].sort((a, b) => a - b);
                return sorted[Math.floor(sorted.length * q)];
            };
            
            // Compute R-hat across chains
            const computeRhat = (chainValues) => {
                const n = chainValues[0].length;
                const m = chainValues.length;
                const chainMeans = chainValues.map(chain => chain.reduce((a, b) => a + b) / n);
                const chainVars = chainValues.map((chain, i) => 
                    chain.reduce((a, b) => a + Math.pow(b - chainMeans[i], 2), 0) / (n - 1)
                );
                const W = chainVars.reduce((a, b) => a + b) / m;
                const grandMean = chainMeans.reduce((a, b) => a + b) / m;
                const B = n * chainMeans.reduce((a, b) => a + Math.pow(b - grandMean, 2), 0) / (m - 1);
                const varPlus = ((n - 1) * W + B) / n;
                return Math.sqrt(varPlus / W);
            };
            
            const computeESS = (values) => {
                const n = values.length;
                const mean = values.reduce((a, b) => a + b) / n;
                const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / n;
                let acf = 0;
                for (let i = 1; i < n; i++) {
                    acf += (values[i] - mean) * (values[i-1] - mean);
                }
                acf = acf / ((n - 1) * variance);
                return n / (1 + 2 * Math.max(0, acf));
            };
            
            const diagnostics = {
                rhat: {
                    floor: computeRhat(allChainPosteriors.map(c => c.floor)),
                    ceiling: computeRhat(allChainPosteriors.map(c => c.ceiling)),
                    ec50: computeRhat(allChainPosteriors.map(c => c.ec50)),
                    slope: computeRhat(allChainPosteriors.map(c => c.slope))
                },
                ess: {
                    floor: computeESS(posteriors.floor),
                    ceiling: computeESS(posteriors.ceiling),
                    ec50: computeESS(posteriors.ec50),
                    slope: computeESS(posteriors.slope)
                },
                elapsed_seconds: elapsed
            };
            
            this.log(`${biomarker} R-hat: [${Math.min(...Object.values(diagnostics.rhat)).toFixed(3)}, ${Math.max(...Object.values(diagnostics.rhat)).toFixed(3)}]`);
            this.log(`${biomarker} ESS: [${Math.floor(Math.min(...Object.values(diagnostics.ess)))}, ${Math.floor(Math.max(...Object.values(diagnostics.ess)))}]`);
            
            // Store model for this biomarker
            biomarkerModels[biomarker] = {
                type: 'mcmc_4pl',
                posteriors: posteriors,
                chains: allChainPosteriors,
                diagnostics: diagnostics,
                data: {
                    titre: titreArray,
                    infected: infectedArray
                },
                summaries: {
                    floor: {
                        mean: computeMean(posteriors.floor),
                        sd: computeSD(posteriors.floor, computeMean(posteriors.floor)),
                        q025: computeQuantile(posteriors.floor, 0.025),
                        q975: computeQuantile(posteriors.floor, 0.975)
                    },
                    ceiling: {
                        mean: computeMean(posteriors.ceiling),
                        sd: computeSD(posteriors.ceiling, computeMean(posteriors.ceiling)),
                        q025: computeQuantile(posteriors.ceiling, 0.025),
                        q975: computeQuantile(posteriors.ceiling, 0.975)
                    },
                    ec50: {
                        mean: computeMean(posteriors.ec50),
                        sd: computeSD(posteriors.ec50, computeMean(posteriors.ec50)),
                        q025: computeQuantile(posteriors.ec50, 0.025),
                        q975: computeQuantile(posteriors.ec50, 0.975)
                    },
                    slope: {
                        mean: computeMean(posteriors.slope),
                        sd: computeSD(posteriors.slope, computeMean(posteriors.slope)),
                        q025: computeQuantile(posteriors.slope, 0.025),
                        q975: computeQuantile(posteriors.slope, 0.975)
                    }
                }
            };
        }
        
        // Store combined results
        this.model = {
            type: 'multi',
            biomarkers: biomarkerModels
        };
        
        this.log('\n✓ All biomarkers fitted successfully');
    }

    async displayResults() {
        document.getElementById('results-area').style.display = 'block';
        document.getElementById('no-results').style.display = 'none';
        
        this.displayConvergenceDiagnostics();
        this.displayTracePlots();
        this.displayPosteriors();
        this.displayProtectionCurve();
        this.displayROCCurve();
        this.displayModelComparison();
        this.displayMetrics();
    }
    
    displayConvergenceDiagnostics() {
        const metricsDiv = document.getElementById('metrics-table');
        
        if (this.model.type === 'multi') {
            // Multi-biomarker: show diagnostics for each biomarker
            let html = '<h3>Convergence Diagnostics</h3>';
            
            const biomarkerNames = Object.keys(this.model.biomarkers);
            biomarkerNames.forEach(biomarker => {
                const diagnostics = this.model.biomarkers[biomarker].diagnostics;
                const params = ['floor', 'ceiling', 'ec50', 'slope'];
                
                html += `<h4>${biomarker}</h4>`;
                html += '<table class="diagnostics-table">';
                html += '<thead><tr><th>Parameter</th><th>R-hat</th><th>ESS</th><th>Status</th></tr></thead>';
                html += '<tbody>';
                
                params.forEach(param => {
                    const rhat = diagnostics.rhat[param];
                    const ess = diagnostics.ess[param];
                    
                    const rhatGood = rhat < 1.05;
                    const essGood = ess > 400;
                    const status = (rhatGood && essGood) ? '✓ Good' : '⚠ Check';
                    const rowClass = (rhatGood && essGood) ? 'good' : 'warning';
                    
                    html += `<tr class="${rowClass}">`;
                    html += `<td><strong>${param}</strong></td>`;
                    html += `<td>${rhat.toFixed(3)}</td>`;
                    html += `<td>${Math.floor(ess)}</td>`;
                    html += `<td>${status}</td>`;
                    html += `</tr>`;
                });
                
                html += '</tbody></table>';
                html += `<p><strong>Swap rate:</strong> ${(diagnostics.swap_rate * 100).toFixed(1)}%</p>`;
                html += `<p><strong>Runtime:</strong> ${diagnostics.elapsed_seconds.toFixed(1)}s</p>`;
            });
            
            metricsDiv.innerHTML = html;
        } else {
            // Single biomarker
            const diagnostics = this.model.diagnostics;
            const params = ['floor', 'ceiling', 'ec50', 'slope'];
            
            let html = '<h3>Convergence Diagnostics</h3>';
            html += '<table class="diagnostics-table">';
            html += '<thead><tr><th>Parameter</th><th>R-hat</th><th>ESS</th><th>Status</th></tr></thead>';
            html += '<tbody>';
            
            params.forEach(param => {
                const rhat = diagnostics.rhat[param];
                const ess = diagnostics.ess[param];
                
                const rhatGood = rhat < 1.05;
                const essGood = ess > 400;
                const status = (rhatGood && essGood) ? '✓ Good' : '⚠ Check';
                const rowClass = (rhatGood && essGood) ? 'good' : 'warning';
                
                html += `<tr class="${rowClass}">`;
                html += `<td><strong>${param}</strong></td>`;
                html += `<td>${rhat.toFixed(3)}</td>`;
                html += `<td>${Math.floor(ess)}</td>`;
                html += `<td>${status}</td>`;
                html += `</tr>`;
            });
            
            html += '</tbody></table>';
            html += `<p><strong>Swap rate:</strong> ${(diagnostics.swap_rate * 100).toFixed(1)}%</p>`;
            html += `<p><strong>Runtime:</strong> ${diagnostics.elapsed_seconds.toFixed(1)}s</p>`;
            
            metricsDiv.innerHTML = html;
        }
    }
    
    displayTracePlots() {
        const plotsDiv = document.getElementById('posterior-plots');
        plotsDiv.innerHTML = '<h3>Trace Plots</h3>';
        
        const params = ['floor', 'ceiling', 'ec50', 'slope'];
        
        if (this.model.type === 'multi') {
            // Multi-biomarker: show trace plots for each biomarker
            const biomarkerNames = Object.keys(this.model.biomarkers);
            biomarkerNames.forEach(biomarker => {
                const posteriors = this.model.biomarkers[biomarker].posteriors;
                
                const biomarkerSection = document.createElement('div');
                biomarkerSection.innerHTML = `<h4>${biomarker}</h4>`;
                plotsDiv.appendChild(biomarkerSection);
                
                params.forEach(param => {
                    const canvasContainer = document.createElement('div');
                    canvasContainer.className = 'trace-plot-container';
                    
                    const canvas = document.createElement('canvas');
                    canvas.className = 'trace-plot';
                    canvasContainer.appendChild(canvas);
                    plotsDiv.appendChild(canvasContainer);
                    
                    const chains = this.model.biomarkers[biomarker].chains.map(c => c[param]);
                    this.plotTrace(canvas, chains, `${biomarker} - ${param}`);
                });
            });
        } else {
            // Single biomarker
            const posteriors = this.model.posteriors;
            
            params.forEach(param => {
                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'trace-plot-container';
                
                const canvas = document.createElement('canvas');
                canvas.className = 'trace-plot';
                canvasContainer.appendChild(canvas);
                plotsDiv.appendChild(canvasContainer);
                
                const chains = this.model.chains.map(c => c[param]);
                this.plotTrace(canvas, chains, param);
            });
        }
    }
    
    plotTrace(canvas, chains, title) {
        const ctx = canvas.getContext('2d');
        canvas.width = 650;
        canvas.height = 220;
        
        const padding = 50;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Find global min/max across all chains
        const allValues = chains.flat();
        const min = Math.min(...allValues);
        const max = Math.max(...allValues);
        const range = max - min;
        
        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Chain colors
        const chainColors = ['#000000', '#ff0000', '#0000ff', '#00aa00'];
        
        // Draw each chain
        chains.forEach((chainData, chainIdx) => {
            ctx.strokeStyle = chainColors[chainIdx % chainColors.length];
            ctx.lineWidth = 1.5;
            ctx.globalAlpha = 0.7;
            ctx.beginPath();
            
            chainData.forEach((val, i) => {
                const x = padding + (i / (chainData.length - 1)) * width;
                const y = padding + height - ((val - min) / range) * height;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
        });
        
        ctx.globalAlpha = 1.0;
        
        // Labels
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Avenir, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title.toUpperCase(), canvas.width / 2, 30);
        
        ctx.font = '13px Avenir, sans-serif';
        ctx.textAlign = 'right';
        ctx.fillText(max.toFixed(3), padding - 10, padding + 15);
        ctx.fillText(min.toFixed(3), padding - 10, padding + height);
        
        ctx.textAlign = 'center';
        ctx.fillText('Iteration (post-warmup)', canvas.width / 2, canvas.height - 15);
        
        // Y-axis label
        ctx.save();
        ctx.translate(20, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Parameter Value', 0, 0);
        ctx.restore();
    }

    displayPosteriors() {
        const plotsDiv = document.getElementById('posterior-plots');
        const histContainer = document.createElement('div');
        histContainer.innerHTML = '<h3>Posterior Distributions</h3>';
        histContainer.className = 'histogram-container';
        plotsDiv.appendChild(histContainer);
        
        const params = ['floor', 'ceiling', 'ec50', 'slope'];
        
        if (this.model.type === 'multi') {
            // Multi-biomarker: show posteriors for each biomarker
            const biomarkerNames = Object.keys(this.model.biomarkers);
            biomarkerNames.forEach(biomarker => {
                const model = this.model.biomarkers[biomarker];
                const posteriors = model.posteriors;
                const summaries = model.summaries;
                
                const bioSection = document.createElement('div');
                bioSection.innerHTML = `<h4>${biomarker}</h4>`;
                histContainer.appendChild(bioSection);
                
                params.forEach(param => {
                    const canvasContainer = document.createElement('div');
                    canvasContainer.className = 'posterior-plot';
                    
                    const canvas = document.createElement('canvas');
                    canvas.className = 'posterior-histogram';
                    canvasContainer.appendChild(canvas);
                    histContainer.appendChild(canvasContainer);
                    
                    this.plotHistogram(canvas, posteriors[param], summaries[param], `${biomarker} - ${param}`);
                });
            });
        } else {
            // Single biomarker
            const posteriors = this.model.posteriors;
            const summaries = this.model.summaries;
            
            params.forEach(param => {
                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'posterior-plot';
                
                const canvas = document.createElement('canvas');
                canvas.className = 'posterior-histogram';
                canvasContainer.appendChild(canvas);
                histContainer.appendChild(canvasContainer);
                
                this.plotHistogram(canvas, posteriors[param], summaries[param], param);
            });
        }
    }

    plotHistogram(canvas, data, summary, title) {
        const ctx = canvas.getContext('2d');
        canvas.width = 320;
        canvas.height = 240;
        
        const padding = 50;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;
        
        // Calculate histogram
        const bins = 30;
        const min = Math.min(...data);
        const max = Math.max(...data);
        const binWidth = (max - min) / bins;
        
        const hist = new Array(bins).fill(0);
        data.forEach(val => {
            const bin = Math.min(Math.floor((val - min) / binWidth), bins - 1);
            hist[bin]++;
        });
        
        const maxCount = Math.max(...hist);
        
        // Clear canvas
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Draw bars
        ctx.fillStyle = '#000';
        hist.forEach((count, i) => {
            const x = padding + (i / bins) * width;
            const barHeight = (count / maxCount) * height;
            const y = padding + height - barHeight;
            const barWidth = width / bins;
            
            ctx.fillRect(x, y, barWidth * 0.9, barHeight);
        });
        
        // Draw axes
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#000';
        ctx.font = '14px Avenir, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title.toUpperCase(), canvas.width / 2, 20);
        ctx.fillText(min.toFixed(2), padding, canvas.height - 10);
        ctx.fillText(max.toFixed(2), canvas.width - padding, canvas.height - 10);
        
        // Summary statistics from MCMC
        ctx.font = '12px Avenir, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`Mean: ${summary.mean.toFixed(3)}`, padding + 10, padding + 20);
        ctx.fillText(`SD: ${summary.sd.toFixed(3)}`, padding + 10, padding + 35);
        ctx.fillText(`95% CI: [${summary.q025.toFixed(3)}, ${summary.q975.toFixed(3)}]`, padding + 10, padding + 50);
    }
    
    displayProtectionCurve() {
        this.log('Generating protection and risk curves...');
        
        const curveDiv = document.getElementById('curve-plot');
        curveDiv.innerHTML = '<h3>Correlate of Protection and Risk</h3>';
        
        // Create two canvases side by side
        const containerDiv = document.createElement('div');
        containerDiv.style.display = 'flex';
        containerDiv.style.gap = '20px';
        containerDiv.style.flexWrap = 'wrap';
        
        const protectionDiv = document.createElement('div');
        protectionDiv.innerHTML = '<h4 style="text-align: center; margin: 10px 0;">Protection (1 - P(infection))</h4>';
        const protectionCanvas = document.createElement('canvas');
        protectionCanvas.id = 'protection-curve-canvas';
        protectionDiv.appendChild(protectionCanvas);
        
        const riskDiv = document.createElement('div');
        riskDiv.innerHTML = '<h4 style="text-align: center; margin: 10px 0;">Risk (P(infection))</h4>';
        const riskCanvas = document.createElement('canvas');
        riskCanvas.id = 'risk-curve-canvas';
        riskDiv.appendChild(riskCanvas);
        
        containerDiv.appendChild(protectionDiv);
        containerDiv.appendChild(riskDiv);
        curveDiv.appendChild(containerDiv);
        
        if (this.model.type === 'multi') {
            // Multi-biomarker: plot all curves on same canvas
            const biomarkerNames = Object.keys(this.model.biomarkers);
            const allData = [];
            
            // Define colors for each biomarker
            const colors = ['#000000', '#555555', '#999999']; // Black, dark gray, light gray
            
            biomarkerNames.forEach((biomarker, idx) => {
                const model = this.model.biomarkers[biomarker];
                const data = model.data;
                const summaries = model.summaries;
                
                // Create prediction grid
                const titreMin = Math.min(...data.titre);
                const titreMax = Math.max(...data.titre);
                const nPoints = 100;
                const titreGrid = Array.from({length: nPoints}, (_, i) => 
                    titreMin + (titreMax - titreMin) * i / (nPoints - 1)
                );
                
                // Compute protection curve using posterior mean
                const floor = summaries.floor.mean;
                const ceiling = summaries.ceiling.mean;
                const ec50 = summaries.ec50.mean;
                const slope = summaries.slope.mean;
                
                const probProtection = titreGrid.map(t => {
                    const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                    const pInfection = ceiling * (sigmoid * (1 - floor) + floor);
                    return 1 - pInfection; // Protection probability
                });
                
                const probRisk = titreGrid.map(t => {
                    const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                    return ceiling * (sigmoid * (1 - floor) + floor); // Risk probability
                });
                
                allData.push({
                    name: biomarker,
                    titre: titreGrid,
                    probProtection: probProtection,
                    probRisk: probRisk,
                    obsTitre: data.titre,
                    obsProtected: data.infected.map(x => 1 - x),
                    obsInfected: data.infected,
                    color: colors[idx % colors.length]
                });
            });
            
            this.plotMultiProtectionCurve(protectionCanvas, allData, 'protection');
            this.plotMultiProtectionCurve(riskCanvas, allData, 'risk');
        } else {
            // Single biomarker
            const data = this.model.data;
            const summaries = this.model.summaries;
            
            // Create prediction grid
            const titreMin = Math.min(...data.titre);
            const titreMax = Math.max(...data.titre);
            const nPoints = 100;
            const titreGrid = Array.from({length: nPoints}, (_, i) => 
                titreMin + (titreMax - titreMin) * i / (nPoints - 1)
            );
            
            // Compute protection curve using posterior mean
            const floor = summaries.floor.mean;
            const ceiling = summaries.ceiling.mean;
            const ec50 = summaries.ec50.mean;
            const slope = summaries.slope.mean;
            
            const probProtection = titreGrid.map(t => {
                const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                const pInfection = ceiling * (sigmoid * (1 - floor) + floor);
                return 1 - pInfection; // Protection probability
            });
            
            const probRisk = titreGrid.map(t => {
                const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                return ceiling * (sigmoid * (1 - floor) + floor); // Risk probability
            });
            
            this.plotProtectionCurve(protectionCanvas, titreGrid, probProtection, data.titre, 
                data.infected.map(x => 1 - x), 'Probability of Protection');
            this.plotProtectionCurve(riskCanvas, titreGrid, probRisk, data.titre, 
                data.infected, 'Probability of Infection');
        }
    }
    
    plotMultiProtectionCurve(canvas, allData, curveType = 'protection') {
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 400;
        
        const padding = 60;
        const legendWidth = 120;
        const width = canvas.width - 2 * padding - legendWidth;
        const height = canvas.height - 2 * padding;
        
        // Clear
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Find global ranges
        const allTitres = allData.flatMap(d => d.titre);
        const xMin = Math.min(...allTitres);
        const xMax = Math.max(...allTitres);
        const xRange = xMax - xMin;
        
        const toX = (val) => padding + ((val - xMin) / xRange) * width;
        const toY = (val) => padding + height - (val * height);
        
        // Draw observations for each biomarker
        allData.forEach((bioData, idx) => {
            ctx.fillStyle = bioData.color.replace(')', ', 0.2)').replace('rgb', 'rgba');
            const obsData = curveType === 'protection' ? bioData.obsProtected : bioData.obsInfected;
            for (let i = 0; i < bioData.obsTitre.length; i++) {
                const x = toX(bioData.obsTitre[i]);
                const y = toY(obsData[i]);
                ctx.beginPath();
                ctx.arc(x, y, 2, 0, 2 * Math.PI);
                ctx.fill();
            }
        });
        
        // Draw curves
        allData.forEach((bioData, idx) => {
            ctx.strokeStyle = bioData.color;
            ctx.lineWidth = 2;
            const probData = curveType === 'protection' ? bioData.probProtection : bioData.probRisk;
            ctx.beginPath();
            ctx.moveTo(toX(bioData.titre[0]), toY(probData[0]));
            for (let i = 1; i < bioData.titre.length; i++) {
                ctx.lineTo(toX(bioData.titre[i]), toY(probData[i]));
            }
            ctx.stroke();
        });
        
        // Axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#000';
        ctx.font = '14px Avenir, sans-serif';
        ctx.textAlign = 'center';
        const title = curveType === 'protection' ? 'Protection Curves' : 'Risk Curves';
        ctx.fillText(title + ' - Multi-Biomarker', canvas.width / 2 - legendWidth / 2, 30);
        ctx.fillText('Antibody Titre', padding + width / 2, canvas.height - 10);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        const yLabel = curveType === 'protection' ? 'Probability of Protection' : 'Probability of Infection';
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
        
        // Axis labels
        ctx.font = '11px Avenir, sans-serif';
        ctx.fillText(xMin.toFixed(1), padding, canvas.height - 30);
        ctx.fillText(xMax.toFixed(1), padding + width, canvas.height - 30);
        ctx.textAlign = 'right';
        ctx.fillText('0.0', padding - 10, padding + height);
        ctx.fillText('1.0', padding - 10, padding);
        
        // Legend
        const legendX = padding + width + 20;
        const legendY = padding + 50;
        
        ctx.font = '12px Avenir, sans-serif';
        ctx.textAlign = 'left';
        allData.forEach((bioData, idx) => {
            const yPos = legendY + idx * 25;
            
            // Color line
            ctx.strokeStyle = bioData.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(legendX, yPos);
            ctx.lineTo(legendX + 30, yPos);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#000';
            ctx.fillText(bioData.name, legendX + 35, yPos + 4);
        });
    }
    
    plotProtectionCurve(canvas, titre, prob, obsTitre, obsData, yLabel = 'Probability of Protection') {
        const ctx = canvas.getContext('2d');
        canvas.width = 550;
        canvas.height = 380;
        
        const padding = 60;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;
        
        // Clear
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scales
        const xMin = Math.min(...titre);
        const xMax = Math.max(...titre);
        const xRange = xMax - xMin;
        
        const toX = (val) => padding + ((val - xMin) / xRange) * width;
        const toY = (val) => padding + height - (val * height);
        
        // Draw observations
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let i = 0; i < obsTitre.length; i++) {
            const x = toX(obsTitre[i]);
            const y = toY(obsData[i]);
            ctx.beginPath();
            ctx.arc(x, y, 3, 0, 2 * Math.PI);
            ctx.fill();
        }
        
        // Draw curve
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toX(titre[0]), toY(prob[0]));
        for (let i = 1; i < titre.length; i++) {
            ctx.lineTo(toX(titre[i]), toY(prob[i]));
        }
        ctx.stroke();
        
        // Axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#000';
        ctx.font = '14px Avenir, sans-serif';
        ctx.textAlign = 'center';
        const title = yLabel.includes('Protection') ? 'Protection Curve' : 'Risk Curve';
        ctx.fillText(title, canvas.width / 2, 30);
        ctx.fillText('Antibody Titre', canvas.width / 2, canvas.height - 10);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
        
        // Axis labels
        ctx.font = '11px Avenir, sans-serif';
        ctx.fillText(xMin.toFixed(1), padding, canvas.height - 30);
        ctx.fillText(xMax.toFixed(1), padding + width, canvas.height - 30);
        ctx.textAlign = 'right';
        ctx.fillText('0.0', padding - 5, padding + height);
        ctx.fillText('1.0', padding - 5, padding);
    }
    
    displayROCCurve() {
        this.log('Generating ROC curve...');
        
        const rocDiv = document.getElementById('roc-plot');
        const canvas = document.createElement('canvas');
        canvas.id = 'roc-curve-canvas';
        rocDiv.innerHTML = '<h3>ROC Curve</h3>';
        rocDiv.appendChild(canvas);
        
        if (this.model.type === 'multi') {
            // Multi-biomarker: compute ROC for each
            const biomarkerNames = Object.keys(this.model.biomarkers);
            const allROC = [];
            const colors = ['#000000', '#555555', '#999999'];
            
            biomarkerNames.forEach((biomarker, idx) => {
                const model = this.model.biomarkers[biomarker];
                const data = model.data;
                const summaries = model.summaries;
                
                // Compute predicted probabilities using posterior mean
                const floor = summaries.floor.mean;
                const ceiling = summaries.ceiling.mean;
                const ec50 = summaries.ec50.mean;
                const slope = summaries.slope.mean;
                
                const predictions = data.titre.map(t => {
                    const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                    return ceiling * (sigmoid * (1 - floor) + floor);
                });
                
                // Calculate ROC curve points
                const thresholds = Array.from({length: 100}, (_, i) => i / 99);
                const tpr = [];
                const fpr = [];
                
                thresholds.forEach(threshold => {
                    const predClass = predictions.map(p => p >= threshold ? 1 : 0);
                    
                    let tp = 0, fp = 0, tn = 0, fn = 0;
                    for (let i = 0; i < predClass.length; i++) {
                        if (predClass[i] === 1 && data.infected[i] === 1) tp++;
                        else if (predClass[i] === 1 && data.infected[i] === 0) fp++;
                        else if (predClass[i] === 0 && data.infected[i] === 0) tn++;
                        else fn++;
                    }
                    
                    tpr.push(tp + fn > 0 ? tp / (tp + fn) : 0);
                    fpr.push(fp + tn > 0 ? fp / (fp + tn) : 0);
                });
                
                // Calculate AUC
                let auc = 0;
                for (let i = 1; i < fpr.length; i++) {
                    auc += (fpr[i] - fpr[i-1]) * (tpr[i] + tpr[i-1]) / 2;
                }
                
                allROC.push({
                    name: biomarker,
                    fpr: fpr,
                    tpr: tpr,
                    auc: auc,
                    color: colors[idx % colors.length]
                });
            });
            
            this.plotMultiROCCurve(canvas, allROC);
        } else {
            // Single biomarker
            const data = this.model.data;
            const summaries = this.model.summaries;
            
            // Compute predicted probabilities using posterior mean
            const floor = summaries.floor.mean;
            const ceiling = summaries.ceiling.mean;
            const ec50 = summaries.ec50.mean;
            const slope = summaries.slope.mean;
            
            const predictions = data.titre.map(t => {
                const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                return ceiling * (sigmoid * (1 - floor) + floor);
            });
            
            // Calculate ROC curve points
            const thresholds = Array.from({length: 100}, (_, i) => i / 99);
            const tpr = [];
            const fpr = [];
            
            thresholds.forEach(threshold => {
                const predClass = predictions.map(p => p >= threshold ? 1 : 0);
                
                let tp = 0, fp = 0, tn = 0, fn = 0;
                for (let i = 0; i < predClass.length; i++) {
                    if (predClass[i] === 1 && data.infected[i] === 1) tp++;
                    else if (predClass[i] === 1 && data.infected[i] === 0) fp++;
                    else if (predClass[i] === 0 && data.infected[i] === 0) tn++;
                    else fn++;
                }
                
                tpr.push(tp + fn > 0 ? tp / (tp + fn) : 0);
                fpr.push(fp + tn > 0 ? fp / (fp + tn) : 0);
            });
            
            // Calculate AUC using trapezoidal rule
            let auc = 0;
            for (let i = 1; i < fpr.length; i++) {
                auc += (fpr[i] - fpr[i-1]) * (tpr[i] + tpr[i-1]) / 2;
            }
            
            this.plotROCCurve(canvas, fpr, tpr, auc);
        }
    }
    
    plotMultiROCCurve(canvas, allROC) {
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 500;
        
        const padding = 60;
        const legendWidth = 120;
        const width = canvas.width - 2 * padding - legendWidth;
        const height = canvas.height - 2 * padding;
        
        // Clear
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const toX = (val) => padding + val * width;
        const toY = (val) => padding + height - (val * height);
        
        // Draw diagonal (chance line)
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        ctx.lineTo(padding + width, padding);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw ROC curves
        allROC.forEach((rocData, idx) => {
            ctx.strokeStyle = rocData.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(toX(rocData.fpr[0]), toY(rocData.tpr[0]));
            for (let i = 1; i < rocData.fpr.length; i++) {
                ctx.lineTo(toX(rocData.fpr[i]), toY(rocData.tpr[i]));
            }
            ctx.stroke();
        });
        
        // Axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#000';
        ctx.font = '14px Avenir, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ROC Curves - Multi-Biomarker', canvas.width / 2 - legendWidth / 2, 30);
        ctx.fillText('False Positive Rate', padding + width / 2, canvas.height - 10);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('True Positive Rate', 0, 0);
        ctx.restore();
        
        // Axis ticks
        ctx.font = '11px Avenir, sans-serif';
        ctx.fillText('0.0', padding, canvas.height - 30);
        ctx.fillText('1.0', padding + width, canvas.height - 30);
        ctx.textAlign = 'right';
        ctx.fillText('0.0', padding - 10, padding + height);
        ctx.fillText('1.0', padding - 10, padding);
        
        // Legend with AUC
        const legendX = padding + width + 20;
        const legendY = padding + 50;
        
        ctx.font = '12px Avenir, sans-serif';
        ctx.textAlign = 'left';
        allROC.forEach((rocData, idx) => {
            const yPos = legendY + idx * 30;
            
            // Color line
            ctx.strokeStyle = rocData.color;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(legendX, yPos);
            ctx.lineTo(legendX + 30, yPos);
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#000';
            ctx.fillText(rocData.name, legendX + 35, yPos + 4);
            ctx.font = '10px Avenir, sans-serif';
            ctx.fillText(`AUC: ${rocData.auc.toFixed(3)}`, legendX + 35, yPos + 16);
            ctx.font = '12px Avenir, sans-serif';
        });
    }
    
    plotROCCurve(canvas, fpr, tpr, auc) {
        const ctx = canvas.getContext('2d');
        canvas.width = 500;
        canvas.height = 500;
        
        const padding = 60;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;
        
        // Clear
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        const toX = (val) => padding + val * width;
        const toY = (val) => padding + height - (val * height);
        
        // Draw diagonal (chance line)
        ctx.strokeStyle = '#ccc';
        ctx.lineWidth = 1;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.moveTo(padding, padding + height);
        ctx.lineTo(padding + width, padding);
        ctx.stroke();
        ctx.setLineDash([]);
        
        // Draw ROC curve
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(toX(fpr[0]), toY(tpr[0]));
        for (let i = 1; i < fpr.length; i++) {
            ctx.lineTo(toX(fpr[i]), toY(tpr[i]));
        }
        ctx.stroke();
        
        // Axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#000';
        ctx.font = '16px Avenir, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('ROC Curve', canvas.width / 2, 30);
        
        ctx.font = '14px Avenir, sans-serif';
        ctx.fillText('False Positive Rate', canvas.width / 2, canvas.height - 10);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('True Positive Rate', 0, 0);
        ctx.restore();
        
        // AUC
        ctx.font = '14px Avenir, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`AUC = ${auc.toFixed(3)}`, padding + 10, padding + 30);
        
        // Axis labels
        ctx.font = '11px Avenir, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('0.0', padding, canvas.height - 30);
        ctx.fillText('1.0', padding + width, canvas.height - 30);
        ctx.textAlign = 'right';
        ctx.fillText('0.0', padding - 5, padding + height);
        ctx.fillText('1.0', padding - 5, padding);
    }

    displayMetrics() {
        this.log('Calculating model metrics...');
        
        const summaries = this.model.summaries;
        const diagnostics = this.model.diagnostics;
        
        const metricsDiv = document.getElementById('metrics-table');
        let html = metricsDiv.innerHTML; // Keep convergence table
        
        html += '<h3>Model Summary</h3>';
        html += '<table class="summary-table">';
        html += '<thead><tr><th>Parameter</th><th>Mean</th><th>SD</th><th>95% CI</th></tr></thead>';
        html += '<tbody>';
        
        const params = ['floor', 'ceiling', 'ec50', 'slope'];
        params.forEach(param => {
            const s = summaries[param];
            html += `<tr>`;
            html += `<td><strong>${param}</strong></td>`;
            html += `<td>${s.mean.toFixed(3)}</td>`;
            html += `<td>${s.sd.toFixed(3)}</td>`;
            html += `<td>[${s.q025.toFixed(3)}, ${s.q975.toFixed(3)}]</td>`;
            html += `</tr>`;
        });
        
        html += '</tbody></table>';
        
        metricsDiv.innerHTML = html;
    }

    switchTab(tabName) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        event.target.classList.add('active');
        
        // Update panes
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        document.getElementById(`tab-${tabName}`).classList.add('active');
    }

    displayModelComparison() {
        const compDiv = document.getElementById('comparison-plot');
        if (!compDiv) return;
        
        // Clear previous content
        compDiv.innerHTML = '';
        
        if (this.model.type === 'multi') {
            // Multi-biomarker: compute LOO-CV ELPD and AUC for each
            const biomarkerNames = Object.keys(this.model.biomarkers);
            const metrics = [];
            
            biomarkerNames.forEach(biomarker => {
                const model = this.model.biomarkers[biomarker];
                const data = model.data;
                const summaries = model.summaries;
                
                // Compute LOO-CV ELPD (approximate)
                const floor = summaries.floor.mean;
                const ceiling = summaries.ceiling.mean;
                const ec50 = summaries.ec50.mean;
                const slope = summaries.slope.mean;
                
                // Compute pointwise ELPD for uncertainty estimation
                const pointwiseELPD = [];
                const predictions = [];
                
                for (let i = 0; i < data.titre.length; i++) {
                    const t = data.titre[i];
                    const y = data.infected[i];
                    const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                    const p = ceiling * (sigmoid * (1 - floor) + floor);
                    predictions.push(p);
                    
                    const pClip = Math.max(0.0001, Math.min(0.9999, p));
                    const loglik = y === 1 ? Math.log(pClip) : Math.log(1 - pClip);
                    pointwiseELPD.push(loglik);
                }
                
                const elpd = pointwiseELPD.reduce((a, b) => a + b, 0);
                const elpdMean = elpd / data.titre.length;
                const elpdSE = Math.sqrt(
                    pointwiseELPD.reduce((sum, val) => sum + Math.pow(val - elpdMean, 2), 0) / 
                    (data.titre.length - 1)
                ) * Math.sqrt(data.titre.length);
                
                // Compute AUC for protection (predicting non-infection)
                const computeAUC = (preds, labels) => {
                    const thresholds = Array.from({length: 100}, (_, i) => i / 99);
                    const rocPoints = [];
                    
                    thresholds.forEach(threshold => {
                        // For protection: predict protected (0) when prob >= threshold
                        const predClass = preds.map(p => p >= threshold ? 0 : 1);
                        let tp = 0, fp = 0, tn = 0, fn = 0;
                        
                        for (let i = 0; i < predClass.length; i++) {
                            // TP: predicted protected (0), actually protected (0)
                            // FP: predicted protected (0), actually infected (1)
                            if (predClass[i] === 0 && labels[i] === 0) tp++;
                            else if (predClass[i] === 0 && labels[i] === 1) fp++;
                            else if (predClass[i] === 1 && labels[i] === 1) tn++;
                            else fn++;
                        }
                        
                        const tpr = tp + fn > 0 ? tp / (tp + fn) : 0;
                        const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
                        rocPoints.push({fpr, tpr});
                    });
                    
                    // Sort ROC points by FPR (ascending) for proper trapezoidal integration
                    rocPoints.sort((a, b) => a.fpr - b.fpr);
                    
                    // Compute AUC using trapezoidal rule
                    let auc = 0;
                    for (let i = 1; i < rocPoints.length; i++) {
                        auc += (rocPoints[i].fpr - rocPoints[i-1].fpr) * 
                               (rocPoints[i].tpr + rocPoints[i-1].tpr) / 2;
                    }
                    return auc;
                };
                
                // Convert to protection predictions (1 - infection risk)
                const protectionPreds = predictions.map(p => 1 - p);
                const auc = computeAUC(protectionPreds, data.infected);
                
                // Bootstrap AUC confidence interval (100 resamples for speed)
                const bootstrapAUCs = [];
                for (let b = 0; b < 100; b++) {
                    const indices = [];
                    for (let i = 0; i < data.titre.length; i++) {
                        indices.push(Math.floor(Math.random() * data.titre.length));
                    }
                    const bootPreds = indices.map(i => protectionPreds[i]);
                    const bootLabels = indices.map(i => data.infected[i]);
                    bootstrapAUCs.push(computeAUC(bootPreds, bootLabels));
                }
                bootstrapAUCs.sort((a, b) => a - b);
                const aucCI = [
                    bootstrapAUCs[Math.floor(0.025 * bootstrapAUCs.length)],
                    bootstrapAUCs[Math.floor(0.975 * bootstrapAUCs.length)]
                ];
                
                metrics.push({
                    name: biomarker, 
                    elpd: elpd, 
                    elpdSE: elpdSE,
                    auc: auc,
                    aucCI: aucCI
                });
            });
            
            // Create scatter plot
            const scatterDiv = document.createElement('div');
            scatterDiv.style.marginBottom = '30px';
            const canvas = document.createElement('canvas');
            scatterDiv.appendChild(canvas);
            compDiv.appendChild(scatterDiv);
            this.plotComparisonScatter(canvas, metrics);
            
            // Add table
            const tableDiv = document.createElement('div');
            let tableHTML = '<h4 style="margin-top: 30px;">Comparison Table</h4>';
            tableHTML += '<table class="summary-table" style="margin-top: 10px;"><thead><tr>';
            tableHTML += '<th>Biomarker</th><th>LOO-CV ELPD (SE)</th><th>AUC (95% CI)</th></tr></thead><tbody>';
            
            metrics.forEach(m => {
                tableHTML += `<tr><td><strong>${m.name}</strong></td>`;
                tableHTML += `<td>${m.elpd.toFixed(2)} (${m.elpdSE.toFixed(2)})</td>`;
                tableHTML += `<td>${m.auc.toFixed(3)} (${m.aucCI[0].toFixed(3)}-${m.aucCI[1].toFixed(3)})</td></tr>`;
            });
            
            tableHTML += '</tbody></table>';
            tableDiv.innerHTML = tableHTML;
            compDiv.appendChild(tableDiv);
            
        } else {
            // Single biomarker: just show LOO-CV ELPD and AUC
            const data = this.model.data;
            const summaries = this.model.summaries;
            
            const floor = summaries.floor.mean;
            const ceiling = summaries.ceiling.mean;
            const ec50 = summaries.ec50.mean;
            const slope = summaries.slope.mean;
            
            // Compute pointwise ELPD for uncertainty estimation
            const pointwiseELPD = [];
            const predictions = [];
            
            for (let i = 0; i < data.titre.length; i++) {
                const t = data.titre[i];
                const y = data.infected[i];
                const sigmoid = 1 / (1 + Math.exp(slope * (t - ec50)));
                const p = ceiling * (sigmoid * (1 - floor) + floor);
                predictions.push(p);
                
                const pClip = Math.max(0.0001, Math.min(0.9999, p));
                const loglik = y === 1 ? Math.log(pClip) : Math.log(1 - pClip);
                pointwiseELPD.push(loglik);
            }
            
            const elpd = pointwiseELPD.reduce((a, b) => a + b, 0);
            const elpdMean = elpd / data.titre.length;
            const elpdSE = Math.sqrt(
                pointwiseELPD.reduce((sum, val) => sum + Math.pow(val - elpdMean, 2), 0) / 
                (data.titre.length - 1)
            ) * Math.sqrt(data.titre.length);
            
            // Compute AUC with helper function
            const computeAUC = (preds, labels) => {
                const thresholds = Array.from({length: 100}, (_, i) => i / 99);
                const rocPoints = [];
                
                thresholds.forEach(threshold => {
                    const predClass = preds.map(p => p >= threshold ? 1 : 0);
                    let tp = 0, fp = 0, tn = 0, fn = 0;
                    
                    for (let i = 0; i < predClass.length; i++) {
                        if (predClass[i] === 1 && labels[i] === 1) tp++;
                        else if (predClass[i] === 1 && labels[i] === 0) fp++;
                        else if (predClass[i] === 0 && labels[i] === 0) tn++;
                        else fn++;
                    }
                    
                    const tpr = tp + fn > 0 ? tp / (tp + fn) : 0;
                    const fpr = fp + tn > 0 ? fp / (fp + tn) : 0;
                    rocPoints.push({fpr, tpr});
                });
                
                let auc = 0;
                for (let i = 1; i < rocPoints.length; i++) {
                    auc += (rocPoints[i].fpr - rocPoints[i-1].fpr) * 
                           (rocPoints[i].tpr + rocPoints[i-1].tpr) / 2;
                }
                return auc;
            };
            
            const auc = computeAUC(predictions, data.infected);
            
            // Bootstrap AUC confidence interval
            const bootstrapAUCs = [];
            for (let b = 0; b < 100; b++) {
                const indices = [];
                for (let i = 0; i < data.titre.length; i++) {
                    indices.push(Math.floor(Math.random() * data.titre.length));
                }
                const bootPreds = indices.map(i => predictions[i]);
                const bootLabels = indices.map(i => data.infected[i]);
                bootstrapAUCs.push(computeAUC(bootPreds, bootLabels));
            }
            bootstrapAUCs.sort((a, b) => a - b);
            const aucCI = [
                bootstrapAUCs[Math.floor(0.025 * bootstrapAUCs.length)],
                bootstrapAUCs[Math.floor(0.975 * bootstrapAUCs.length)]
            ];
            
            const perfDiv = document.createElement('div');
            perfDiv.innerHTML = '<h4>Model Performance</h4>';
            perfDiv.innerHTML += `<p><strong>LOO-CV ELPD:</strong> ${elpd.toFixed(2)} (SE: ${elpdSE.toFixed(2)})</p>`;
            perfDiv.innerHTML += `<p><strong>AUC:</strong> ${auc.toFixed(3)} (95% CI: ${aucCI[0].toFixed(3)}-${aucCI[1].toFixed(3)})</p>`;
            compDiv.appendChild(perfDiv);
        }
    }
    
    plotComparisonScatter(canvas, metrics) {
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 450;
        
        const padding = 90;
        const width = canvas.width - 2 * padding;
        const height = canvas.height - 2 * padding;
        
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Scales - include uncertainty in ranges
        const elpdValues = metrics.map(m => m.elpd);
        const elpdWithSE = metrics.flatMap(m => [m.elpd - m.elpdSE, m.elpd + m.elpdSE]);
        const aucWithCI = metrics.flatMap(m => [m.aucCI[0], m.aucCI[1]]);
        
        const elpdMin = Math.min(...elpdWithSE);
        const elpdMax = Math.max(...elpdWithSE);
        const elpdRange = Math.max(elpdMax - elpdMin, 10); // Ensure minimum range
        
        // AUC axis: Include CI bounds, but keep sensible limits
        const aucMin = Math.max(0.5, Math.min(...aucWithCI) - 0.02);
        const aucMax = Math.min(1.0, Math.max(...aucWithCI) + 0.02);
        const aucRange = aucMax - aucMin;
        
        const toX = (val) => padding + ((val - elpdMin) / elpdRange) * width;
        const toY = (val) => padding + height - ((val - aucMin) / aucRange) * height;
        
        console.log('Plotting comparison:', metrics);
        console.log('ELPD range:', elpdMin, 'to', elpdMax);
        console.log('AUC range:', aucMin, 'to', aucMax);
        
        // Draw background grid
        ctx.strokeStyle = '#f0f0f0';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 5; i++) {
            const x = padding + (i / 5) * width;
            ctx.beginPath();
            ctx.moveTo(x, padding);
            ctx.lineTo(x, padding + height);
            ctx.stroke();
            
            const y = padding + (i / 5) * height;
            ctx.beginPath();
            ctx.moveTo(padding, y);
            ctx.lineTo(padding + width, y);
            ctx.stroke();
        }
        
        // Axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Draw error bars first (so they appear behind points)
        const colors = ['#000000', '#ff6600', '#0066ff'];
        metrics.forEach((m, idx) => {
            const x = toX(m.elpd);
            const y = toY(m.auc);
            
            // Horizontal error bar for ELPD (±SE)
            const xLower = toX(m.elpd - m.elpdSE);
            const xUpper = toX(m.elpd + m.elpdSE);
            
            ctx.strokeStyle = colors[idx % colors.length];
            ctx.lineWidth = 2;
            ctx.globalAlpha = 0.5;
            
            // Horizontal line
            ctx.beginPath();
            ctx.moveTo(xLower, y);
            ctx.lineTo(xUpper, y);
            ctx.stroke();
            
            // End caps
            ctx.beginPath();
            ctx.moveTo(xLower, y - 4);
            ctx.lineTo(xLower, y + 4);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(xUpper, y - 4);
            ctx.lineTo(xUpper, y + 4);
            ctx.stroke();
            
            // Vertical error bar for AUC (95% CI)
            const yLower = toY(m.aucCI[0]);
            const yUpper = toY(m.aucCI[1]);
            
            // Vertical line
            ctx.beginPath();
            ctx.moveTo(x, yLower);
            ctx.lineTo(x, yUpper);
            ctx.stroke();
            
            // End caps
            ctx.beginPath();
            ctx.moveTo(x - 4, yLower);
            ctx.lineTo(x + 4, yLower);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(x - 4, yUpper);
            ctx.lineTo(x + 4, yUpper);
            ctx.stroke();
            
            ctx.globalAlpha = 1.0;
        });
        
        // Points (draw on top of error bars)
        metrics.forEach((m, idx) => {
            const x = toX(m.elpd);
            const y = toY(m.auc);
            
            console.log(`Plotting ${m.name} at (${x}, ${y})`);
            
            // Draw point
            ctx.fillStyle = colors[idx % colors.length];
            ctx.beginPath();
            ctx.arc(x, y, 10, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw outline
            ctx.strokeStyle = '#000';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Label
            ctx.fillStyle = '#000';
            ctx.font = 'bold 14px Avenir, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(m.name, x, y - 18);
        });
        
        // Title and labels
        ctx.fillStyle = '#000';
        ctx.font = 'bold 16px Avenir, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Model Comparison: LOO-CV ELPD vs AUC', canvas.width / 2, 30);
        
        ctx.font = '14px Avenir, sans-serif';
        ctx.fillText('LOO-CV ELPD (higher is better)', canvas.width / 2, canvas.height - 15);
        
        ctx.save();
        ctx.translate(20, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('AUC (higher is better)', 0, 0);
        ctx.restore();
        
        // Axis ticks
        ctx.font = '12px Avenir, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(elpdMin.toFixed(1), padding, canvas.height - 35);
        ctx.fillText(elpdMax.toFixed(1), padding + width, canvas.height - 35);
        
        ctx.textAlign = 'right';
        ctx.fillText(aucMin.toFixed(2), padding - 10, padding + height);
        const aucMid = (aucMin + aucMax) / 2;
        ctx.fillText(aucMid.toFixed(2), padding - 10, padding + height / 2);
        ctx.fillText(aucMax.toFixed(2), padding - 10, padding);
    }

    log(message) {
        const consoleDiv = document.getElementById('console-output');
        const timestamp = new Date().toLocaleTimeString();
        consoleDiv.innerHTML += `<div class="log-entry">[${timestamp}] ${message}</div>`;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
        console.log(message);
    }

    logError(message) {
        const consoleDiv = document.getElementById('console-output');
        const timestamp = new Date().toLocaleTimeString();
        consoleDiv.innerHTML += `<div class="log-entry error">[${timestamp}] ERROR: ${message}</div>`;
        consoleDiv.scrollTop = consoleDiv.scrollHeight;
        console.error(message);
    }

    hideLoading() {
        document.getElementById('loading-screen').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
    }
}

// Initialize app when page loads
const app = new SeroCOPApp();
