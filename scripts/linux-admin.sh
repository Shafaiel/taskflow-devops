#!/bin/bash
# Task 2 - Linux Administration demo.
# Run on the EC2 instance:  bash scripts/linux-admin.sh | tee ~/linux-admin-output.txt
# Shows basic commands, directory creation and file permissions (numeric + symbolic).

run() {
  echo ""
  echo "\$ $*"
  eval "$@"
}

section() {
  echo ""
  echo "=================================================================="
  echo " $1"
  echo "=================================================================="
}

section "1. System information"
run whoami
run id
run hostname
run uname -a
run cat /etc/os-release \| head -3
run uptime
run df -h /
run free -m
run pwd

section "2. Create a directory structure"
LAB_DIR="$HOME/devops-lab"
rm -rf "$LAB_DIR"
run mkdir -p "$LAB_DIR"/{app,logs,config,scripts,backup}
run ls -l "$LAB_DIR"
run cd "$LAB_DIR"

section "3. Create files"
run 'echo "TaskFlow config: DB_HOST=db" > config/app.conf'
run 'echo "secret-api-key-123" > config/secrets.env'
run 'echo "$(date) app started" > logs/app.log'
run 'printf "#!/bin/bash\necho Deploying TaskFlow...\n" > scripts/deploy.sh'
run touch app/README.md
run find . -type f
run cat config/app.conf

section "4. File permissions (numeric mode)"
echo "# r=4 w=2 x=1 | order: owner group others"
run chmod 755 scripts/deploy.sh      # rwxr-xr-x : owner full, others read+execute
run chmod 644 config/app.conf        # rw-r--r-- : owner read/write, others read
run chmod 600 config/secrets.env     # rw------- : only owner can read/write
run chmod 700 backup                 # rwx------ : private directory
run ls -l scripts config
run ls -ld backup

section "5. File permissions (symbolic mode)"
run chmod u+x,g-w,o-r logs/app.log
run ls -l logs/app.log
run chmod o+r logs/app.log
run ls -l logs/app.log
run stat -c "'%A %a %U:%G %n'" config/secrets.env scripts/deploy.sh

section "6. Execute the script (needs x permission)"
run ./scripts/deploy.sh
run chmod -x scripts/deploy.sh
run './scripts/deploy.sh || echo "-> Permission denied because execute bit was removed"'
run chmod +x scripts/deploy.sh

section "7. Ownership (chown / chgrp)"
if sudo -n true 2>/dev/null; then
  run sudo groupadd -f devops
  run sudo chown root:devops config/app.conf
  run ls -l config/app.conf
  run sudo chown "$(whoami)":"$(whoami)" config/app.conf
else
  echo "(sudo not available without password - skipping chown demo)"
fi

section "8. Other useful commands"
run 'ls -la | head -10'
run du -sh "$LAB_DIR"
run 'grep -r "DB_HOST" config/'
run 'ps aux --sort=-%mem | head -5'
run 'cp config/app.conf backup/ && ls -l backup/'
run 'tar -czf ~/devops-lab-backup.tar.gz -C "$HOME" devops-lab && ls -lh ~/devops-lab-backup.tar.gz'
run umask

section "Done"
echo "Directory created at: $LAB_DIR"
