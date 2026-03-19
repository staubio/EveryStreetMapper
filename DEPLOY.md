# Deployment Guide

This guide covers deploying EveryStreet Mapper to production using Vercel (frontend) and Railway (backend).

## Prerequisites

- GitHub account with this repo pushed
- Vercel account (free tier works)
- Railway account (free tier or $5/month)

---

## Step 1: Deploy Backend to Railway

1. **Go to [Railway](https://railway.app)** and sign in with GitHub

2. **Create new project** → "Deploy from GitHub repo"

3. **Select this repository** and choose the `backend` directory as root:
   - Click on the service after it's created
   - Go to Settings → Root Directory → set to `backend`

4. **Add environment variables** (Settings → Variables):
   ```
   CORS_ORIGINS=https://your-app.vercel.app
   MAX_AREA_SQ_KM=5.0
   ENVIRONMENT=production
   ```

5. **Generate a domain**:
   - Settings → Networking → Generate Domain
   - Copy the URL (e.g., `your-app-production.up.railway.app`)

6. **Verify deployment**:
   - Visit `https://your-backend-url.railway.app/api/health`
   - Should return `{"status": "healthy"}`

---

## Step 2: Deploy Frontend to Vercel

1. **Go to [Vercel](https://vercel.com)** and sign in with GitHub

2. **Import project** → Select this repository

3. **Configure project**:
   - Framework Preset: Vite
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`

4. **Add environment variable**:
   ```
   VITE_API_URL=https://your-backend-url.railway.app
   ```
   (Use the Railway URL from Step 1)

5. **Deploy** and copy your Vercel URL

---

## Step 3: Update Backend CORS

Go back to Railway and update the `CORS_ORIGINS` variable:
```
CORS_ORIGINS=https://your-app.vercel.app
```

Railway will automatically redeploy.

---

## Subsequent Deploys

After initial setup, just push to `main`:

```bash
git add .
git commit -m "Your changes"
git push origin main
```

Both Vercel and Railway will automatically redeploy.

---

## Custom Domain (Optional)

### Vercel (Frontend)
1. Go to Project Settings → Domains
2. Add your domain
3. Update DNS records as instructed

### Railway (Backend)
1. Go to Service Settings → Networking
2. Add custom domain
3. Update DNS records as instructed

**Don't forget** to update `CORS_ORIGINS` on Railway to include your custom domain!

---

## Environment Variables Reference

### Backend (Railway)

| Variable | Description | Example |
|----------|-------------|---------|
| `CORS_ORIGINS` | Allowed frontend origins (comma-separated) | `https://myapp.vercel.app` |
| `MAX_AREA_SQ_KM` | Max selectable area size | `5.0` |
| `OVERPASS_API_URL` | OSM data source | `https://overpass-api.de/api/interpreter` |
| `ENVIRONMENT` | Runtime environment | `production` |

### Frontend (Vercel)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `https://myapp.up.railway.app` |

---

## Monitoring & Logs

### Railway
- Dashboard shows CPU, memory, requests
- View logs: Service → Deployments → View Logs

### Vercel
- Analytics available in dashboard
- Function logs under Deployments → Functions

---

## Scaling Up

If you need more capacity:

1. **Railway**: Upgrade plan for more resources
2. **Self-host Overpass**: For heavy OSM usage, run your own Overpass instance
3. **Add caching**: Redis for API response caching
4. **CDN**: Cloudflare in front of everything

---

## Troubleshooting

### CORS Errors
- Verify `CORS_ORIGINS` includes your frontend URL exactly
- Check for trailing slashes (don't include them)

### Backend Not Responding
- Check Railway logs for errors
- Verify health check: `/api/health`

### Routes Not Calculating
- Check browser console for API errors
- Overpass API may be rate-limited; try again later
