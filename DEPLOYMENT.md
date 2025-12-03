# Deployment Guide for SeroCOP WebR App

## Quick Start (Local Development)

### Option 1: Python Server (Recommended)
```bash
cd seroCOP-web
python -m http.server 8000
```
Then open: http://localhost:8000

### Option 2: Node.js Server
```bash
cd seroCOP-web
npx http-server -p 8000
```
Then open: http://localhost:8000

### Option 3: Using npm
```bash
cd seroCOP-web
npm start
```

## Deploying to GitHub Pages

1. **Create a new repository** or use existing one on GitHub

2. **Push the seroCOP-web folder**:
```bash
cd seroCOP-web
git init
git add .
git commit -m "Initial commit of SeroCOP WebR app"
git branch -M main
git remote add origin https://github.com/yourusername/serocop-webr.git
git push -u origin main
```

3. **Enable GitHub Pages**:
   - Go to repository Settings
   - Navigate to "Pages" section
   - Under "Source", select "main" branch
   - Click Save
   - Your app will be available at: `https://yourusername.github.io/serocop-webr/`

## Deploying to Netlify

1. **Create a Netlify account** at https://netlify.com

2. **Deploy from folder**:
   - Drag and drop the `seroCOP-web` folder to Netlify
   - Or connect your GitHub repository

3. **Configure (optional)**:
   - Custom domain
   - HTTPS is automatic
   - Instant deployments on push

## Deploying to Vercel

1. **Install Vercel CLI**:
```bash
npm install -g vercel
```

2. **Deploy**:
```bash
cd seroCOP-web
vercel
```

3. **Follow prompts** for configuration

## Important Notes

### CORS and Security Headers

For WebR to work properly with SharedArrayBuffer, your server needs these headers:
```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

**GitHub Pages** and **Netlify** handle this automatically.

For custom servers, you may need to configure these headers.

### File Size Considerations

- WebR downloads ~200MB on first load
- Files are cached by the browser
- Consider CDN for production deployments

### Performance Tips

1. **Enable compression** (gzip/brotli) on your server
2. **Use CDN** for serving static files
3. **Enable browser caching** for JavaScript/CSS files

## Testing Before Deployment

1. Test locally with a proper HTTP server (not file://)
2. Check browser console for errors
3. Test with example data first
4. Try uploading your own CSV file
5. Verify model fitting works
6. Check all visualizations render correctly

## Monitoring

After deployment, monitor:
- Page load times
- WebR initialization time
- Model fitting performance
- Browser compatibility issues
- User feedback on speed/functionality

## Troubleshooting Deployment

**App doesn't load:**
- Check that you're using HTTPS (required for SharedArrayBuffer)
- Verify security headers are set correctly
- Check browser console for specific errors

**WebR fails to initialize:**
- Ensure CDN can be accessed
- Check for network/firewall issues
- Try different browser

**Slow loading:**
- First load is always slower (downloads WebAssembly)
- Subsequent loads should be faster (cached)
- Consider hosting WebR files yourself for better performance

## Custom Domain (GitHub Pages)

1. Add a `CNAME` file to your repository:
```
echo "serocop.yourdomain.com" > CNAME
git add CNAME
git commit -m "Add custom domain"
git push
```

2. Configure DNS:
   - Add CNAME record pointing to: `yourusername.github.io`
   - Wait for DNS propagation (can take 24-48 hours)

3. Enable HTTPS in GitHub Pages settings

## Updates and Maintenance

To update the app:
```bash
# Make changes to files
git add .
git commit -m "Update description"
git push
```

GitHub Pages/Netlify will automatically redeploy.

## Advanced Configuration

### Service Worker for Offline Support

Create `sw.js` for offline caching:
```javascript
// Cache WebR and app files for offline use
const CACHE_NAME = 'serocop-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});
```

### Analytics

Add Google Analytics or similar to `index.html`:
```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=YOUR-ID"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'YOUR-ID');
</script>
```

## Support

For deployment issues:
- GitHub Pages: https://docs.github.com/pages
- Netlify: https://docs.netlify.com
- Vercel: https://vercel.com/docs
- WebR: https://docs.r-wasm.org/webr/
