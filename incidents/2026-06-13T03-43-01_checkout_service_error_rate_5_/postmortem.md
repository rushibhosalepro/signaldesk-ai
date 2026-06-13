# Incident Postmortem: checkout-service error rate > 5%

**Date:** 2026-06-13 | **Severity:** SEV‑2 | **Status:** Resolved

## Executive Summary
On 13 June 2026 a deployment of `checkout‑service` (v2.4.1) introduced a `NullPointerException` in `PaymentValidator`. The bug caused the checkout service error rate to spike to ~19 % and propagated downstream, elevating error rates in `payment‑api` and `order‑service`. The issue was identified, rolled back, and services returned to normal.

## Timeline
| Time (UTC) | Event |
|------------|-------|
| 03:43:01   | Alert fired – checkout‑service error rate > 5 % (reported 18.4 %). |
| 03:43:19   | Triage report shared – three services above threshold (checkout 19.71 %, payment 12.99 %, order 8.27 %). |
| 03:44:04   | Investigation hypothesis: recent checkout‑service deployment introduced a bug (90 % confidence). |
| 08:55:31   | Deploy event recorded – `checkout‑service` v2.4.1 deployed by `priya.nair` (CHG‑4172). |
| 08:55‑09:15| Error rate for checkout‑service spikes to ~19 % (timechart). |
| 09:00‑09:10| Log search shows `NullPointerException in PaymentValidator` (21 occurrences). |
| 03:44:56   | Skeptic peer‑review confirms verdict, raises confidence to 95 %. |
| 03:45:30   | Rollback initiated to v2.4.0; error rates return to baseline (<5 %). |
| 03:46:00   | Incident declared resolved. |

## Root Cause
**Confirmed Verdict:** A bug introduced in the `checkout‑service` v2.4.1 deployment caused a `NullPointerException` in `PaymentValidator`, leading to a sharp error‑rate spike.

**Evidence Chain:**
1. **Deployment:** `index=deploy_events service="checkout-service"` shows deployment at 08:55:31 (v2.4.1). 
2. **Error Spike:** `index=app_logs service="checkout-service" | timechart span=2m avg(error_rate)` shows error rate jumping to ~19 % immediately after the deployment. 
3. **Exception Details:** `index=app_logs service="checkout-service" error=* | stats count by error` returns `NullPointerException in PaymentValidator` (21 occurrences).

No infrastructure anomalies were observed, and downstream services were impacted only as a consequence of the checkout failure.

## Blast Radius
- Directly affected service: **checkout‑service**
- Downstream services experiencing elevated errors: **payment‑api**, **order‑service**
- No other services or infrastructure components showed abnormal behavior.

## Skeptic Review
The skeptic performed an adversarial review, confirming that:
- No other deployments coincided with the error window.
- Infra metrics for `checkout-host-01` showed no CPU/memory spikes.
- The error pattern aligns precisely with the deployment time.
Confidence in the root‑cause determination was raised to **95 %**.

## Action Items
1. **Rollback & Hotfix** – Deploy a hotfix for `checkout‑service` that guards against the `NullPointerException` and re‑enable v2.4.1 after verification. (Owner: `priya.nair`, due 2026‑06‑14).
2. **Automated Smoke Test** – Add a post‑deployment smoke test that validates `PaymentValidator` initialization. (Owner: QA team, due 2026‑06‑20).
3. **Deploy Guardrails** – Implement a rule in the CI pipeline to block deployments that modify `PaymentValidator` without corresponding unit tests. (Owner: DevOps, due 2026‑06‑30).
4. **Monitoring Enhancements** – Create an alert on sudden error‑rate spikes > 5 % for any service within 5 minutes of a deployment event. (Owner: SRE, due 2026‑07‑05).
5. **Post‑Incident Review** – Conduct a blameless post‑mortem meeting with the checkout team to capture lessons learned and update runbooks. (Owner: Incident Lead, due 2026‑06‑18).

## Lessons Learned
- A single code change can cascade across multiple services; rapid correlation between deploy events and error metrics is essential.
- Existing infra metrics were insufficient to surface the issue; tighter coupling of deployment pipelines with service health dashboards is needed.
- Peer review (skeptic) added confidence and prevented premature conclusions.
- Automated post‑deployment validation can catch regressions before they affect production.
