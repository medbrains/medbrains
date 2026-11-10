#!/usr/bin/env bash
# Installs CUPS headers and PostgreSQL 17 on a throwaway GitHub runner and creates the
# `medbrains` database the integration tests use. Shared by the Rust test job (ci.yml) and
# the Rust coverage job (sonarqube.yml), so both test against the same database.
# The OS rule is no Docker, so PostgreSQL runs directly on the runner. The credentials exist
# only on that machine. medbrains-printing links against CUPS.
set -euo pipefail
sudo apt-get update
sudo apt-get install -y libcups2-dev postgresql-common
# The migrations need 17 (`transaction_timeout`), and the runner's default is older.
sudo /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y
sudo systemctl stop postgresql
for cluster in $(pg_lsclusters -h | awk '{print $1"/"$2}'); do
  sudo pg_dropcluster --stop "${cluster%/*}" "${cluster#*/}"
done
sudo apt-get install -y postgresql-17
pg_lsclusters -h | grep -q '^17 ' || sudo pg_createcluster 17 main
sudo pg_ctlcluster 17 main start
pg_lsclusters
sudo -u postgres psql -c "CREATE ROLE medbrains SUPERUSER LOGIN PASSWORD 'ci_only'"
sudo -u postgres createdb -O medbrains medbrains
