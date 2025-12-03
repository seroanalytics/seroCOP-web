# SeroCOP WebR Application

A browser-based application for analyzing correlates of protection using the seroCOP package, powered by WebR.

## Overview

This web application allows users to:
- Upload their own seroepidemiological data
- Fit Bayesian logistic models using the seroCOP package
- Visualize posterior distributions
- View model performance metrics
- All without requiring R installation - runs entirely in the browser!

## Features

- **Data Upload**: Upload CSV files with antibody titre and infection outcome data
- **Example Data**: Generate synthetic example data to test the application
- **Model Fitting**: Fit single or multiple biomarker models using brms
- **Hierarchical Models**: Support for group-level effects
- **Visualization**: Interactive posterior distribution plots
- **Performance Metrics**: ROC AUC, Brier score, and LOO-CV metrics
- **Pure Browser-Based**: No server required, runs entirely client-side using WebR

## Getting Started

### Running Locally

1. Serve the files using a local web server (required for WebR):

```bash
# Using Python
python -m http.server 8000

# Or using Node.js
npx http-server -p 8000
```

2. Open your browser to `http://localhost:8000`

3. Wait for WebR to initialize (first load may take 1-2 minutes)

### Deploying to GitHub Pages

1. Push the `seroCOP-web` folder contents to a GitHub repository

2. Enable GitHub Pages in repository settings

3. The app will be available at `https://yourusername.github.io/repository-name/`

## Data Format

Your CSV file should contain:

### Required Columns:
- `titre`: Numeric antibody titre values (log scale recommended)
- `infected`: Binary infection status (0 = protected, 1 = infected)

### Optional Columns:
- `group`: Factor for hierarchical modeling (e.g., age groups, study sites)
- Additional titre columns for multi-biomarker analysis

### Example CSV:

```csv
titre,infected,group
1.5,0,Group A
2.3,1,Group A
1.8,0,Group B
3.1,1,Group B
2.0,0,Group C
```

## Usage

1. **Upload Data**
   - Click "Choose File" and select your CSV file
   - Or click "Load Example Data" to use synthetic data
   - Preview shows data summary and column information

2. **Configure Model**
   - Choose single or multi-biomarker model
   - Enable hierarchical effects if you have group data
   - Set MCMC parameters (chains and iterations)
   - Lower values = faster but less precise
   - Recommended: 2 chains, 1000 iterations for quick testing

3. **Fit Model**
   - Click "Fit Model" button
   - Monitor progress in console output
   - Fitting may take several minutes depending on data size

4. **View Results**
   - **Posteriors**: View posterior distributions for model parameters
   - **Protection Curve**: See fitted dose-response curve
   - **ROC Curve**: Examine classification performance
   - **Metrics**: Check AUC, Brier score, and LOO-CV

## Technical Details

### WebR Architecture

This application uses:
- **WebR**: R compiled to WebAssembly to run in browsers
- **brms**: Bayesian Regression Models using Stan
- **seroCOP**: Custom R6 class for correlates of protection analysis

### Browser Requirements

- Modern browser with WebAssembly support
- Minimum 4GB RAM recommended
- SharedArrayBuffer support (enabled by default in most browsers)

### Performance Considerations

- First load downloads ~200MB of WebAssembly files (cached after)
- Model fitting is CPU-intensive and runs in browser
- Larger datasets and more MCMC iterations will take longer
- Consider using fewer chains/iterations for initial testing

## Model Details

The application fits a four-parameter logistic model:

```
P(infection | titre) = γ + (λ - γ) / (1 + exp(β(titre - α)))
```

Where:
- **α (alpha)**: Inflection point (titre at 50% protection)
- **β (beta)**: Slope parameter (steepness of curve)
- **γ (gamma)**: Lower asymptote (minimum infection probability)
- **λ (lambda)**: Upper asymptote (maximum infection probability)

## Limitations

- Computation is slower than native R due to WebAssembly overhead
- Large datasets (>1000 observations) may cause browser slowdown
- Complex hierarchical models may not converge with limited iterations
- Some R packages may not be available in WebR

## Troubleshooting

**App won't load:**
- Check browser console for errors
- Ensure you're serving files via HTTP/HTTPS (not file://)
- Try a different browser

**Model fitting fails:**
- Reduce number of chains or iterations
- Check data format matches requirements
- Ensure sufficient browser memory available

**Slow performance:**
- Close other browser tabs
- Use fewer MCMC iterations for testing
- Consider smaller subset of data

**Package installation fails:**
- WebR package ecosystem is still developing
- Some dependencies may not be available
- Check console for specific error messages

## Development

To modify or extend the application:

1. **HTML** (`index.html`): Structure and layout
2. **JavaScript** (`app.js`): WebR integration and logic
3. **CSS** (`style.css`): Styling and appearance

Key JavaScript classes:
- `SeroCOPApp`: Main application controller
- Methods for data loading, model fitting, visualization

## Resources

- [WebR Documentation](https://docs.r-wasm.org/webr/)
- [seroCOP Package](https://github.com/seroanalytics/seroCOP)
- [brms Documentation](https://paul-buerkner.github.io/brms/)

## License

This application is part of the seroCOP package project.
See the main package LICENSE for details.

## Citation

If you use this application in your research, please cite the seroCOP package:

```
Hodgson, D. (2025). seroCOP: Correlates of Protection Analysis Using Bayesian Methods.
R package version 0.1.0. https://seroanalytics.org/seroCOP/
```

## Support

For issues or questions:
- GitHub Issues: https://github.com/seroanalytics/seroCOP/issues
- Package Documentation: https://seroanalytics.org/seroCOP/
