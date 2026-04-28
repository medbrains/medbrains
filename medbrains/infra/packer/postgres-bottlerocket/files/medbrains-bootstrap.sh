#!/usr/bin/env bash
# medbrains-bootstrap — run-once on first boot to render Patroni + pgBackRest
# config from EC2 instance tags. The Terraform module sets these tags
# (see infra/terraform/modules/patroni-cluster/main.tf):
#
#   medbrains-pg-cluster   — cluster id (e.g. medbrains-prod-ap-south-1-pg)
#   medbrains-pg-node-id   — pg-1 / pg-2 / pg-3
#   medbrains-etcd-peers   — comma-separated etcd IPs
#   medbrains-wal-bucket   — S3 bucket for pgBackRest WAL archive
#   medbrains-sync-rep     — true/false
#
# The script reads tags via IMDSv2, fills templates, starts Patroni.

set -euo pipefail

readonly LOG=/var/log/medbrains-bootstrap.log
exec > >(tee -a "$LOG") 2>&1

echo "[medbrains-bootstrap] $(date -u +%FT%TZ) starting"

# IMDSv2 token
TOKEN=$(curl -s -X PUT http://169.254.169.254/latest/api/token \
    -H "X-aws-ec2-metadata-token-ttl-seconds: 21600")
INSTANCE_ID=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/instance-id)
REGION=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/placement/region)
PRIVATE_IP=$(curl -s -H "X-aws-ec2-metadata-token: $TOKEN" \
    http://169.254.169.254/latest/meta-data/local-ipv4)

# Read tags via aws-cli (instance role policy must allow ec2:DescribeTags)
get_tag() {
    aws ec2 describe-tags \
        --region "$REGION" \
        --filters "Name=resource-id,Values=$INSTANCE_ID" "Name=key,Values=$1" \
        --query 'Tags[0].Value' --output text
}

CLUSTER_ID=$(get_tag medbrains-pg-cluster)
NODE_ID=$(get_tag medbrains-pg-node-id)
ETCD_PEERS=$(get_tag medbrains-etcd-peers)
WAL_BUCKET=$(get_tag medbrains-wal-bucket)
SYNC_REP=$(get_tag medbrains-sync-rep)

echo "[medbrains-bootstrap] cluster=$CLUSTER_ID node=$NODE_ID etcd=$ETCD_PEERS"

# Mount the dedicated /dev/xvdf data volume (Terraform creates this)
if ! mountpoint -q /var/lib/medbrains/pg_data; then
    if [[ -e /dev/xvdf ]]; then
        if ! blkid /dev/xvdf >/dev/null 2>&1; then
            mkfs.xfs /dev/xvdf
        fi
        echo "/dev/xvdf /var/lib/medbrains/pg_data xfs defaults,noatime 0 2" >> /etc/fstab
        mount -a
        chown postgres:postgres /var/lib/medbrains/pg_data
        chmod 0700 /var/lib/medbrains/pg_data
    fi
fi

# Render Patroni config
mkdir -p /etc/medbrains
SYNC_BLOCK=""
if [[ "$SYNC_REP" == "true" ]]; then
    SYNC_BLOCK=$'  synchronous_mode: true\n  synchronous_mode_strict: false'
fi

cat > /etc/medbrains/patroni.yml <<EOF
scope: ${CLUSTER_ID}
namespace: /medbrains/
name: ${NODE_ID}

restapi:
  listen: 0.0.0.0:8008
  connect_address: ${PRIVATE_IP}:8008

etcd3:
  hosts: $(echo "$ETCD_PEERS" | sed 's/,/:2379,/g'):2379

bootstrap:
  dcs:
    ttl: 30
    loop_wait: 10
    retry_timeout: 10
    maximum_lag_on_failover: 1048576
${SYNC_BLOCK}
    postgresql:
      use_pg_rewind: true
      use_slots: true
      parameters:
        wal_level: replica
        hot_standby: 'on'
        wal_keep_size: 1GB
        max_wal_senders: 10
        max_replication_slots: 10
        wal_log_hints: 'on'
        archive_mode: 'on'
        archive_command: 'pgbackrest --stanza=${CLUSTER_ID} archive-push %p'
        archive_timeout: 60
  initdb:
    - encoding: UTF8
    - data-checksums
  pg_hba:
    - host replication replicator 10.10.0.0/16 scram-sha-256
    - host all all 10.10.0.0/16 scram-sha-256

postgresql:
  listen: 0.0.0.0:5432
  connect_address: ${PRIVATE_IP}:5432
  data_dir: /var/lib/medbrains/pg_data
  bin_dir: /usr/pgsql-16/bin
  authentication:
    replication:
      username: replicator
      password: \${REPLICATOR_PASSWORD}
    superuser:
      username: postgres
      password: \${POSTGRES_PASSWORD}
  basebackup:
    - max-rate: '100M'

watchdog:
  mode: required
  device: /dev/watchdog
  safety_margin: 5
EOF

# Render pgBackRest config
sed "s|__CLUSTER_ID__|${CLUSTER_ID}|g; s|__BUCKET__|${WAL_BUCKET}|g; s|__REGION__|${REGION}|g" \
    /etc/medbrains/pgbackrest.conf.tmpl > /etc/pgbackrest.conf

# Resolve passwords from Secrets Manager (Phase B.4 — instance role policy
# adds secretsmanager:GetSecretValue)
REPLICATOR_PASSWORD=$(aws secretsmanager get-secret-value \
    --region "$REGION" \
    --secret-id "medbrains/${CLUSTER_ID}/replicator" \
    --query SecretString --output text 2>/dev/null || echo "PLACEHOLDER")
POSTGRES_PASSWORD=$(aws secretsmanager get-secret-value \
    --region "$REGION" \
    --secret-id "medbrains/${CLUSTER_ID}/postgres" \
    --query SecretString --output text 2>/dev/null || echo "PLACEHOLDER")
sed -i "s|\${REPLICATOR_PASSWORD}|${REPLICATOR_PASSWORD}|; s|\${POSTGRES_PASSWORD}|${POSTGRES_PASSWORD}|" \
    /etc/medbrains/patroni.yml

# Start Patroni
systemctl daemon-reload
systemctl enable patroni
systemctl start patroni

echo "[medbrains-bootstrap] $(date -u +%FT%TZ) done"
