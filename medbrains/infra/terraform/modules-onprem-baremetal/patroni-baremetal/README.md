# Patroni on bare metal

Installs a three-node PostgreSQL HA cluster (Patroni + etcd) on hosts the hospital provides,
by running the playbooks in `ansible/` from Terraform.

## etcd TLS

etcd holds Patroni's record of which node is primary, so it runs on TLS with client certificates
on both its client port (2379) and its peer port (2380). Terraform makes the cluster CA and the
certificates (`main.tf`):

- one certificate per member, named by its inventory host (IP or DNS name) plus localhost;
- one client certificate for Patroni.

They are written to `ansible/pki-<tenant>/` on the operator's machine (directory 0700, keys 0600,
git-ignored) and copied to the hosts by Ansible. The private keys are also in Terraform state:
keep this stack's state in an encrypted backend with restricted access.

## Fresh installs only

`etcd.yml` refuses to run on a member whose etcd is still on plain HTTP. A live cluster cannot be
moved by re-applying: every member's URLs change at once, and the members would stop seeing each
other. To move an existing cluster, one member at a time:

1. Copy that member's certificate, key and the CA to `/etc/etcd/pki/`.
2. `etcdctl member update <id> --peer-urls=https://<host>:2380`
3. Change `/etc/etcd/etcd.conf` to the TLS settings from `etcd.yml`, then restart etcd.
4. Check `etcdctl --cacert … --cert … --key … endpoint health --cluster` before the next member.

Then point Patroni at `https` (its `etcd3` block in `patroni.yml.j2`) and restart Patroni node by
node. Do not apply this module to the cluster until every member is on TLS.

A CA rotation re-runs both playbooks (the CA hash is a trigger on each), which restart etcd and
Patroni through their handlers.
