# Security Policy

## Boundaries

P Trust is read-only static inspection of public repositories. Never submit private credentials, personal files or confidential source. It neither certifies safety nor authorizes execution. Contact maintainers through GitHub private vulnerability reporting when enabled; do not post exploitable secrets in public issues.

## Limitations

No runtime sandbox or data-flow proof exists in v0.1. Alias handling, static guard enforcement and source redaction are incomplete. The public service uses strict resource limits and a conservative anonymous GitHub quota. Reports expire after 24 hours. Code patterns may generate false positives; provide harmless reproductions when reporting them.
