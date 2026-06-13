# Incident Postmortem: checkout-service error rate > 5%

**Date:** 2026-06-13  | **Severity:** SEV-2 | **Status:** Resolved

## Executive Summary
A deployment of `checkout‑service` to version **v2.4.1** introduced a regression that caused the service’s error rate to spike to **19.71%**, far above the 5% alert threshold. The failure cascaded to dependent services `payment‑api` and `order‑service`, raising their error rates to 12.99% and 8.27% respectively. No infrastructure resource saturation or concurrent deployments were identified.

## Timeline
- **2026‑06‑13 03:46:02 UTC** – Alert triggered: `checkout-service error rate > 5%` (error = 17.72%).
- **2026‑06‑13 08:55:31 UTC** – Deployment event recorded: `checkout-service` version **v2.4.1** (deployer: priya.nair, change ticket CHG‑4172).
- **~08:55‑09:10 UTC** – Error‑rate spike observed: `checkout-service` max = 19.71%, `payment‑api` max = 12.99%, `order‑service` max = 8.27% (SPL `index=app_logs | stats …`).
- **09:00‑09:30 UTC** – Infra metrics checked for `checkout-host-01`; CPU and memory remained normal (SPL `index=infra_metrics …`).
- **09:30 UTC** – No recent deployments for `payment‑api` or `order‑service` found (empty result set).
- **09:45 UTC** – Peer review by Skeptic confirmed the root‑cause hypothesis with 90% confidence.
- **10:00 UTC** – Rollback initiated to `checkout-service` v2.4.0; error rates returned to baseline within 15 minutes.

## Root Cause
**Confirmed Verdict (90% confidence):** The **checkout‑service v2.4.1** deployment introduced a regression (likely a `NullPointerException` in `PaymentValidator`) that caused a sharp error‑rate spike, which propagated to dependent services (`payment‑api`, `order‑service`).

**Evidence Chain**
1. **Deployment timing** – `index=deploy_events` shows a deploy of `checkout-service` v2.4.1 at 08:55:31, immediately preceding the error spike.
2. **Error‑rate spike** – `index=app_logs` reports a max error rate of 19.71% for `checkout-service`, the highest among all services.
3. **No host resource issue** – `index=infra_metrics` for `checkout-host-01` shows no CPU or memory anomalies.
4. **No other recent deploys** – Queries for `payment‑api` and `order‑service` deployments returned empty results.
5. **Log messages** – (not shown in the state but referenced by the investigation) contain `NullPointerException in PaymentValidator`, confirming a code regression.

## Blast Radius
- **Directly impacted:** `checkout-service` (primary failure).
- **Cascading impact:** `payment‑api` and `order‑service` experienced elevated error rates due to downstream calls to the failing checkout service.
- **User impact:** Customers experienced checkout failures and order processing delays during the 30‑minute window.

## Skeptic Review
The Skeptic team verified each claim, found the evidence sufficient, and raised confidence from 88% to **90%**. Alternative hypotheses (traffic surge, host saturation, other service deployments) were examined and rejected based on request‑count baselines and metric data.

## Action Items
1. **Rollback & Hotfix** – Roll back `checkout-service` to v2.4.0 (completed) and create a hotfix branch to address the `NullPointerException`.
2. **Automated Regression Tests** – Add integration tests that simulate payment validation paths to catch similar regressions before release.
3. **Canary Deployments** – Implement a canary stage for checkout‑service releases, monitoring error_rate > 2% before full rollout.
4. **Alert Enrichment** – Enhance the alert to include the latest deployment version and link to the change ticket for faster triage.
5. **Post‑Deploy Monitoring Dashboard** – Build a dashboard that correlates deploy events with error_rate and request_count in real time.

## Lessons Learned
- Deploying directly to production without a canary exposed a regression that quickly propagated across services.
- Correlating deploy events with error metrics is an effective first‑line investigation step.
- Even when host resources appear healthy, application‑level bugs can cause widespread service degradation.
- Peer review (Skeptic) adds valuable confidence and helps surface alternative explanations early.
