# SeroCOP WebR App - Quick Reference

## 🚀 Start in 30 Seconds

```bash
cd seroCOP-web
./start-server.sh
```
Open: http://localhost:8000

## 📊 Data Format

**Required columns:**
- `titre` - Antibody levels (numeric)
- `infected` - Outcome (0 or 1)

**Optional:**
- `group` - For hierarchical models

**Example:**
```csv
titre,infected,group
1.5,0,Young
2.3,1,Young
```

## ⚙️ Recommended Settings

| Use Case | Chains | Iterations | Time |
|----------|--------|------------|------|
| Quick test | 2 | 1000 | ~2-3 min |
| Standard | 4 | 2000 | ~5-10 min |
| Publication | 4 | 4000 | ~10-20 min |

## 🔑 Key Features

✅ Upload your own CSV data  
✅ Generate example data  
✅ Single/multi-biomarker models  
✅ Hierarchical (grouped) models  
✅ Bayesian inference (brms/Stan)  
✅ Posterior visualizations  
✅ ROC AUC & Brier scores  
✅ All in your browser!  

## 🌐 Deploy Options

**GitHub Pages** (Easiest)
```bash
git init && git add . && git commit -m "init"
git remote add origin <your-repo>
git push -u origin main
# Enable Pages in repo settings
```

**Netlify** (Fastest)
- Drag & drop folder to netlify.com

**Local Server**
```bash
python -m http.server 8000
```

## 🐛 Troubleshooting

**Won't load?**
- Use HTTPS (required for SharedArrayBuffer)
- Try different browser (Chrome/Firefox/Safari)
- Check console for errors

**Slow?**
- First load downloads ~200MB (cached after)
- Reduce chains/iterations for testing
- Close other browser tabs

**Model fails?**
- Check data format (CSV with correct columns)
- Ensure infected is 0 or 1
- Try example data first

## 📖 Model Equation

```
P(infection | titre) = γ + (λ - γ) / (1 + exp(β(titre - α)))
```

**Parameters:**
- α: Inflection point
- β: Slope
- γ: Lower asymptote
- λ: Upper asymptote

## 🔗 Links

- 📚 Full README: `README.md`
- 🚀 Deployment Guide: `DEPLOYMENT.md`
- 📋 Project Summary: `PROJECT_SUMMARY.md`
- 📦 seroCOP Package: https://seroanalytics.org/seroCOP/
- 🌐 WebR Docs: https://docs.r-wasm.org/webr/

## 💡 Tips

1. **Test with example data first** - Click "Load Example Data"
2. **Start small** - Use 2 chains, 1000 iterations for testing
3. **Check console output** - Monitor progress and errors
4. **Be patient** - First load and model fitting take time
5. **Use HTTPS** - Required for full functionality

---

**Need help?** Check README.md or open an issue on GitHub
