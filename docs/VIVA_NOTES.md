# Viva notes (Section B, 15 marks)

Short answers tied to **this project**. Practise saying them out loud.

---

## 1. AWS EC2, Load Balancing and Auto Scaling (3 marks)

**What is EC2?** A virtual server in AWS. You choose the AMI (OS image, here Amazon Linux 2023), the instance type (CPU/RAM, here t2.micro), the key pair (SSH), the security group (firewall) and the user data (startup script).

**What is a Load Balancer? Which one did you use?** It spreads incoming traffic across several servers, so no single server is overloaded and one can fail without downtime. I used an **Application Load Balancer (ALB)**. It works at **Layer 7 (HTTP)** and can route by path or host. A **Network LB** works at Layer 4 (TCP/UDP) and is used for very high performance; the **Classic LB** is the old one.

**Listener / target group?** The **listener** is the port the ALB listens on (HTTP 80). It forwards to a **target group**, which is the list of EC2 instances that receive traffic.

**Health check?** Every 15 s the ALB calls `GET /api/health` on each instance. My endpoint runs `SELECT 1` on MySQL, so it returns 200 only when the whole stack works. Unhealthy targets get no traffic.

**What is an Auto Scaling Group?** It keeps a set number of EC2 instances running from a **launch template**:
- **Min 2 / Desired 2 / Max 4** in my setup
- **Self-healing:** if an instance dies or fails health checks, the ASG replaces it. I demonstrated this by terminating one.
- **Scaling policy:** target tracking at **average CPU 50%**. Above that it adds instances (scale out); below it removes them (scale in).

**Launch template?** A saved instance configuration (AMI, type, SG, key, user data) that the ASG uses for every new instance.

**User data?** A script that runs once on first boot. Mine installs Docker and Compose, clones the GitHub repo, writes `.env` and runs `docker compose up -d --build`. So every new instance configures itself with no manual work.

**Why 2 Availability Zones?** An AZ is a separate data centre. Spreading across AZs means the app survives a data-centre failure (**high availability**).

**Security groups?** Stateful virtual firewalls. The ALB SG allows port 80 from the internet. The EC2 SG allows port 80 **only from the ALB's SG**, plus SSH from my IP, so users can't bypass the ALB.

**Grace period?** 300 s. It gives a new instance time to install Docker and build images before health checks can mark it unhealthy.

**How do you prove load balancing?** The `/api/info` endpoint returns the **instance ID**, read from EC2 instance metadata. A curl loop shows two different instance IDs.

**Sticky sessions: why?** Each instance runs its **own** MySQL container, so the data isn't shared. Stickiness (an ALB cookie) keeps a user on the same instance. **In production** I'd move the DB to **Amazon RDS** so every instance shares one database, and turn stickiness off. The JWT secret is the same on all instances, so a token is valid everywhere.

**Vertical vs horizontal scaling?** Vertical means a bigger instance (more CPU/RAM). Horizontal means more instances, which is what the ASG does.

---

## 2. Linux commands and file permissions (2 marks)

| Command | Meaning |
|---|---|
| `pwd`, `ls -l`, `cd` | where am I, long listing, change dir |
| `mkdir -p a/b` | create directory (and parents) |
| `touch f` | create empty file / update timestamp |
| `cat`, `less`, `tail -f` | view file / follow a log |
| `cp`, `mv`, `rm -r` | copy, move/rename, delete |
| `chmod`, `chown`, `chgrp` | change permissions / owner / group |
| `sudo` | run as root |
| `df -h`, `free -m`, `top`, `ps aux` | disk, memory, processes |
| `grep`, `find` | search text / files |
| `systemctl status docker` | manage services |
| `usermod -aG docker ec2-user` | add user to docker group |

**Reading `-rwxr-xr--`:** the first character is the type (`-` file, `d` dir). Then come 3 groups: **owner** `rwx`, **group** `r-x`, **others** `r--`.

**Numeric:** r=4, w=2, x=1. So `755` = rwxr-xr-x (scripts, dirs), `644` = rw-r--r-- (normal files), `600` = rw------- (secrets; my `.env` on EC2 is 600), `700` = private dir.

**Symbolic:** `chmod u+x file`, `chmod g-w,o-r file`, `chmod +x deploy.sh`.

**x on a directory** means you can `cd` into it. **r on a directory** means you can list it.

**umask** is the default permission mask (usually `022`, which gives files 644 and dirs 755).

---

## 3. Docker images, Dockerfile and containers (3 marks)

**Image vs container:** an **image** is a read-only template (like a class). A **container** is a running instance of an image (like an object). One image can run many containers.

**Docker vs VM:** containers share the host OS kernel, so they're lightweight and start in seconds. VMs each have a full guest OS.

**My Dockerfiles:** I built 2 custom images.
- `backend/Dockerfile` → `taskflow-api:1.0`
  - `FROM node:20-alpine`: small base image
  - **Multi-stage build:** stage 1 runs `npm ci --omit=dev`, stage 2 copies only `node_modules` and the source. This gives a smaller, cleaner image.
  - `WORKDIR`, `COPY`, `ENV NODE_ENV=production`
  - `USER node`: runs as **non-root**, for security
  - `EXPOSE 3000`: documents the port
  - `HEALTHCHECK`: Docker checks `/api/health` itself
  - `CMD ["node","src/server.js"]`: the start command
- `nginx/Dockerfile` → `taskflow-web:1.0`: nginx:alpine with my config and front-end files.

**Instruction differences:**
- `CMD` vs `ENTRYPOINT`: CMD is the default command and can be overridden. ENTRYPOINT is the fixed executable.
- `COPY` vs `ADD`: ADD can also extract tar files and download URLs. COPY is preferred.
- `RUN` runs at **build** time. `CMD` runs at **container start**.

**Layers and cache:** each instruction creates a layer. I copy `package*.json` and run `npm ci` **before** copying the source, so dependencies stay cached when only the code changes.

**`.dockerignore`** keeps `node_modules` and `.env` out of the build context.

**Commands:** `docker build -t name:tag .`, `docker images`, `docker run -d -p 8080:80 --name x image`, `docker ps -a`, `docker logs`, `docker exec -it x sh`, `docker stop/rm`, `docker rmi`.

**Port mapping `-p 80:3000`:** host port 80 maps to container port 3000.

---

## 4. Docker volumes and data persistence (2 marks)

**Problem:** a container's filesystem is deleted when the container is removed.

**Named volume:** storage managed by Docker at `/var/lib/docker/volumes/...`. My `mysql_data` volume is mounted at `/var/lib/mysql`, so the DB files live outside the container.

**Demo (`scripts/volume-demo.sh`):** insert a row → `docker compose down` (all containers removed) → `docker compose up` (a new DB container with a new ID) → the row is still there.

**Types of mounts:**
- **Named volume:** Docker-managed, best for DB data (`mysql_data`).
- **Bind mount:** a host folder or file mapped in. I bind-mount `./db/init.sql` read-only into `/docker-entrypoint-initdb.d/`.
- **tmpfs:** stored in memory only.

**`docker compose down -v`** also deletes volumes, which loses the data.

**`init.sql`** runs only when the volume is **empty** (first start).

Commands: `docker volume ls`, `docker volume inspect taskflow_mysql_data`, `docker volume rm`.

---

## 5. Docker Compose and multi-container communication (3 marks)

**What is Compose?** A tool that defines and runs multi-container apps from one YAML file. `docker compose up -d` starts everything.

**My 3 services:**
1. `nginx`: the only service with a **published port** (80). It serves the front end and reverse-proxies `/api/` to `api:3000`.
2. `api`: Node.js, **not published to the host**, reachable only inside the network (more secure).
3. `db`: MySQL 8 with the named volume and a healthcheck.

**How do containers talk?** They're all on the custom bridge network `appnet`. Docker's **built-in DNS** resolves the **service name** to the container IP. So the API connects to host `db`, and nginx proxies to `api:3000`. No hard-coded IPs.

**`depends_on` with `condition: service_healthy`:** `api` starts only after MySQL passes its healthcheck, and `nginx` only after `api` is healthy. That gives the correct startup order. The API also retries the DB connection.

**`restart: unless-stopped`:** restarts containers after a crash or reboot.

**Environment variables** come from `.env` (`${DB_PASSWORD}`), so secrets aren't hard-coded and `.env` is git-ignored.

**Commands:** `docker compose up -d --build`, `ps`, `logs -f api`, `exec db mysql ...`, `down`, `down -v`, `build`.

**Reverse proxy, why?** One entry point on port 80, the front end and API share the same origin (no CORS issues), static files are served fast, and the API is hidden.

---

## 6. Selenium testing and test execution (2 marks)

**What is Selenium WebDriver?** A tool that controls a real browser (Chrome) from code to automate **end-to-end UI tests**. WebDriver talks to `chromedriver`, which drives Chrome. Selenium 4's **Selenium Manager** downloads the driver automatically.

**My test (`tests/selenium_test.py`, Python `unittest`, 10 tests in order):**
1. Open the home page and verify the title, `#app-title` and the login form
2. Register a new user
3. Logout, check a wrong password shows the error, then log in correctly
4. Create a task (fill the form, select a priority, click Add)
5. **Verify the web element:** the task `<li>` shows with the high priority and pending status
6. Mark it done, then filter by Done
7. Dashboard shows total 1, done 1, 100%
8. Server Info shows the server name and that the DB is connected
9. Delete the task and accept the JS `confirm()` alert
10. Logout and check that a protected page redirects to login

**Locators used:** `By.ID` (most reliable), `By.CLASS_NAME` and `By.XPATH`. Others: NAME, CSS_SELECTOR, LINK_TEXT, TAG_NAME.

**Waits:** I use **explicit waits** (`WebDriverWait` + `expected_conditions`, e.g. `visibility_of_element_located`, `url_contains`, `alert_is_present`) because the page loads data with fetch. An **implicit wait** is a global timeout. `time.sleep` is bad practice.

**Assertions:** `assertIn`, `assertEqual`, `assertTrue`. A failed assertion means a failed test.

**Headless mode:** runs Chrome without a window (`--headless=new`), which is good for CI. Use `--headed` to watch it.

**Evidence:** a screenshot for each step in `tests/screenshots/`, and the console prints `10/10 passed -> PASS`.

**How do you run it against AWS?** `python tests/selenium_test.py http://<ALB-DNS>`. The request goes through the Load Balancer to an instance.

---

## Likely follow-up questions
- *What happens if one EC2 instance crashes?* The ALB health check fails, so traffic goes only to the healthy instance, and the ASG launches a replacement.
- *Why is the API port not published?* Least exposure: only nginx is public; the API and DB are internal.
- *Where are secrets?* In `.env` (chmod 600, git-ignored). In production I'd use AWS **SSM Parameter Store** or **Secrets Manager**.
- *How would you improve this?* RDS for a shared DB; push images to **ECR** instead of building on every instance; HTTPS with ACM on the ALB; a CI/CD pipeline (GitHub Actions) that runs Selenium on each push; CloudWatch alarms.
- *Difference between `docker compose stop` and `down`?* `stop` only stops containers. `down` removes the containers and network (volumes are kept unless `-v`).
