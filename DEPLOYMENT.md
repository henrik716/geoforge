# Secure GitHub OAuth Deployment Guide

## Development Setup

For local development, the current `.env` setup works fine:
- Client ID and secret are exposed (acceptable for development)
- Vite proxy handles CORS issues

## Production Deployment (Railway)

### 1. Update GitHub OAuth App

Change your Authorization callback URL to:
```
https://your-app-name.railway.app/oauth-callback.html
```

### 2. Set Railway Environment Variables

In Railway dashboard → Settings → Variables, set:

**Frontend Variables (exposed to browser):**
```bash
VITE_GITHUB_CLIENT_ID=Ov23liwhb4UprzoZdurs
VITE_GITHUB_REDIRECT_URI=https://your-app-name.railway.app/oauth-callback.html
```

**Server-side Variables (secret, not exposed):**
```bash
GITHUB_CLIENT_ID=Ov23liwhb4UprzoZdurs
GITHUB_CLIENT_SECRET=897d103d7fd75ed9bcca64b04591d28029ec4531
```

### 3. Security Notes

✅ **Secure Setup:**
- Client secret never exposed to browser
- Serverless function handles token exchange
- Follows OAuth 2.0 best practices

❌ **What NOT to do:**
- Don't add `VITE_GITHUB_CLIENT_SECRET` to Railway variables
- Don't commit client secret to git
- Don't use client secret in frontend code

### 4. Deployment Steps

```bash
# Commit changes
git add .
git commit -m "Implement secure OAuth with server-side secrets"

# Deploy to Railway
git push railway main
```

### 5. Verification

After deployment:
1. Test OAuth flow - should work seamlessly
2. Check browser dev tools - no client secret should be visible
3. Check Railway logs - serverless function should handle token exchange

## How It Works

### Development
- Uses Vite proxy (`/api/github/*`)
- Client secret in `.env` (acceptable for dev)
- Direct token exchange with fallbacks

### Production
- Forces serverless function (`/api/github-oauth`)
- Client secret server-side only
- No CORS issues, no secret exposure

## Troubleshooting

### OAuth Not Working
- Check Railway environment variables are set correctly
- Verify serverless function is deployed
- Check GitHub OAuth app callback URL

### Secret Exposure
- Ensure no `VITE_GITHUB_CLIENT_SECRET` in production
- Check browser dev tools for any leaked secrets
- Verify Railway variables don't have `VITE_` prefix

This setup ensures your GitHub OAuth is production-ready and secure!
