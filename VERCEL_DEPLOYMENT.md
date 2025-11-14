# Vercel Deployment Guide

## Prerequisites

1. **Vercel Account**: Sign up at [vercel.com](https://vercel.com)
2. **GitHub Repository**: Your code should be in a GitHub repository
3. **Environment Variables**: Prepare your production environment variables

## Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click "New Project"
3. Import your GitHub repository
4. Vercel will auto-detect it as a Node.js project

## Step 2: Configure Environment Variables

In your Vercel project settings, add these environment variables:

```
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=https://your-vercel-domain.vercel.app/auth/google/callback
SESSION_SECRET=your_session_secret
DATABASE_URL=your_postgres_connection_string
REDIS_URL=your_redis_connection_string
ALLOWED_GOOGLE_DOMAIN=ucsd.edu
LOGIN_FAILURE_THRESHOLD=3
LOGIN_FAILURE_WINDOW_MINUTES=15
NODE_ENV=production
VERCEL=true
```

## Step 3: Database Setup

Since Vercel is serverless, you'll need external database services:

### PostgreSQL Options:
- **Vercel Postgres** (recommended): Built-in PostgreSQL service
- **Supabase**: Free tier available
- **Railway**: PostgreSQL hosting
- **AWS RDS**: Production-grade option

### Redis Options:
- **Upstash Redis**: Serverless Redis (recommended for Vercel)
- **Redis Cloud**: Managed Redis service
- **Railway Redis**: Simple Redis hosting

## Step 4: Update Google OAuth Settings

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Navigate to APIs & Services > Credentials
3. Edit your OAuth 2.0 Client ID
4. Add your Vercel domain to authorized redirect URIs:
   - `https://your-project-name.vercel.app/auth/google/callback`

## Step 5: GitHub Secrets for CI/CD

Add these secrets to your GitHub repository (Settings > Secrets and variables > Actions):

```
VERCEL_TOKEN=your_vercel_token
VERCEL_ORG_ID=your_vercel_org_id
VERCEL_PROJECT_ID=your_vercel_project_id
SLACK_BOT_TOKEN=your_slack_bot_token
SLACK_CHANNEL_ID=your_slack_channel_id
```

### Getting Vercel Tokens:

1. **VERCEL_TOKEN**: 
   - Go to Vercel Dashboard > Settings > Tokens
   - Create a new token

2. **VERCEL_ORG_ID** and **VERCEL_PROJECT_ID**:
   - Install Vercel CLI: `npm i -g vercel`
   - Run `vercel link` in your project directory
   - Check `.vercel/project.json` for the IDs

## Step 6: Deploy

### Automatic Deployment:
- Push to `main` branch triggers production deployment
- Pull requests trigger preview deployments

### Manual Deployment:
```bash
npm install -g vercel
vercel --prod
```

## Troubleshooting

### Common Issues:

1. **Database Connection Errors**:
   - Ensure DATABASE_URL is correctly formatted
   - Check if your database allows connections from Vercel IPs

2. **Redis Connection Issues**:
   - Use a serverless Redis provider like Upstash
   - Ensure REDIS_URL includes authentication

3. **OAuth Redirect Errors**:
   - Verify Google OAuth callback URL matches your Vercel domain
   - Check GOOGLE_CALLBACK_URL environment variable

4. **Static Files Not Loading**:
   - Ensure static files are in `src/public` and `src/views`
   - Vercel automatically serves static files

### Logs and Debugging:
- View deployment logs in Vercel Dashboard
- Use `vercel logs` CLI command for runtime logs
- Check GitHub Actions for CI/CD pipeline issues

## Production Checklist

- [ ] Environment variables configured
- [ ] Database and Redis services set up
- [ ] Google OAuth callback URLs updated
- [ ] GitHub secrets configured
- [ ] SSL certificate (automatic with Vercel)
- [ ] Custom domain configured (optional)
- [ ] Monitoring and alerts set up

## Custom Domain (Optional)

1. Go to Vercel project settings
2. Navigate to "Domains"
3. Add your custom domain
4. Update DNS records as instructed
5. Update Google OAuth callback URLs to use custom domain
