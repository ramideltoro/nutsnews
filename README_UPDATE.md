# Grafana Backup Monitoring Documentation Update

This update documents the Grafana Cloud / PromQL backup-monitoring work for the NutsNews home server.

## What changed

Updated documentation files:

- `docs/GRAFANA_BACKUP_MONITORING.md`
- `docs/OBSERVABILITY.md`
- `docs/HOME_SERVER_DASHBOARD.md`
- `docs/README.md`
- `README.md`

## New documentation added

A new guide was added at:

```text
docs/GRAFANA_BACKUP_MONITORING.md
```

It covers:

- Grafana Cloud Explore setup.
- Prometheus data source selection.
- How to switch to PromQL Code mode.
- Confirmed backup metric query.
- Backup dashboard panel recommendations.
- PromQL for last backup success, failed state, successful state, backup age, backup count, and next backup time.
- Alert ideas for failed backups, stale backups, and no available backups.
- Troubleshooting when metrics do not appear.
- Security notes about what should not be exposed in Grafana screenshots or panels.

## Confirmed metric documented

```promql
home_server_backup_last_success{instance="chingadera", job="integrations/unix"}
```

Confirmed meaning:

```text
1 = last backup succeeded
0 = last backup failed
```

## Validation performed

Documentation-only update. No application source code, package files, or runtime behavior changed.

Checked changed markdown files were written into the repo and included in the bundle.
