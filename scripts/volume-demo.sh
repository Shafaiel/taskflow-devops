#!/bin/bash
# Task 4 - Docker named volume & data persistence demo.
# Run from the project root:  bash scripts/volume-demo.sh | tee ~/volume-demo-output.txt
# Proves that MySQL data survives removing and recreating the containers.
set -e
cd "$(dirname "$0")/.."
set -a; source .env; set +a

MARKER="persistence-check-$(date +%s)"
sql() {
  docker compose exec -T db mysql -u"$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" -N -e "$1" 2>/dev/null
}

step() { echo ""; echo "==== $1 ===="; }

step "1. Named volume used by the db service"
docker volume ls --filter name=taskflow
docker volume inspect taskflow_mysql_data --format 'Name: {{.Name}}  Driver: {{.Driver}}  Mountpoint: {{.Mountpoint}}'

step "2. Current containers"
docker compose ps

step "3. Insert a marker row into the database"
sql "INSERT INTO tasks (user_id, title, category, priority) VALUES (1, '$MARKER', 'Volume', 'high');"
sql "SELECT id, title, created_at FROM tasks WHERE title = '$MARKER';"
OLD_DB_ID=$(docker compose ps -q db)
echo "db container id before: ${OLD_DB_ID:0:12}"

step "4. Remove ALL containers (docker compose down - volume is kept)"
docker compose down
echo ""
docker ps -a --filter name=taskflow
echo "Volume still exists:"
docker volume ls --filter name=taskflow

step "5. Recreate the containers (docker compose up)"
docker compose up -d --wait
NEW_DB_ID=$(docker compose ps -q db)
echo "db container id after:  ${NEW_DB_ID:0:12}  (new container)"

step "6. Check the marker row is still there"
RESULT=$(sql "SELECT id, title, created_at FROM tasks WHERE title = '$MARKER';")
echo "$RESULT"
if [ -n "$RESULT" ]; then
  echo ""
  echo "RESULT: DATA PERSISTED - the new container reused the 'taskflow_mysql_data' volume."
else
  echo "RESULT: data NOT found"; exit 1
fi

echo ""
echo "Note: 'docker compose down -v' WOULD delete the volume and all data."
