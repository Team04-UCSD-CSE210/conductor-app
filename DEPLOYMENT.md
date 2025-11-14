# Deployment Guide: Vercel to AWS EC2 Migration

This guide covers migrating the Conductor App from Vercel to AWS EC2 using Docker containers.

## Prerequisites

- AWS Account with ECR and EC2 access
- Domain name (optional but recommended)
- GitHub repository secrets configured

## AWS Setup

### 1. Create ECR Repository

```bash
aws ecr create-repository --repository-name conductor-app --region us-west-2
```

### 2. Launch EC2 Instance

- Instance Type: t3.medium or larger
- AMI: Amazon Linux 2023
- Security Groups: Allow HTTP (80), HTTPS (443), SSH (22)
- Key Pair: Create or use existing

### 3. Setup EC2 Instance

```bash
# SSH into your EC2 instance
ssh -i your-key.pem ec2-user@your-ec2-ip

# Run setup script
curl -sSL https://raw.githubusercontent.com/your-repo/conductor-app/main/scripts/setup-ec2.sh | bash
```

### 4. Configure Environment Variables

Edit `/home/ec2-user/.env.production`:

```bash
GOOGLE_CLIENT_ID=your-actual-client-id
GOOGLE_CLIENT_SECRET=your-actual-client-secret
GOOGLE_CALLBACK_URL=https://your-domain.com/auth/google/callback
SESSION_SECRET=your-secure-session-secret
DATABASE_URL=postgres://conductor:conductor_password@localhost:5432/conductor
REDIS_URL=redis://localhost:6379
ALLOWED_GOOGLE_DOMAIN=ucsd.edu
LOGIN_FAILURE_THRESHOLD=3
LOGIN_FAILURE_WINDOW_MINUTES=15
PORT=8080
```

## GitHub Secrets Configuration

Add these secrets to your GitHub repository:

```
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
ECR_REGISTRY=your-account-id.dkr.ecr.us-west-2.amazonaws.com
EC2_HOST=your-ec2-public-ip
EC2_USER=ec2-user
EC2_SSH_KEY=your-private-key-content
SLACK_CHANNEL_ID=your-slack-channel-id
SLACK_BOT_TOKEN=your-slack-bot-token
```

## Local Development with Docker

### Build and Run Locally

```bash
# Build the Docker image
docker build -t conductor-app .

# Run with docker-compose (includes PostgreSQL and Redis)
docker-compose up -d

# Access the application
open http://localhost:8080
```

### Test the Application

```bash
# Run tests in Docker
docker run --rm conductor-app npm test

# Run linting
docker run --rm conductor-app npm run lint
```

## Deployment Process

### Automatic Deployment (Recommended)

1. Push to `main` branch
2. GitHub Actions will:
   - Run tests and linting
   - Build Docker image
   - Push to ECR
   - Deploy to EC2
   - Send Slack notification

### Manual Deployment

```bash
# Build and push to ECR
aws ecr get-login-password --region us-west-2 | docker login --username AWS --password-stdin your-account-id.dkr.ecr.us-west-2.amazonaws.com
docker build -t conductor-app .
docker tag conductor-app:latest your-account-id.dkr.ecr.us-west-2.amazonaws.com/conductor-app:latest
docker push your-account-id.dkr.ecr.us-west-2.amazonaws.com/conductor-app:latest

# Deploy to EC2
ssh -i your-key.pem ec2-user@your-ec2-ip 'bash -s' < scripts/deploy-ec2.sh
```

## SSL/HTTPS Setup (Optional)

### Using Let's Encrypt with Nginx

```bash
# Install Nginx and Certbot
sudo yum install -y nginx certbot python3-certbot-nginx

# Configure Nginx reverse proxy
sudo tee /etc/nginx/conf.d/conductor-app.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Start Nginx
sudo systemctl start nginx
sudo systemctl enable nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com
```

## Monitoring and Maintenance

### Health Checks

```bash
# Check application status
curl -f http://your-domain.com/login

# Check Docker container
docker ps | grep conductor-app

# View logs
docker logs conductor-app
```

### Database Backup

```bash
# Backup PostgreSQL
pg_dump -h localhost -U conductor conductor > backup_$(date +%Y%m%d).sql

# Restore from backup
psql -h localhost -U conductor conductor < backup_20231201.sql
```

## Troubleshooting

### Common Issues

1. **Container won't start**: Check environment variables and logs
2. **Database connection failed**: Verify PostgreSQL is running and credentials
3. **OAuth errors**: Update Google OAuth callback URL to your domain
4. **Port conflicts**: Ensure port 8080 is available

### Useful Commands

```bash
# View application logs
docker logs -f conductor-app

# Restart application
docker restart conductor-app

# Check system resources
htop
df -h

# Test database connection
psql -h localhost -U conductor conductor -c "SELECT 1;"
```

## Rollback Procedure

```bash
# Rollback to previous image
docker pull your-account-id.dkr.ecr.us-west-2.amazonaws.com/conductor-app:previous-tag
docker stop conductor-app
docker rm conductor-app
docker run -d --name conductor-app -p 80:8080 --env-file /home/ec2-user/.env.production your-account-id.dkr.ecr.us-west-2.amazonaws.com/conductor-app:previous-tag
```

## Performance Optimization

- Use Application Load Balancer for multiple instances
- Implement Redis clustering for session storage
- Use RDS for managed PostgreSQL
- Enable CloudWatch monitoring
- Configure auto-scaling groups