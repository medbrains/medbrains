# MedBrains OS: replacing Windows Server on the main machine

Status: PROPOSED, 2026-11-04. Owner direction: the main machine is a Windows Server alternative with
all network services built in, run from MedBrains Control (`OS-SETUP-AND-TRUST.md` §8c).

| Windows Server role | Built-in equivalent (candidates, not yet tested) | Priority |
|---|---|---|
| Active Directory: people, sign-in | Kernel identity + identity provider (Kanidm) | First |
| Group Policy | Policies through `medbrains-agent`, on our OS machines | First |
| DNS, DHCP | Kea DHCP, a small DNS server (CoreDNS or Unbound) | Second |
| WSUS: updates | Signed update channel and rings (§8b) | Second |
| Certificate Services | Hospital root key (§7), issuing machine and service certificates | Second |
| NPS: Wi-Fi and VPN sign-in (RADIUS) | Kanidm's RADIUS, or FreeRADIUS if it falls short; WireGuard for VPN (exists as opt-in) | Second |
| Print server | CUPS, and direct network printing | Second |
| File server | Samba shares, with permissions from the identity provider | Third |
| Remote Desktop | Remote support (§8r) | Third |
| Backup | Encrypted backup and restore (§8k) | Before any go-live |
| Domain join for existing Windows PCs | Samba AD, only if a real hospital needs it | Evaluate |
| Hyper-V | Not planned: run apps as services; keep Hyper-V only for the Windows install path (§8l) | No |

## Rules

1. **Off until switched on.** Every network service starts off. Control detects what the network already
   has and says so, because a second DHCP server can take a working hospital network down.
2. **One preview before change.** A network change shows its effect first and rolls back unless confirmed
   (§8s).
3. **Patient care does not sit behind file shares.** Clinical data stays in MedBrains under RFC-AUTHZ.
   A file share is not a place for patient records, and the screen says so.
4. **Failover is required for big hospitals.** If one main machine also runs DNS, DHCP and sign-in, its
   failure stops the whole network. Network services need a second machine, or stay on existing equipment.
5. **Size budgets apply.** Each service runs only when switched on, and memory is measured for each.

## Not proven

Nothing here has been run. Existing Windows PCs and legacy apps tied to Active Directory are the biggest
migration risk, and Samba AD's fit has not been evaluated.
