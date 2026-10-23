# TaskFlow: a Dockerized multi-user task manager on AWS

**Course:** CSC418 DevOps for Cloud Computing, Lab Mid Exam (COMSATS Lahore)

TaskFlow is a full-stack web app (front end, back end and database). It runs as **3 Docker containers** with Docker Compose on **2+ AWS EC2 instances**. Those instances sit behind an **Application Load Balancer** and are managed by an **Auto Scaling Group**. The app is tested end-to-end with **Selenium WebDriver**.

```
                User / Browser / Selenium
                          │  HTTP :80
                ┌─────────▼──────────┐
                │ AWS Application LB │  health check → /api/health
                └─────────┬──────────┘
          ┌───────────────┴───────────────┐       Auto Scaling Group
   ┌──────▼─────── EC2 (AZ-a) ───┐  ┌──────▼─────── EC2 (AZ-b) ───┐   (min 2, max 4)
   │ docker compose              │  │ docker compose              │
   │  nginx :80 ──► api :3000    │  │  nginx :80 ──► api :3000    │
   │                  │          │  │                  │          │
   │               db (MySQL)    │  │               db (MySQL)    │
   │      volume: mysql_data     │  │      volume: mysql_data     │
   └─────────────────────────────┘  └─────────────────────────────┘
```

## Features
- Register and log in (bcrypt-hashed passwords, JWT in an httpOnly cookie). Each user has private tasks.
- Task create, read, update and delete, with priority, category, due date, and status (pending or done)
- Search, filters (status, priority, category, overdue) and sorting
- Dashboard with totals, completion %, progress by category and priority, and upcoming deadlines
- **Server Info** page showing which EC2 instance and container served the request, which proves load balancing
- `/api/health` endpoint used by the Docker HEALTHCHECK and the ALB target group

## Project structure
| Path | What it is |
|---|---|
| `backend/` | Node.js + Express REST API, plus its `Dockerfile` (multi-stage, non-root, healthcheck) |
| `frontend/` | HTML, CSS and JS pages: login, tasks, dashboard, server info |
| `nginx/` | Reverse proxy config and `Dockerfile` (serves the front end and proxies `/api` to the API) |
| `db/init.sql` | Schema plus demo data, auto-loaded on first start |
| `docker-compose.yml` | 3 services, a named volume `mysql_data`, network `appnet`, healthchecks |
| `aws/user-data.sh` | EC2 bootstrap: installs Docker and runs the stack |
| `scripts/linux-admin.sh` | Task 2: Linux commands and permissions demo |
| `scripts/volume-demo.sh` | Task 4: volume persistence demo |
| `tests/selenium_test.py` | Task 6: 10-step Selenium E2E test suite |
| `docs/VIVA_NOTES.md` | Viva preparation notes |

## API
| Method | Endpoint | Auth | Purpose |
|---|---|---|---|
| GET | `/api/health` | – | Health check (DB ping) |
| GET | `/api/info` | – | Server / container / DB info |
| POST | `/api/auth/register`, `/api/auth/login`, `/api/auth/logout` | – | Accounts |
| GET | `/api/auth/me` | ✔ | Current user |
| GET | `/api/tasks?search=&status=&priority=&category=&sort=` | ✔ | List/filter tasks |
| POST / PUT / DELETE | `/api/tasks`, `/api/tasks/:id` | ✔ | Create / update / delete |
| PATCH | `/api/tasks/:id/status` | ✔ | Mark done/pending |
| GET | `/api/tasks/categories`, `/api/stats` | ✔ | Categories, dashboard stats |

Demo login: **demo / demo123**

---

## 1. Run locally (Docker Desktop)
```bash
cp .env.example .env            # then edit the passwords
docker compose up -d --build    # build 2 custom images + start 3 containers
docker compose ps               # all should be (healthy)
```
Open http://localhost.

Useful commands:
```bash
docker images | grep taskflow           # custom images: taskflow-api, taskflow-web
docker compose logs -f api              # API request logs
docker network inspect taskflow_appnet  # containers on the same network
docker compose down                     # stop (data kept)
docker compose down -v                  # stop AND delete the volume (data lost)
```

### Task 3: build and run a single image by hand (evidence)
```bash
docker build -t taskflow-api:manual ./backend
docker images taskflow-api
docker run -d --name api-manual --network taskflow_appnet --env-file .env -e DB_HOST=db -p 3001:3000 taskflow-api:manual
curl http://localhost:3001/api/health
docker rm -f api-manual
```

### Selenium (local)
```bash
pip install -r tests/requirements.txt
python tests/selenium_test.py http://localhost            # headless
python tests/selenium_test.py http://localhost --headed   # watch the browser
```

---

## 2. Push to GitHub
```bash
git remote add origin https://github.com/<you>/taskflow-devops.git
git push -u origin main
```
Then edit `REPO_URL` (and the passwords) at the top of `aws/user-data.sh`. The repo must be **public** so EC2 can clone it.

---

## 3. Deploy on AWS (Console steps)
Use one region, e.g. **us-east-1**, and the **default VPC**.

### 3.1 Security groups (EC2 → Security Groups → Create)
| Name | Inbound rules |
|---|---|
| `taskflow-alb-sg` | HTTP 80 from `0.0.0.0/0` |
| `taskflow-ec2-sg` | HTTP 80 from **source = taskflow-alb-sg** · SSH 22 from **My IP** |

### 3.2 Key pair
EC2 → Key Pairs → Create `taskflow-key` (.pem). You'll use it for SSH.

### 3.3 Launch template (EC2 → Launch Templates → Create)
- Name: `taskflow-lt`. Tick **"Provide guidance for Auto Scaling"**.
- AMI: **Amazon Linux 2023** (64-bit x86)
- Instance type: `t2.micro` or `t3.micro`
- Key pair: `taskflow-key`
- Security group: `taskflow-ec2-sg`
- Advanced details → Metadata version: **V2 only (token required)**
- Advanced details → **User data**: paste the whole of `aws/user-data.sh`, with `REPO_URL` edited

### 3.4 Target group (EC2 → Target Groups → Create)
- Type: **Instances**. Name: `taskflow-tg`. Protocol HTTP, port **80**, default VPC
- Health check path: **`/api/health`**. Advanced: healthy threshold 2, interval 15s
- Don't register any targets (the ASG will do it), then click Create
- After creating: **Attributes → Edit → turn on Stickiness** (load balancer generated cookie, 1 day).
  Each instance has its own DB container, so stickiness keeps a logged-in user on one instance.

### 3.5 Application Load Balancer (EC2 → Load Balancers → Create → ALB)
- Name: `taskflow-alb`. Internet-facing, IPv4
- Network mapping: default VPC; tick **at least 2 Availability Zones**
- Security group: `taskflow-alb-sg` (remove `default`)
- Listener HTTP:80 → forward to `taskflow-tg`
- Copy the **DNS name**, e.g. `taskflow-alb-123456.us-east-1.elb.amazonaws.com`

### 3.6 Auto Scaling Group (EC2 → Auto Scaling Groups → Create)
1. Name `taskflow-asg`, launch template `taskflow-lt` (Latest)
2. Network: default VPC, select the **same 2+ AZ subnets**
3. Load balancing: **Attach to an existing load balancer** → target group `taskflow-tg`
   - Tick **Turn on Elastic Load Balancing health checks**, with a grace period of **300 s**
4. Group size: **Desired 2, Min 2, Max 4**
5. Scaling: **Target tracking policy**, Average CPU utilization **50%**
6. Add tag `Name = taskflow-instance`, then Create

Wait about 5 minutes. Check **Target Groups → taskflow-tg → Targets**: both should show **healthy**.
Then open `http://<ALB-DNS>` in the browser.

### 3.7 Demonstrate load balancing
Each request without a cookie can go to a different instance:
```powershell
# PowerShell
1..8 | % { (Invoke-RestMethod http://<ALB-DNS>/api/info).serverName }
```
```bash
# bash
for i in $(seq 8); do curl -s http://<ALB-DNS>/api/info | grep -o '"serverName":"[^"]*"'; done
```
You should see two different instance IDs. You can also open the **Server Info** page in two different private windows.

### 3.8 Demonstrate auto scaling
- **Self-healing:** EC2 → Instances → **terminate one** taskflow instance → watch **ASG → Activity**: it launches a replacement and the target group registers it.
- **Scale out:** ASG → Edit → Desired **3** → a 3rd instance appears (then set it back to 2).
- (Optional CPU load: SSH in and run `sudo dnf install -y stress-ng && stress-ng --cpu 2 --timeout 600`.)

### 3.9 SSH into an instance (Tasks 2, 3, 4 evidence)
```bash
ssh -i taskflow-key.pem ec2-user@<instance-public-ip>
sudo tail -n 30 /var/log/taskflow-bootstrap.log
cd /opt/taskflow
docker ps && docker images && docker volume ls
bash scripts/linux-admin.sh | tee ~/linux-admin-output.txt
bash scripts/volume-demo.sh | tee ~/volume-demo-output.txt
```

### 3.10 Selenium against the Load Balancer
```bash
python tests/selenium_test.py http://<ALB-DNS>
```

### 3.11 Clean up after grading (to avoid charges)
Delete in this order: **ASG** (terminates instances), **ALB**, **target group**, **launch template**, then the **security groups**.

---

## Evidence checklist (screenshots)
| # | Task (marks) | Screenshot |
|---|---|---|
| 1 | ALB & ASG (2) | ALB details + DNS; target group with 2 healthy targets; app opened via ALB DNS; curl loop showing 2 instance IDs; ASG Activity after terminating an instance |
| 2 | Linux (1) | Terminal output of `linux-admin.sh` (mkdir, chmod, `ls -l`) |
| 3 | Docker images (2) | `Dockerfile`; `docker build`; `docker images`; `docker run` + `docker ps` |
| 4 | Volumes (1) | `volume-demo.sh` output ending in **DATA PERSISTED** |
| 5 | Compose (2) | `docker-compose.yml`; `docker compose ps` with 3 healthy containers; app in browser |
| 6 | Selenium (2) | Terminal showing **10/10 passed → PASS**, plus `tests/screenshots/` |
