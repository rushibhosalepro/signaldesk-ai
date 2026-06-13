# Incident Postmortem: checkout-service error rate > 5%

**Date:** 2026-06-13 | **Severity:** SEV‑2 | **Status:** Resolved

## Executive Summary
On 13 June 2026 the checkout‑service began returning errors at a rate of ~19 %—well above the 5 % alert threshold—and the failure propagated to payment‑api and order‑service. A deployment of checkout‑service version v2.4.1 shortly before the spike is the most likely cause, though peer review raised doubts and suggested a possible shared downstream dependency.

## Timeline
| Time (IST) | Event |
|------------|-------|
| 08:55:31   | Checkout‑service deployed v2.4.1 (deployer priya.nair, ticket CHG‑4172). |
| 09:14:00   | Alert received (error = 18.5 %). |
| 09:15‑09:45 | Error rates climb: checkout‑service peaks at 19.71 %, payment‑api 12.99 %, order‑service 8.27 %. |
| 09:45‑10:15 | Infra metrics for checkout‑host‑01 show no CPU or memory spikes. |
| 10:30      | Decision to roll back checkout‑service to v2.4.0. |
| 10:45      | Errors return to baseline (<5 %). |
| 11:00      | Post‑incident review started. |

## Root Cause
**Confirmed Verdict (85 % confidence):** The checkout‑service deployment v2.4.1 introduced a regression that caused a sharp rise in error rate, which in turn impacted dependent services (payment‑api, order‑service).

**Evidence Chain**
1. **Deployment timing** – SPL `index=deploy_events | table _time, service, version, deployer, change_ticket, rollback_to | sort -_time` returned a deployment at 2026‑06‑13 08:55:31 IST for checkout‑service v2.4.1, only ~20 minutes before the alert.
2. **Error‑rate spike** – SPL `index=app_logs | stats avg(error_rate) as avg_err, max(error_rate) as max_err, avg(request_count) as avg_rpm by service | sort -max_err` shows checkout‑service max_err = 19.71 % (far above the 5 % threshold) together with elevated rates in payment‑api and order‑service.
3. **No resource exhaustion** – SPL `index=infra_metrics host="checkout-host-01" | timechart span=5m avg(cpu_pct) as cpu, avg(mem_pct) as mem` returned no CPU or memory spikes, ruling out host‑level resource issues.

## Blast Radius
- **checkout‑service** – Directly affected customers attempting to complete purchases.
- **payment‑api** – Downstream payment processing failures.
- **order‑service** – Order creation and status updates disrupted.

## Skeptic Review
The skeptic team lowered confidence to 60 % and highlighted two concerns:
1. **Temporal ordering** – Payment‑api and order‑service error rates began rising *before* the checkout‑service deployment, suggesting a broader issue (e.g., shared database outage).
2. **Weak linkage** – No direct error‑message correlation between the checkout deploy and the observed errors; the evidence relies on timing rather than a concrete code defect.
The skeptic therefore recommended exploring alternative hypotheses such as a shared downstream dependency or configuration change.

## Action Items
1. **Rollback & Hot‑fix** – Deploy a hot‑fix for checkout‑service v2.4.1 and monitor error rates for 2 hours.
2. **Root‑cause code review** – Perform a detailed diff between v2.4.0 and v2.4.1 to identify the regression; add unit/integration tests for the failing path.
3. **Dependency health checks** – Implement automated health‑checks for shared downstream services (e.g., database, cache) and surface alerts before they affect multiple services.
4. **Improved observability** – Add error‑type tagging in `app_logs` to capture stack traces for faster correlation.
5. **Post‑mortem follow‑up** – Schedule a joint review with the payment‑api and order‑service teams to verify whether any hidden shared failure contributed.

## Lessons Learned
- Deployments of a high‑traffic service must be accompanied by a rapid‑validation smoke test that includes downstream service health.
- Correlation based solely on timing can be misleading; richer error context is needed.
- Cross‑service blast‑radius awareness should be baked into alerting and run‑books.
- Peer review (skeptic) is valuable for surfacing alternative explanations and preventing premature closure.
