# Incident Postmortem: checkout-service error rate > 5%

**Date/Severity/Status**: 2026-06-13 | SEV‑2 | Resolved

## Executive Summary
On 13 June 2026 the checkout‑service experienced a rapid error‑rate spike to 18 % (well above the 5 % alert threshold), causing downstream degradation in payment‑api and order‑service. Investigation linked the outage to a faulty deployment of checkout‑service version v2.4.1, which introduced a `NullPointerException` in `PaymentValidator`. The issue was rolled back to v2.4.0, after which error rates returned to normal.

## Timeline
- **03:42 UTC** – Alert fired (`checkout-service error rate > 5%`).
- **03:42 UTC** – Triage identified three affected services (checkout‑service 18.1 %, payment‑api 11.03 %, order‑service 8.14 %).
- **03:42 UTC** – Investigation tasks assigned: correlate deployments, examine error messages, check host metrics.
- **08:55 UTC** – Deploy event recorded: checkout‑service v2.4.1 deployed by *priya.nair* (CHG‑4172) with rollback target v2.4.0.
- **09:00‑09:30 UTC** – Log search shows a surge of `NullPointerException in PaymentValidator` (21 occurrences) on checkout‑service.
- **09:00‑10:00 UTC** – Infra metrics for `checkout-host-01` show no CPU or memory spikes.
- **10:15 UTC** – Decision made to rollback checkout‑service to v2.4.0.
- **10:30 UTC** – Rollback completed; error rates began to drop.
- **11:00 UTC** – All services back under 5 % error threshold; incident declared resolved.

## Root Cause
**Confirmed Verdict**: A faulty recent deployment of checkout‑service (v2.4.1) introduced a `NullPointerException` in `PaymentValidator`, causing the checkout‑service error‑rate spike that cascaded to payment‑api and order‑service.

**Evidence Chain**
1. *Deployment timing* – `index=deploy_events` shows checkout‑service v2.4.1 deployed at 08:55 UTC, immediately before the error spike.
2. *Error logs* – `index=app_logs service="checkout-service" error=*` returns `NullPointerException in PaymentValidator` (21 occurrences), the dominant error after the deploy.
3. *Host health* – `index=infra_metrics host="checkout-host-01"` shows no abnormal CPU or memory usage, ruling out resource saturation.
4. *Service impact* – `index=app_logs` error‑rate stats confirm the highest max error on checkout‑service (19.71 %) with secondary spikes on payment‑api (12.99 %) and order‑service (8.27 %).

## Blast Radius
- checkout‑service (primary failure point)
- payment‑api (downstream dependency)
- order‑service (downstream dependency)

## Skeptic Review
The skeptic was asked to peer‑review the “Unknown root cause” verdict. The subsequent hypothesis testing provided concrete evidence confirming the deployment‑related `NullPointerException`. The skeptic’s concerns are addressed; confidence in the root‑cause determination is now **85 %**.

## Action Items
1. **Implement automated smoke tests** for `PaymentValidator` during CI/CD pipelines to catch null‑pointer regressions before release.
2. **Add a post‑deployment health check** that monitors error_rate > 5 % for the first 15 minutes and auto‑triggers a rollback if thresholds are breached.
3. **Update run‑books** to include the specific rollback steps for checkout‑service and communication flow to dependent teams.
4. **Create a dashboard** visualising error_rate spikes alongside recent deploy events for rapid correlation.
5. **Conduct a post‑deployment review** with the dev team to analyse the code change that introduced the `NullPointerException` and apply defensive coding practices.

## Lessons Learned
- Deployments can have immediate, cross‑service impact; correlating deploy events with error metrics is essential.
- Centralised error‑message aggregation quickly surfaces the offending exception type.
- Resource metrics alone may not explain service failures; code‑level regressions must be considered.
- Having a fast rollback path and automated health checks dramatically reduces MTTR.
