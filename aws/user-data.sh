#!/bin/bash
# =====================================================================
# EC2 User Data - bootstraps a TaskFlow instance (Amazon Linux 2023).
# Paste this into the Launch Template -> Advanced details -> User data.
# Every instance the Auto Scaling Group launches runs this on first boot.
# Log file on the instance: /var/log/taskflow-bootstrap.log
# =====================================================================

# ---------- EDIT THESE ----------
REPO_URL="https://github.com/YOUR_GITHUB_USERNAME/taskflow-devops.git"
BRANCH="main"
DB_PASSWORD="ChangeMe_Db_2026"
MYSQL_ROOT_PASSWORD="ChangeMe_Root_2026"
# Same secret on every instance so login cookies stay valid behind the ALB
JWT_SECRET="ChangeMe_LongRandomSecret_2026"
# --------------------------------

exec > >(tee /var/log/taskflow-bootstrap.log) 2>&1
set -euxo pipefail

APP_DIR=/opt/taskflow

# 1. Swap file - t2/t3.micro has only 1 GB RAM (MySQL + image builds need headroom)
if [ ! -f /swapfile ]; then
  dd if=/dev/zero of=/swapfile bs=1M count=1024
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile swap swap defaults 0 0' >> /etc/fstab
fi

# 2. Install Docker, Git and the Docker Compose + Buildx plugins
dnf update -y
dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user || true

ARCH=$(uname -m)                                  # x86_64 or aarch64
BUILDX_ARCH=$([ "$ARCH" = "aarch64" ] && echo arm64 || echo amd64)
PLUGIN_DIR=/usr/local/lib/docker/cli-plugins
mkdir -p "$PLUGIN_DIR"
curl -fsSL "https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-${ARCH}" \
  -o "$PLUGIN_DIR/docker-compose"
curl -fsSL "https://github.com/docker/buildx/releases/download/v0.17.1/buildx-v0.17.1.linux-${BUILDX_ARCH}" \
  -o "$PLUGIN_DIR/docker-buildx"
chmod +x "$PLUGIN_DIR/docker-compose" "$PLUGIN_DIR/docker-buildx"
docker version
docker compose version

# 3. Read this instance's identity from the metadata service (IMDSv2)
TOKEN=$(curl -s -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 300")
meta() { curl -s -H "X-aws-ec2-metadata-token: $TOKEN" "http://169.254.169.254/latest/meta-data/$1"; }
INSTANCE_ID=$(meta instance-id)
PRIVATE_IP=$(meta local-ipv4)
AZ=$(meta placement/availability-zone)

# 4. Get the application code
rm -rf "$APP_DIR"
git clone --branch "$BRANCH" --depth 1 "$REPO_URL" "$APP_DIR"
cd "$APP_DIR"

# 5. Environment file (permissions 600 - contains secrets)
cat > .env <<EOF
MYSQL_ROOT_PASSWORD=${MYSQL_ROOT_PASSWORD}
DB_NAME=taskflow
DB_USER=taskflow
DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
WEB_PORT=80
SERVER_NAME="${INSTANCE_ID} (${PRIVATE_IP})"
AVAILABILITY_ZONE=${AZ}
EOF
chmod 600 .env
chown -R ec2-user:ec2-user "$APP_DIR" || true

# 6. Build images and start the stack (nginx + api + db)
docker compose up -d --build --wait
docker compose ps

echo "TaskFlow is running on ${INSTANCE_ID} (${PRIVATE_IP}, ${AZ})"
