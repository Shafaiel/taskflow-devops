# What to do next: a simple step-by-step guide

Do the steps **in order**. Tick each box ✅ when it's done.
Put every screenshot in one folder, for example `Desktop\devops-screenshots`.

> **Where do I type commands?**
> In VS Code, open **Terminal → New Terminal** (this is PowerShell).
> First make sure you are in the project folder:
> ```powershell
> cd "C:\Users\shafa\Downloads\dev ops mid lab exam"
> ```

---

## ✅ PARTS 1-3: ALREADY DONE BY CLAUDE

You don't need to do these. Here is what was done:

**Part 1: Local evidence.** Everything is saved in the `evidence` folder:

| File | For task |
|---|---|
| `evidence/01_compose_up_and_ps.txt` | Task 5: Compose (3 healthy containers, network, volume) |
| `evidence/02_docker_build_images_run.txt` | Task 3: docker build, docker images, docker run |
| `evidence/03_linux_admin_LOCAL_PRACTICE.txt` | Task 2: practice run only (do the real one on EC2 in Part 6) |
| `evidence/04_volume_persistence.txt` | Task 4: ends with **DATA PERSISTED** |
| `evidence/06_selenium_local.txt` | Task 6: **10/10 PASS** |
| `evidence/app_1_login.png` … `app_5_health.png` | Screenshots of the app pages |
| `evidence/selenium_screenshots/` | Screenshots taken by the Selenium test |

> 💡 Teachers usually prefer real terminal screenshots. If you want them, run these yourself in the VS Code terminal and take a screenshot:
> `docker compose ps` · `docker images` · `python tests/selenium_test.py http://localhost --headed`

**Part 2: GitHub.** The code is live at **https://github.com/Shafaiel/taskflow-devops** (public).
After any code change, just run `git add -A`, then `git commit -m "message"`, then `git push`.

**Part 3: Startup script.** It's ready: **`aws/user-data.READY.sh`**
- It already has your GitHub URL and strong random passwords.
- It is **NOT** uploaded to GitHub (it holds secrets), so it exists only on your laptop.
- It was tested on a simulated Amazon Linux 2023 server: the app started and Selenium passed 10/10.

---

## PART 4: AWS setup (in the browser), about 30-40 min

Log in to the AWS Console. In the **top-right corner**, choose the region **N. Virginia (us-east-1)**.
In the search bar at the top, type **EC2** and open it.

### 4.1 Create 2 security groups (firewalls)
Left menu: **Network & Security → Security Groups → Create security group**

- [ ] **First one (for the Load Balancer)**
  - Name: `taskflow-alb-sg` · Description: `ALB`
  - Inbound rules → **Add rule** → Type **HTTP**, Source **Anywhere-IPv4**
  - Click **Create security group**

- [ ] **Second one (for the servers)**
  - Name: `taskflow-ec2-sg` · Description: `EC2`
  - Inbound rules:
    - **Add rule** → Type **HTTP**, Source **Custom**. In the box, type `taskflow-alb-sg` and pick it from the list.
    - **Add rule** → Type **SSH**, Source **Anywhere-IPv4** (only for this lab, so the browser terminal works)
  - Click **Create security group**

### 4.2 Create a key pair
Left menu: **Network & Security → Key Pairs → Create key pair**
- [ ] Name: `taskflow-key`, type RSA, format `.pem` → **Create**. It downloads; keep it safe.

### 4.3 Create the launch template (the "recipe" for each server)
Left menu: **Instances → Launch Templates → Create launch template**
- [ ] Name: `taskflow-lt`
- [ ] Tick ✅ **Provide guidance to help me set up a template that I can use with EC2 Auto Scaling**
- [ ] **Application and OS Images:** click **Quick Start** → **Amazon Linux** → choose **Amazon Linux 2023 AMI** (64-bit x86)
- [ ] **Instance type:** `t2.micro` (or `t3.micro`)
- [ ] **Key pair:** `taskflow-key`
- [ ] **Network settings → Security groups:** choose `taskflow-ec2-sg`
- [ ] Scroll down → open **Advanced details**
  - **Metadata version:** `V2 only (token required)`
  - **User data** (the big box at the bottom): open **`aws/user-data.READY.sh`** in VS Code → **Ctrl+A** → **Ctrl+C** → click in this box → **Ctrl+V**
- [ ] Click **Create launch template**

### 4.4 Create the target group (the list of servers for the Load Balancer)
Left menu: **Load Balancing → Target Groups → Create target group**
- [ ] Target type: **Instances**
- [ ] Name: `taskflow-tg` · Protocol **HTTP** · Port **80**
- [ ] **Health checks → Health check path:** `/api/health`
- [ ] Click **Next** → **don't select any instances** → **Create target group**
- [ ] Open `taskflow-tg` → **Attributes** tab → **Edit** → tick **Stickiness** → **Load balancer generated cookie**, duration **1 day** → **Save**

### 4.5 Create the Load Balancer
Left menu: **Load Balancing → Load Balancers → Create load balancer → Application Load Balancer → Create**
- [ ] Name: `taskflow-alb` · Scheme: **Internet-facing** · IPv4
- [ ] **Network mapping:** tick **at least 2 Availability Zones** (e.g. us-east-1a and us-east-1b)
- [ ] **Security groups:** remove `default` and choose `taskflow-alb-sg`
- [ ] **Listeners:** HTTP : 80 → Forward to **taskflow-tg**
- [ ] Click **Create load balancer**
- [ ] Open it and **copy the DNS name** (like `taskflow-alb-12345.us-east-1.elb.amazonaws.com`). Paste it into Notepad; you'll need it many times.

### 4.6 Create the Auto Scaling Group
Left menu: **Auto Scaling → Auto Scaling Groups → Create Auto Scaling group**
- [ ] **Step 1:** Name `taskflow-asg` · Launch template `taskflow-lt` → Next
- [ ] **Step 2:** VPC = default · Availability Zones: choose the **same 2 zones** as the Load Balancer → Next
- [ ] **Step 3:**
  - Choose **Attach to an existing load balancer**
  - **Choose from your load balancer target groups** → `taskflow-tg`
  - Tick ✅ **Turn on Elastic Load Balancing health checks**
  - Health check grace period: **600** seconds (10 min - the first boot builds the images)
  - → Next
- [ ] **Step 4:** Desired **2**, Min **2**, Max **4**
  - Scaling: **Target tracking scaling policy**, Metric **Average CPU utilization**, Target value **50**
  - → Next
- [ ] **Step 5 (notifications):** skip → Next
- [ ] **Step 6 (tags):** Add tag: Key `Name`, Value `taskflow-instance` → Next
- [ ] **Create Auto Scaling group**

### 4.7 Wait and check ⏳ (about 8-10 minutes)
- [ ] Go to **Target Groups → taskflow-tg → Targets** tab. Wait until **both** instances show **healthy** (click refresh 🔄).
- [ ] Open a browser and go to `http://YOUR-ALB-DNS` (http, not https).
  The TaskFlow login page should appear 🎉
- 📸 **Screenshots:**
  - [ ] Load Balancer details page (shows the DNS name)
  - [ ] Target group with **2 healthy** targets
  - [ ] The app opened using the ALB DNS address
  - [ ] Auto Scaling Group details (Desired 2, Min 2, Max 4)
  - [ ] EC2 → Instances showing the 2 running `taskflow-instance`s

---

## PART 5: Prove Load Balancing and Auto Scaling (Task 1)

- [ ] **5.1 Load balancing proof:** in the VS Code terminal (put your DNS in place of `YOUR-ALB-DNS`):
  ```powershell
  1..8 | % { (Invoke-RestMethod http://YOUR-ALB-DNS/api/info).serverName }
  ```
  You should see **2 different instance IDs** (`i-0abc…` and `i-0def…`).
  📸 **Screenshot**

- [ ] **5.2 Auto scaling proof (self-healing)**
  - EC2 → **Instances** → select ONE `taskflow-instance` → **Instance state → Terminate**
  - Wait 1-2 minutes → **Auto Scaling Groups → taskflow-asg → Activity** tab
  - You'll see "Terminating…" and then "**Launching a new EC2 instance**"
  - 📸 **Screenshot** of the Activity tab

---

## PART 6: Linux + Volume evidence on the server (Tasks 2 and 4)

- [ ] **6.1** EC2 → **Instances** → select one **running** `taskflow-instance` → click **Connect** (top) → **EC2 Instance Connect** tab → **Connect**.
  A black terminal opens in your browser.

- [ ] **6.2** Type these commands one by one:
  ```bash
  cd /opt/taskflow
  sudo docker ps
  sudo docker images
  sudo docker volume ls
  ```
  📸 **Screenshot**

- [ ] **6.3 Linux commands (Task 2)**
  ```bash
  bash scripts/linux-admin.sh
  ```
  📸 **Screenshots** (scroll up; capture the mkdir, chmod and `ls -l` parts)

- [ ] **6.4 Volume persistence (Task 4)**
  ```bash
  sudo bash scripts/volume-demo.sh
  ```
  It must end with **DATA PERSISTED**.
  📸 **Screenshot**

---

## PART 7: Selenium against AWS (Task 6)

- [ ] In the VS Code terminal on your laptop:
  ```powershell
  python tests/selenium_test.py http://YOUR-ALB-DNS --headed
  ```
  It must end with **10/10 passed → PASS**.
  📸 **Screenshot**

---

## PART 8: Before the viva (28 October)

- [ ] Read `docs/VIVA_NOTES.md` 2-3 times. Practise answering out loud.
- [ ] Be ready to open and explain: `backend/Dockerfile`, `docker-compose.yml`, `tests/selenium_test.py`, `aws/user-data.sh`
- [ ] Keep the AWS setup **running until your viva is finished** (the teacher may ask to see it live)

## PART 9: After the viva, delete AWS resources (so you don't pay)
Delete in **this order**:
1. [ ] Auto Scaling Groups → `taskflow-asg` → Delete (this also removes the instances)
2. [ ] Load Balancers → `taskflow-alb` → Delete
3. [ ] Target Groups → `taskflow-tg` → Delete
4. [ ] Launch Templates → `taskflow-lt` → Delete
5. [ ] Security Groups → `taskflow-ec2-sg`, then `taskflow-alb-sg` → Delete

---

## ❗ If something goes wrong

| Problem | What to do |
|---|---|
| `docker` command not found / error on laptop | Open **Docker Desktop** and wait until it's running |
| `git push` asks for a password | Sign in through the browser pop-up, or use a GitHub Personal Access Token as the password |
| Targets stay **unhealthy** for more than 10 min | Connect to the instance (step 6.1) and run `sudo tail -50 /var/log/taskflow-bootstrap.log`. Usually the GitHub URL is wrong or the repo is private. Fix `REPO_URL` in the launch template (Actions → Modify template → new version, set as default), then terminate the instances so the ASG makes new ones. |
| ALB address shows **502 / 503** | The instances are still starting. Wait 5 more minutes. |
| Page doesn't open at all | Use **http://**, not https://. Check that `taskflow-alb-sg` allows HTTP from Anywhere. |
| EC2 Instance Connect fails | Check that `taskflow-ec2-sg` has SSH (22) from **Anywhere-IPv4** |
| Selenium error about Chrome | Install Google Chrome on your laptop |

If you're stuck on any step, send me a screenshot of the error and I'll help.
