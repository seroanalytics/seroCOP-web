# SeroCOP WebR Application - Project Summary

## 🎯 Overview

A complete browser-based web application for analyzing correlates of protection using the seroCOP R package, powered by WebR (R in WebAssembly). Users can upload their own data and fit Bayesian models entirely in their browser without any R installation required.

## 📁 Project Structure

```
seroCOP-web/
├── index.html           # Main HTML interface
├── app.js              # JavaScript application logic and WebR integration
├── style.css           # Styling and responsive design
├── package.json        # NPM configuration for easy serving
├── start-server.sh     # Quick start script for local testing
├── example_data.csv    # Sample data for testing
├── README.md           # User documentation
├── DEPLOYMENT.md       # Deployment guide for various platforms
└── .gitignore         # Git ignore rules
```

## ✨ Key Features

### 1. **Data Upload & Management**
- Upload CSV files with antibody titre and infection data
- Built-in example data generator
- Data validation and preview
- Support for hierarchical (grouped) data

### 2. **Model Fitting**
- Single biomarker analysis using SeroCOP class
- Multi-biomarker analysis using SeroCOPMulti class
- Hierarchical models with group-level effects
- Configurable MCMC parameters (chains, iterations)
- Uses brms (Bayesian Regression Models using Stan)

### 3. **Visualization**
- Posterior distribution plots for all parameters
- Protection curve visualization
- ROC curve analysis
- Performance metrics display

### 4. **Performance Metrics**
- ROC AUC (Area Under Curve)
- Brier Score
- LOO-CV (Leave-One-Out Cross-Validation)

## 🔧 Technical Implementation

### WebR Integration
- Uses WebR 0.4.2 from CDN
- Automatic package installation (brms, rstan, R6, pROC, loo, ggplot2)
- Attempts to load seroCOP from GitHub
- Handles R code execution in browser

### Architecture
- **ES6 Modules**: Modern JavaScript with class-based structure
- **SeroCOPApp Class**: Main application controller
- **Async/Await**: For WebR operations
- **Event-Driven**: Responsive UI with event listeners

### Data Flow
1. User uploads CSV or loads example data
2. Data is written to WebR virtual filesystem
3. R code validates and processes data
4. SeroCOP/SeroCOPMulti objects created
5. brms fits Bayesian model using MCMC
6. Results extracted and visualized

## 🚀 Quick Start

### Local Testing
```bash
cd seroCOP-web
./start-server.sh
# or
python -m http.server 8000
```

Open: http://localhost:8000

### GitHub Pages Deployment
```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/username/repo.git
git push -u origin main
```

Enable GitHub Pages in repository settings.

## 📊 Data Format Requirements

### CSV Columns:
- **titre** (required): Numeric antibody levels (log scale recommended)
- **infected** (required): Binary outcome (0=protected, 1=infected)
- **group** (optional): Factor for hierarchical modeling

### Example:
```csv
titre,infected,group
1.5,0,Group A
2.3,1,Group A
1.8,0,Group B
```

## 🔬 Model Details

### Four-Parameter Logistic Model
```
P(infection | titre) = γ + (λ - γ) / (1 + exp(β(titre - α)))
```

**Parameters:**
- **α (alpha)**: Inflection point (titre at 50% protection)
- **β (beta)**: Slope (steepness of dose-response curve)
- **γ (gamma)**: Lower asymptote (minimum infection probability)
- **λ (lambda)**: Upper asymptote (maximum infection probability)

### Bayesian Inference
- Uses brms interface to Stan
- MCMC sampling for posterior distributions
- Configurable chains and iterations
- Built-in diagnostics (Rhat, ESS)

## ⚙️ Configuration Options

### Model Settings:
- Model type: Single or Multi-biomarker
- Hierarchical effects: Enable/disable
- MCMC chains: 1-4 (default: 2)
- Iterations: 500-4000 (default: 1000)

### Recommended Settings:
- **Quick test**: 2 chains, 1000 iterations (~2-3 minutes)
- **Production**: 4 chains, 2000 iterations (~5-10 minutes)
- **High precision**: 4 chains, 4000 iterations (~10-20 minutes)

## 🌐 Browser Requirements

### Minimum Requirements:
- Modern browser (Chrome 95+, Firefox 95+, Safari 15+)
- WebAssembly support (standard in modern browsers)
- SharedArrayBuffer support (enabled by default)
- 4GB RAM recommended

### Performance:
- First load: 1-2 minutes (downloads ~200MB WebAssembly)
- Subsequent loads: Fast (files cached)
- Model fitting: 2-10 minutes depending on data size and settings

## 📦 Dependencies

### Frontend:
- WebR 0.4.2 (via CDN)
- Vanilla JavaScript (ES6+)
- CSS3 with responsive design

### R Packages (Auto-installed by WebR):
- brms (Bayesian models)
- rstan (Stan interface)
- R6 (OOP)
- pROC (ROC analysis)
- loo (Cross-validation)
- ggplot2 (Plotting)
- tidyr (Data manipulation)

### Optional:
- seroCOP (loaded from GitHub)

## 🎨 UI/UX Features

### Design:
- Clean, modern interface
- Responsive design (mobile-friendly)
- Color-coded sections
- Progress indicators
- Loading states
- Error handling

### User Experience:
- Step-by-step workflow
- Inline help text
- Example data for quick testing
- Console output for transparency
- Tabbed results view
- Interactive plots

## 🔒 Security & Privacy

### Data Privacy:
- All computation happens in browser
- No data sent to servers
- No backend database
- Files processed locally only

### Security:
- HTTPS recommended for deployment
- CORS headers required for SharedArrayBuffer
- No sensitive data exposure

## 📈 Performance Considerations

### Optimization:
- WebR files cached after first load
- Efficient data transfer to/from R
- Minimal DOM manipulation
- Async operations for responsiveness

### Limitations:
- Browser memory constraints (~2GB typical)
- Slower than native R (WebAssembly overhead)
- Large datasets (>1000 obs) may be slow
- Complex models may not converge with limited iterations

## 🐛 Known Issues & Limitations

1. **WebR Package Ecosystem**: Not all R packages available in WebAssembly
2. **Performance**: Slower than native R installation
3. **Memory**: Browser memory limits may affect large datasets
4. **First Load**: Significant download time (cached afterwards)
5. **seroCOP Installation**: May need manual installation if GitHub fails

## 🔄 Future Enhancements

### Potential Features:
- [ ] More plot types (forest plots, trace plots)
- [ ] Model comparison tools
- [ ] Export results (PDF reports)
- [ ] Save/load session state
- [ ] Advanced diagnostics (convergence checks)
- [ ] Batch analysis capabilities
- [ ] Custom prior specification
- [ ] Real-time plotting during MCMC

### Technical Improvements:
- [ ] Web Workers for better performance
- [ ] Progressive Web App (PWA) capabilities
- [ ] Service worker for offline support
- [ ] IndexedDB for result caching
- [ ] More sophisticated visualization library

## 📖 Documentation

### Files:
- **README.md**: User-facing documentation
- **DEPLOYMENT.md**: Deployment instructions for various platforms
- **This file**: Developer/technical overview

### External Resources:
- WebR Documentation: https://docs.r-wasm.org/webr/
- seroCOP Package: https://seroanalytics.org/seroCOP/
- brms Documentation: https://paul-buerkner.github.io/brms/

## 🤝 Contributing

To extend or modify the application:

1. **HTML** (`index.html`): UI structure and layout
2. **JavaScript** (`app.js`): Application logic and WebR integration
3. **CSS** (`style.css`): Styling and responsive design

### Key JavaScript Classes/Methods:
- `SeroCOPApp`: Main application controller
- `init()`: Initialize WebR environment
- `installPackages()`: Install R dependencies
- `handleFileUpload()`: Process user data
- `fitModel()`: Run Bayesian analysis
- `displayResults()`: Show visualizations

## 📝 License

Part of the seroCOP package project. See main package LICENSE.

## 📧 Support

- GitHub Issues: https://github.com/seroanalytics/seroCOP/issues
- Package Docs: https://seroanalytics.org/seroCOP/

## 🙏 Acknowledgments

- **WebR Team**: For making R in the browser possible
- **brms/Stan**: For Bayesian modeling framework
- **seroCOP Package**: For the core analysis methods

---

**Created**: December 2025  
**Version**: 1.0.0  
**Author**: David Hodgson
