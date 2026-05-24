# AWS Deployment Guide

A walkthrough of four common AWS deployment paths, what they're for, and how to set each one up step by step. Pick the one that matches your app shape.

## Quick comparison

| Option | Best for | Cost (low traffic) | Cold starts | Ops burden |
|---|---|---|---|---|
| **S3 + CloudFront** | Static sites, SPAs, Astro/Hugo/Next-static | ~$1–5/mo | None | Lowest |
| **EC2** | Long-running servers, full control | ~$5–20/mo | None (always on) | Highest — you patch the OS |
| **ECS Fargate** | Dockerized apps, microservices | ~$10–30/mo | None | Medium |
| **Lambda + API Gateway** | Bursty APIs, event-driven, infrequent traffic | $0 → pay-per-request | Yes (~100ms–2s) | Low |

**Rule of thumb:**
- Pure frontend → **S3 + CloudFront**
- One backend service, you want a server you can SSH into → **EC2**
- Containerized app, want managed scaling → **ECS Fargate**
- Sporadic traffic, want to pay nothing when idle → **Lambda**

---

## Prerequisites (all options)

1. AWS account with billing enabled
2. AWS CLI installed and configured:
   ```bash
   brew install awscli
   aws configure
   # Enter Access Key ID, Secret Access Key, region (e.g. us-east-1)
   ```
3. An IAM user with programmatic access (not root). Attach `AdministratorAccess` for learning; tighten later.

---

## Option 1: Static site — S3 + CloudFront

For built static output (`dist/`, `build/`, `public/`). This guide assumes an Astro/Vite/Next-static build.

### Step 1 — Build locally
```bash
npm run build
# verify dist/ has index.html
```

### Step 2 — Create an S3 bucket
```bash
aws s3 mb s3://your-site-name --region us-east-1
```
Bucket names are globally unique. Use your domain (e.g. `michaellei.com`) if you own it.

### Step 3 — Enable static website hosting
```bash
aws s3 website s3://your-site-name \
  --index-document index.html \
  --error-document 404.html
```

### Step 4 — Upload your build
```bash
aws s3 sync dist/ s3://your-site-name --delete
```

### Step 5 — Block public access, serve via CloudFront
Don't expose the bucket directly. Create a CloudFront distribution with **Origin Access Control (OAC)**:

1. AWS Console → CloudFront → Create distribution
2. Origin domain: pick your S3 bucket (use the REST endpoint, not the website endpoint)
3. Origin access: **Origin access control settings (recommended)** → create new OAC
4. Viewer protocol policy: **Redirect HTTP to HTTPS**
5. Default root object: `index.html`
6. Create distribution. CloudFront will give you a bucket policy snippet — paste it into the bucket's permissions tab.

### Step 6 — Custom domain (optional)
1. Request a cert in **ACM us-east-1** (CloudFront only reads certs from us-east-1)
2. Validate via DNS (add the CNAME record ACM gives you to Route 53 or your DNS provider)
3. In CloudFront, add the domain as an Alternate Domain Name (CNAME) and attach the cert
4. Point your domain at the CloudFront distribution (Route 53 alias record, or CNAME elsewhere)

### Step 7 — Redeploy script
```bash
aws s3 sync dist/ s3://your-site-name --delete
aws cloudfront create-invalidation --distribution-id ABC123 --paths "/*"
```

---

## Option 2: EC2 (Node/Next.js server)

For when you want a real Linux box running your server process. More work, more control.

### Step 1 — Launch an instance
1. EC2 console → Launch instance
2. AMI: **Amazon Linux 2023** or **Ubuntu 22.04**
3. Type: `t3.micro` (free tier) or `t3.small`
4. Key pair: create one, download the `.pem` file, `chmod 400 key.pem`
5. Security group: allow inbound `22` (SSH, your IP only), `80`, `443`
6. Launch

### Step 2 — SSH in and install runtime
```bash
ssh -i key.pem ec2-user@<public-ip>
# Install Node
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs git
```

### Step 3 — Pull and run your app
```bash
git clone https://github.com/you/your-app.git
cd your-app
npm ci
npm run build
```

### Step 4 — Keep it running with PM2
```bash
sudo npm i -g pm2
pm2 start npm --name app -- start
pm2 startup    # follow the printed command to enable on boot
pm2 save
```

### Step 5 — Put nginx in front (TLS + port 80/443)
```bash
sudo yum install -y nginx
sudo systemctl enable --now nginx
```
Edit `/etc/nginx/conf.d/app.conf`:
```nginx
server {
  listen 80;
  server_name your-domain.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }
}
```
```bash
sudo nginx -t && sudo systemctl reload nginx
```

### Step 6 — TLS with Let's Encrypt
```bash
sudo yum install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Step 7 — Point DNS
A record → EC2 public IP. Allocate an **Elastic IP** and associate it so the IP doesn't change on reboot.

### Step 8 — Deploys
SSH in, `git pull && npm ci && npm run build && pm2 restart app`. Or set up a GitHub Actions workflow that SSHes in and runs the same.

---

## Option 3: Containerized — ECS Fargate

For Docker containers without managing servers. AWS runs the container; you provide the image.

### Step 1 — Dockerize
`Dockerfile`:
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```
```bash
docker build -t my-app .
docker run -p 3000:3000 my-app   # test locally
```

### Step 2 — Push to ECR
```bash
aws ecr create-repository --repository-name my-app
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com

docker tag my-app:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/my-app:latest
```

### Step 3 — Create ECS cluster
```bash
aws ecs create-cluster --cluster-name my-cluster
```

### Step 4 — Define the task
ECS console → Task definitions → Create new (Fargate). Set:
- CPU: 0.25 vCPU, Memory: 0.5 GB (smallest)
- Container: ECR image URI, port 3000
- Task role: create one with CloudWatch Logs permissions

### Step 5 — Create the service
ECS console → Clusters → my-cluster → Create service:
- Launch type: Fargate
- Task definition: the one you just made
- Desired tasks: 1
- VPC: default VPC, public subnets, **enable public IP**
- Security group: allow inbound 3000 (or 80 if you add a load balancer)

### Step 6 — Load balancer + HTTPS (production)
- Create an Application Load Balancer in front of the service
- Target group: IP type, port 3000, health check `/`
- Listener: 443 with an ACM cert, forward to target group
- Route 53 alias record → ALB DNS name

### Step 7 — Deploys
```bash
docker build -t my-app . && docker tag ... && docker push ...
aws ecs update-service --cluster my-cluster --service my-service --force-new-deployment
```

---

## Option 4: Serverless — Lambda + API Gateway

For APIs that idle most of the time. Pay per request; scales automatically.

### Step 1 — Write the handler
`index.mjs`:
```js
export const handler = async (event) => {
  return {
    statusCode: 200,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "hello from lambda" }),
  };
};
```

### Step 2 — Package and deploy
```bash
zip function.zip index.mjs
aws lambda create-function \
  --function-name my-api \
  --runtime nodejs20.x \
  --handler index.handler \
  --role arn:aws:iam::<account-id>:role/lambda-basic-execution \
  --zip-file fileb://function.zip
```
(Create the `lambda-basic-execution` role first with the `AWSLambdaBasicExecutionRole` managed policy.)

### Step 3 — Front it with API Gateway
1. API Gateway console → Create API → **HTTP API** (simpler/cheaper than REST API)
2. Integration: Lambda → pick `my-api`
3. Route: `ANY /{proxy+}`
4. Deploy → note the invoke URL

### Step 4 — Custom domain (optional)
1. ACM cert in your region (HTTP API reads from any region, not just us-east-1)
2. API Gateway → Custom domain names → Add domain, attach cert
3. Map your API stage to it
4. Route 53 alias record → the API Gateway domain

### Step 5 — Updates
```bash
zip function.zip index.mjs
aws lambda update-function-code --function-name my-api --zip-file fileb://function.zip
```

### Step 6 — Use a framework (recommended past prototype stage)
Hand-rolling Lambda gets old. Pick one:
- **AWS SAM** — `sam init`, `sam deploy --guided`. Native AWS.
- **Serverless Framework** — `serverless create`, `serverless deploy`. Cross-cloud.
- **SST** — TypeScript-first, good DX for full-stack apps.

---

## Things that bite people

- **CloudFront caching during dev** — invalidate `/*` after every deploy, or set short TTLs on HTML
- **us-east-1 cert requirement for CloudFront** — even if your bucket is elsewhere
- **EC2 security groups too permissive** — `0.0.0.0/0` on port 22 is a magnet for bots. Restrict SSH to your IP.
- **Lambda cold starts on Node** — usually fine; if not, enable provisioned concurrency or switch to a smaller runtime
- **ECS task can't pull from ECR** — task execution role needs `AmazonECSTaskExecutionRolePolicy`
- **Forgetting an Elastic IP on EC2** — public IP changes on stop/start; allocate and associate one

## Cost-watching

- Set up a **billing alarm** in CloudWatch (e.g. alert at $10) before doing anything else
- Tag every resource with `project=<name>` so you can filter in Cost Explorer
- Delete unused things — old EBS volumes, NAT gateways, idle load balancers, and Elastic IPs not attached to a running instance all cost money 24/7
