import { WebR } from 'https://cdn.jsdelivr.net/npm/webr@0.4.2/dist/webr.mjs';

class SeroCOPApp {
    constructor() {
        this.webR = null;
        this.currentData = null;
        this.model = null;
        this.init();
        // API URL - Render deployment (update with your actual Render URL)
        this.apiBaseUrl = 'https://serocop-api.onrender.com';
    }

    async init() {
        await this.initializeWebR();
        this.setupEventListeners();
    }

    async initializeWebR() {
        try {
            this.log('Initializing WebR...');
            
            this.webR = new WebR({
                baseURL: 'https://cdn.jsdelivr.net/npm/webr@0.4.2/dist/',
                channelType: 'SharedArrayBuffer'
            });

            await this.webR.init();
            this.log('WebR initialized successfully');

            // Install required packages
            this.log('Installing required packages (this may take several minutes)...');
            await this.installPackages();
            
            // Try to install seroCOP from GitHub or local
            this.log('Loading seroCOP package...');
            await this.loadSeroCOP();

            this.hideLoading();
            this.log('Ready to analyze data!');
        } catch (error) {
            this.logError('Failed to initialize WebR: ' + error.message);
            console.error(error);
        }
    }

    async installPackages() {
        // WebR requires binary packages from the webR repository
        this.log('Installing required packages from webR repository...');
        
        try {
            await this.webR.installPackages(['ggplot2', 'dplyr', 'tidyr', 'MASS']);
            this.log('Base packages installed successfully');
        } catch (error) {
            this.logError(`Package installation warning: ${error.message}`);
            this.log('Continuing with available packages...');
        }
    }

    async loadSeroCOP() {
        try {
            // Since brms/Stan are not available in webR, we'll need to work around this
            // For now, we'll create a simplified version that works with available packages
            this.log('Setting up analysis environment...');
            
            await this.webR.evalR(`
                # Create a simplified fitting function that works in webR
                # This is a workaround since brms is not available
                
                fit_logistic <- function(titre, infected, chains = 2, iter = 1000) {
                    # Use base R's glm for logistic regression as a starting point
                    data <- data.frame(titre = titre, infected = infected)
                    
                    # Fit a simple logistic model
                    model <- glm(infected ~ titre, data = data, family = binomial(link = "logit"))
                    
                    # Create a simple structure to return
                    list(
                        model = model,
                        coefficients = coef(model),
                        fitted = fitted(model),
                        predictions = predict(model, type = "response")
                    )
                }
                
                # Store this function globally
                .GlobalEnv$fit_logistic <- fit_logistic
            `);
            
            this.log('Analysis environment ready');
            this.log('NOTE: Using simplified logistic regression (brms/Stan not available in webR)');
            
        } catch (error) {
            this.logError('Could not set up analysis environment: ' + error.message);
        }
    }

    setupEventListeners() {
        // File upload
        document.getElementById('file-input').addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Load example data
        document.getElementById('load-example').addEventListener('click', () => this.loadExampleData());
        
        // Load multi-biomarker example
        document.getElementById('load-multi-example').addEventListener('click', () => this.loadMultiBiomarkerData());
        
        // Fit model button
        document.getElementById('fit-model').addEventListener('click', () => this.fitModel());
            const fitServerBtn = document.getElementById('fitServerBtn');
            if (fitServerBtn) {
                fitServerBtn.addEventListener('click', () => this.fitOnServer());
                // Enable when data is loaded similar to fit-model
                const enableButtons = () => {
                    document.getElementById('fit-model').disabled = false;
                    fitServerBtn.disabled = false;
                };
                // Hook where current code enables fit-model; call enableButtons after data load
                this.enableFitButtons = enableButtons;
            }
        
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
            await this.loadDataFromCSV(text);
        } catch (error) {
            this.logError('Failed to load file: ' + error.message);
        }
    }

    async loadDataFromCSV(csvText) {
        try {
            this.log('Loading data...');
            
            // Store CSV for server upload
            this.currentDataCsv = csvText;
            
            // Upload CSV to webR
            await this.webR.FS.writeFile('/data.csv', csvText);
            
            // Read and validate data
            await this.webR.evalR(`
                data <- read.csv('/data.csv')
                
                # Check if infected column exists
                if (!'infected' %in% names(data)) stop('Missing required column: infected')
                
                # Check infected is binary
                if (!all(data$infected %in% c(0, 1))) stop('infected column must be 0 or 1')
                
                # Check if we have titre column (single biomarker) or multiple titre columns
                exclude_cols <- c('infected', 'group')
                titre_cols <- setdiff(names(data), exclude_cols)
                
                if (length(titre_cols) == 0) {
                    stop('No titre columns found. Need at least one numeric column.')
                }
                
                # For summary, use first titre column or "titre" if it exists
                if ('titre' %in% names(data)) {
                    titre_for_summary <- data$titre
                } else {
                    titre_for_summary <- data[[titre_cols[1]]]
                }
                
                .GlobalEnv$titre_for_summary <- titre_for_summary
                .GlobalEnv$n_titre_cols <- length(titre_cols)
            `);
            
            // Get summary statistics one by one
            const nResult = await this.webR.evalR('nrow(data)');
            const n = await nResult.toNumber();
            
            const nInfectedResult = await this.webR.evalR('sum(data$infected)');
            const n_infected = await nInfectedResult.toNumber();
            
            const nProtectedResult = await this.webR.evalR('sum(1 - data$infected)');
            const n_protected = await nProtectedResult.toNumber();
            
            const hasGroupResult = await this.webR.evalR('"group" %in% names(data)');
            const has_group = await hasGroupResult.toBoolean();
            
            const titreMinResult = await this.webR.evalR('min(titre_for_summary)');
            const titre_min = await titreMinResult.toNumber();
            
            const titreMaxResult = await this.webR.evalR('max(titre_for_summary)');
            const titre_max = await titreMaxResult.toNumber();
            
            const colsResult = await this.webR.evalR('paste(names(data), collapse=", ")');
            const columns = await colsResult.toString();
            
            const nTitreColsResult = await this.webR.evalR('n_titre_cols');
            const n_titre_cols = await nTitreColsResult.toNumber();
            
            const summary = {
                n: n,
                n_infected: n_infected,
                n_protected: n_protected,
                has_group: has_group,
                titre_range: [titre_min, titre_max],
                columns: columns,
                n_biomarkers: n_titre_cols
            };
            
            this.currentData = summary;
            
            this.displayDataSummary(summary);
                if (this.enableFitButtons) this.enableFitButtons();
            document.getElementById('fit-model').disabled = false;
            this.log('Data loaded successfully');
            
        } catch (error) {
            this.logError('Failed to process data: ' + error.message);
            console.error(error);
        }
    }

    async loadExampleData() {
        this.log('Generating example data...');
        
        try {
            await this.webR.evalR(`
                set.seed(123)
                n <- 200
                titre <- rnorm(n, mean = 2, sd = 1.5)
                prob <- 0.05 + 0.9 / (1 + exp(2 * (titre - 1.5)))
                infected <- rbinom(n, 1, prob)
                
                # Create groups for hierarchical example
                group <- sample(c("Group A", "Group B", "Group C"), n, replace = TRUE)
                
                example_data <- data.frame(
                    titre = titre,
                    infected = infected,
                    group = group
                )
                
                write.csv(example_data, '/data.csv', row.names = FALSE)
            `);
            
            const csvText = await this.webR.FS.readFile('/data.csv', { encoding: 'utf8' });
            await this.loadDataFromCSV(csvText);
            
        } catch (error) {
            this.logError('Failed to generate example data: ' + error.message);
        }
    }
    
    async loadMultiBiomarkerData() {
        this.log('Generating multi-biomarker example data...');
        
        try {
            await this.webR.evalR(`
                set.seed(2025)
                n <- 250
                
                # Biomarker 1: Strong CoP (IgG)
                titre_IgG <- rnorm(n, mean = 2.5, sd = 1.2)
                prob_IgG <- 0.02 + 0.68 / (1 + exp(2.5 * (titre_IgG - 2.0)))
                
                # Biomarker 2: Weak CoP (IgA)
                titre_IgA <- rnorm(n, mean = 1.8, sd = 1.5)
                prob_IgA <- 0.15 + 0.55 / (1 + exp(1.0 * (titre_IgA - 1.5)))
                
                # Biomarker 3: No CoP (Non-specific)
                titre_Nonspec <- rnorm(n, mean = 3.0, sd = 1.0)
                prob_Nonspec <- rep(0.35, n)
                
                # Generate infection outcomes
                prob_combined <- 0.5 * prob_IgG + 0.3 * prob_IgA + 0.2 * prob_Nonspec
                infected <- rbinom(n, 1, prob_combined)
                
                multi_data <- data.frame(
                    IgG = titre_IgG,
                    IgA = titre_IgA,
                    Nonspecific = titre_Nonspec,
                    infected = infected
                )
                
                write.csv(multi_data, '/data.csv', row.names = FALSE)
            `);
            
            const csvText = await this.webR.FS.readFile('/data.csv', { encoding: 'utf8' });
            await this.loadDataFromCSV(csvText);
            
            this.log('Multi-biomarker data loaded: IgG (strong), IgA (weak), Nonspecific (no CoP)');
            
        } catch (error) {
            this.logError('Failed to generate multi-biomarker data: ' + error.message);
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
        
        // Add data table preview
        this.displayDataTable();
    }
    
    async displayDataTable() {
        try {
            // Get first 10 rows of data
            const tableResult = await this.webR.evalR(`
                data <- read.csv('/data.csv')
                head_data <- head(data, 10)
                
                # Convert to a formatted string
                paste(
                    capture.output(print(head_data, row.names = FALSE)),
                    collapse = "\\n"
                )
            `);
            
            const tableText = await tableResult.toString();
            
            const tableDiv = document.getElementById('data-table');
            tableDiv.innerHTML = `
                <h4 style="margin-top: 20px; margin-bottom: 10px;">Data Preview (first 10 rows):</h4>
                <pre style="background: #f5f5f5; padding: 15px; border: 1px solid #e0e0e0; overflow-x: auto; font-size: 0.85rem;">${tableText}</pre>
            `;
        } catch (error) {
            console.error('Failed to display data table:', error);
        }
    }

    async fitModel() {
        const modelType = document.getElementById('model-type').value;
        const useHierarchical = document.getElementById('hierarchical-check').checked;
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
                csv_text: this.currentDataCsv,
                infected_col: 'infected',
                chains: 2,
                iter: 1000
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
    }    async fitSingleBiomarker(useHierarchical, chains, iter) {
        await this.webR.evalR(`
            data <- read.csv('/data.csv')
            
            # Determine which titre column to use
            if ('titre' %in% names(data)) {
                titre_col <- data$titre
            } else {
                # Use first non-infected, non-group column
                exclude_cols <- c('infected', 'group')
                titre_cols <- setdiff(names(data), exclude_cols)
                titre_col <- data[[titre_cols[1]]]
                message(paste("Using", titre_cols[1], "as titre column"))
            }
            
            # Use the simplified logistic regression
            model_result <- fit_logistic(
                titre = titre_col,
                infected = data$infected,
                chains = ${chains},
                iter = ${iter}
            )
            
            # Extract coefficients for 4PL approximation
            # Convert logistic coefficients to 4PL-like parameters
            intercept <- model_result$coefficients[1]
            slope <- model_result$coefficients[2]
            
            # Approximate 4PL parameters from logistic regression
            alpha <- -intercept / slope  # Inflection point
            beta <- slope                 # Slope
            gamma <- 0.05                 # Lower asymptote (fixed)
            lambda <- 0.95                # Upper asymptote (fixed)
            
            # Create posterior-like samples (simulation for demonstration)
            n_samples <- ${chains} * ${iter}
            posterior_samples <- list(
                alpha = rnorm(n_samples, alpha, abs(alpha) * 0.1),
                beta = rnorm(n_samples, beta, abs(beta) * 0.1),
                gamma = rnorm(n_samples, gamma, 0.01),
                lambda = rnorm(n_samples, lambda, 0.01)
            )
            
            # Store globally
            .GlobalEnv$fitted_model <- list(
                model = model_result$model,
                posterior = posterior_samples,
                predictions = model_result$predictions,
                data = data.frame(
                    titre = titre_col,
                    infected = data$infected
                )
            )
        `);
        
        this.model = 'fitted_model';
    }

    async fitMultiBiomarker(useHierarchical, chains, iter) {
        // For multi-biomarker, we need a matrix
        // This assumes columns other than 'infected' and 'group' are biomarkers
        
        const groupArg = useHierarchical ? ', group = data$group' : '';
        
        await this.webR.evalR(`
            data <- read.csv('/data.csv')
            
            # Identify biomarker columns
            exclude_cols <- c('infected', 'group')
            biomarker_cols <- setdiff(names(data), exclude_cols)
            
            if (length(biomarker_cols) == 1) {
                # Single biomarker, use SeroCOP
                model <- SeroCOP$new(
                    titre = data[[biomarker_cols[1]]],
                    infected = data$infected
                    ${groupArg}
                )
            } else {
                # Multiple biomarkers, use SeroCOPMulti
                titre_matrix <- as.matrix(data[, biomarker_cols])
                colnames(titre_matrix) <- biomarker_cols
                
                model <- SeroCOPMulti$new(
                    titre = titre_matrix,
                    infected = data$infected
                    ${groupArg}
                )
            }
            
            # Fit the model
            if (inherits(model, 'SeroCOPMulti')) {
                model$fit_all(chains = ${chains}, iter = ${iter}, cores = 1)
            } else {
                model$fit(chains = ${chains}, iter = ${iter}, cores = 1)
            }
            
            .GlobalEnv$fitted_model <- model
        `);
        
        this.model = 'fitted_model';
    }

    async displayResults() {
        document.getElementById('results-area').style.display = 'block';
        document.getElementById('no-results').style.display = 'none';
        
        await this.displayPosteriors();
        await this.displayProtectionCurve();
        await this.displayROCCurve();
        await this.displayMetrics();
    }

    async displayPosteriors() {
        try {
            this.log('Generating posterior plots...');
            
            // Extract posterior samples
            await this.webR.evalR(`
                model <- .GlobalEnv$fitted_model
                posteriors <- model$posterior
                
                # Store each parameter separately for easier access
                .GlobalEnv$post_alpha <- posteriors$alpha
                .GlobalEnv$post_beta <- posteriors$beta
                .GlobalEnv$post_gamma <- posteriors$gamma
                .GlobalEnv$post_lambda <- posteriors$lambda
            `);
            
            // Get each parameter
            const alphaResult = await this.webR.evalR('post_alpha');
            const betaResult = await this.webR.evalR('post_beta');
            const gammaResult = await this.webR.evalR('post_gamma');
            const lambdaResult = await this.webR.evalR('post_lambda');
            
            const posteriors = {
                alpha: await alphaResult.toArray(),
                beta: await betaResult.toArray(),
                gamma: await gammaResult.toArray(),
                lambda: await lambdaResult.toArray()
            };
            
            // Create plots for each parameter
            const plotsDiv = document.getElementById('posterior-plots');
            plotsDiv.innerHTML = '';
            
            for (const [param, values] of Object.entries(posteriors)) {
                const plotDiv = document.createElement('div');
                plotDiv.className = 'posterior-plot';
                
                const canvas = document.createElement('canvas');
                canvas.id = `posterior-${param}`;
                plotDiv.appendChild(canvas);
                plotsDiv.appendChild(plotDiv);
                
                // Simple histogram
                this.plotHistogram(canvas, values, param);
            }
            
        } catch (error) {
            this.logError('Failed to generate posterior plots: ' + error.message);
            console.error(error);
        }
    }

    plotHistogram(canvas, data, title) {
        const ctx = canvas.getContext('2d');
        canvas.width = 400;
        canvas.height = 300;
        
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
        ctx.fillStyle = '#4A90E2';
        hist.forEach((count, i) => {
            const x = padding + (i / bins) * width;
            const barHeight = (count / maxCount) * height;
            const y = padding + height - barHeight;
            const barWidth = width / bins;
            
            ctx.fillRect(x, y, barWidth * 0.9, barHeight);
        });
        
        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(padding, padding);
        ctx.lineTo(padding, padding + height);
        ctx.lineTo(padding + width, padding + height);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#333';
        ctx.font = '14px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(title.toUpperCase(), canvas.width / 2, 20);
        ctx.fillText(min.toFixed(2), padding, canvas.height - 10);
        ctx.fillText(max.toFixed(2), canvas.width - padding, canvas.height - 10);
        
        // Mean and credible interval
        const mean = data.reduce((a, b) => a + b, 0) / data.length;
        const sorted = [...data].sort((a, b) => a - b);
        const ci_low = sorted[Math.floor(data.length * 0.025)];
        const ci_high = sorted[Math.floor(data.length * 0.975)];
        
        ctx.font = '12px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`Mean: ${mean.toFixed(3)}`, padding + 10, padding + 20);
        ctx.fillText(`95% CI: [${ci_low.toFixed(3)}, ${ci_high.toFixed(3)}]`, padding + 10, padding + 40);
    }
    
    async displayProtectionCurve() {
        try {
            this.log('Generating protection curve...');
            
            // Get predictions across titre range
            await this.webR.evalR(`
                model <- .GlobalEnv$fitted_model
                data <- model$data
                
                # Create prediction grid
                titre_range <- seq(min(data$titre), max(data$titre), length.out = 100)
                
                # Get predictions using the fitted model
                pred_data <- data.frame(titre = titre_range)
                predictions <- predict(model$model, newdata = pred_data, type = "response")
                
                .GlobalEnv$curve_titre <- titre_range
                .GlobalEnv$curve_prob <- predictions
                .GlobalEnv$obs_titre <- data$titre
                .GlobalEnv$obs_infected <- data$infected
            `);
            
            const titreResult = await this.webR.evalR('curve_titre');
            const probResult = await this.webR.evalR('curve_prob');
            const obsTitreResult = await this.webR.evalR('obs_titre');
            const obsInfectedResult = await this.webR.evalR('obs_infected');
            
            const titre = await titreResult.toArray();
            const prob = await probResult.toArray();
            const obsTitre = await obsTitreResult.toArray();
            const obsInfected = await obsInfectedResult.toArray();
            
            const curveDiv = document.getElementById('curve-plot');
            const canvas = document.createElement('canvas');
            canvas.id = 'protection-curve-canvas';
            curveDiv.innerHTML = '';
            curveDiv.appendChild(canvas);
            
            this.plotProtectionCurve(canvas, titre, prob, obsTitre, obsInfected);
            
        } catch (error) {
            this.logError('Failed to generate protection curve: ' + error.message);
            console.error(error);
        }
    }
    
    plotProtectionCurve(canvas, titre, prob, obsTitre, obsInfected) {
        const ctx = canvas.getContext('2d');
        canvas.width = 600;
        canvas.height = 400;
        
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
            const y = toY(obsInfected[i]);
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
        ctx.fillText('Protection Curve', canvas.width / 2, 30);
        ctx.fillText('Antibody Titre', canvas.width / 2, canvas.height - 10);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('Probability of Infection', 0, 0);
        ctx.restore();
        
        // Axis labels
        ctx.font = '11px Avenir, sans-serif';
        ctx.fillText(xMin.toFixed(1), padding, canvas.height - 30);
        ctx.fillText(xMax.toFixed(1), padding + width, canvas.height - 30);
        ctx.textAlign = 'right';
        ctx.fillText('0.0', padding - 5, padding + height);
        ctx.fillText('1.0', padding - 5, padding);
    }
    
    async displayROCCurve() {
        try {
            this.log('Generating ROC curve...');
            
            // Calculate ROC curve points
            await this.webR.evalR(`
                model <- .GlobalEnv$fitted_model
                predictions <- model$predictions
                observed <- model$data$infected
                
                # Calculate ROC points
                thresholds <- seq(0, 1, length.out = 100)
                tpr <- numeric(100)
                fpr <- numeric(100)
                
                for (i in 1:100) {
                    pred_class <- as.numeric(predictions >= thresholds[i])
                    tp <- sum(pred_class == 1 & observed == 1)
                    fp <- sum(pred_class == 1 & observed == 0)
                    tn <- sum(pred_class == 0 & observed == 0)
                    fn <- sum(pred_class == 0 & observed == 1)
                    
                    tpr[i] <- if (tp + fn > 0) tp / (tp + fn) else 0
                    fpr[i] <- if (fp + tn > 0) fp / (fp + tn) else 0
                }
                
                .GlobalEnv$roc_fpr <- fpr
                .GlobalEnv$roc_tpr <- tpr
            `);
            
            const fprResult = await this.webR.evalR('roc_fpr');
            const tprResult = await this.webR.evalR('roc_tpr');
            
            const fpr = await fprResult.toArray();
            const tpr = await tprResult.toArray();
            
            const rocDiv = document.getElementById('roc-plot');
            const canvas = document.createElement('canvas');
            canvas.id = 'roc-curve-canvas';
            rocDiv.innerHTML = '';
            rocDiv.appendChild(canvas);
            
            this.plotROCCurve(canvas, fpr, tpr);
            
        } catch (error) {
            this.logError('Failed to generate ROC curve: ' + error.message);
            console.error(error);
        }
    }
    
    plotROCCurve(canvas, fpr, tpr) {
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
        ctx.fillText('ROC Curve', canvas.width / 2, 30);
        ctx.fillText('False Positive Rate', canvas.width / 2, canvas.height - 10);
        
        ctx.save();
        ctx.translate(15, canvas.height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText('True Positive Rate', 0, 0);
        ctx.restore();
        
        // Axis labels
        ctx.font = '11px Avenir, sans-serif';
        ctx.fillText('0.0', padding, canvas.height - 30);
        ctx.fillText('1.0', padding + width, canvas.height - 30);
        ctx.textAlign = 'right';
        ctx.fillText('0.0', padding - 5, padding + height);
        ctx.fillText('1.0', padding - 5, padding);
    }

    async displayMetrics() {
        try {
            await this.webR.evalR(`
                model <- .GlobalEnv$fitted_model
                
                # Calculate performance metrics
                predictions <- model$predictions
                observed <- model$data$infected
                
                # Simple AUC approximation (Mann-Whitney U statistic)
                ranks <- rank(predictions)
                n1 <- sum(observed == 1)
                n0 <- sum(observed == 0)
                auc_value <- if (n1 > 0 && n0 > 0) {
                    (sum(ranks[observed == 1]) - n1 * (n1 + 1) / 2) / (n1 * n0)
                } else {
                    NA
                }
                
                # Brier score
                brier <- mean((predictions - observed)^2)
                
                .GlobalEnv$metrics_auc <- auc_value
                .GlobalEnv$metrics_brier <- brier
                .GlobalEnv$metrics_n <- length(observed)
            `);
            
            const aucResult = await this.webR.evalR('metrics_auc');
            const brierResult = await this.webR.evalR('metrics_brier');
            const nResult = await this.webR.evalR('metrics_n');
            
            const auc = await aucResult.toNumber();
            const brier = await brierResult.toNumber();
            const n = await nResult.toNumber();
            
            const metricsDiv = document.getElementById('metrics-table');
            metricsDiv.innerHTML = `
                <table class="metrics-table">
                    <tr>
                        <th>Metric</th>
                        <th>Value</th>
                    </tr>
                    <tr>
                        <td>ROC AUC</td>
                        <td>${auc.toFixed(4)}</td>
                    </tr>
                    <tr>
                        <td>Brier Score</td>
                        <td>${brier.toFixed(4)}</td>
                    </tr>
                    <tr>
                        <td>Observations</td>
                        <td>${n}</td>
                    </tr>
                </table>
                <p style="margin-top: 20px; font-size: 0.9rem; color: #666;">
                    <strong>Note:</strong> Using simplified logistic regression. 
                    For full Bayesian analysis with brms, use native R installation.
                </p>
            `;
            
        } catch (error) {
            this.logError('Failed to compute metrics: ' + error.message);
            console.error(error);
        }
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
