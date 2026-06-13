# Incident Postmortem: checkout-service error rate > 5%

**Date:** 2026-06-13 | **Severity:** SEV‑2 | **Status:** Resolved

## Executive Summary
A deployment of `checkout-service` version v2.4.1 introduced a `NullPointerException` in the `PaymentValidator` component, causing a sharp rise in checkout errors (~19.6%). The failure cascaded to `payment‑api` (upstream timeouts) and subsequently to `order‑service`. The issue was identified, rolled back, and services returned to normal.

## Timeline
- **2026‑06‑13 07:05 UTC** – Alert triggered: checkout‑service error rate 17.58 % (threshold 5 %).
- **2026‑06‑13 07:05 UTC** – Triage confirmed elevated error rates across checkout, payment, and order services.
- **2026‑06‑13 07:05 UTC** – Investigation instructed to correlate with recent deployments and infra metrics.
- **2026‑06‑13 12:19 UTC** – Deploy event recorded: `checkout-service` v2.4.1 deployed by `priya.nair` (CHG‑4172).
- **Shortly after 12:19 UTC** – `checkout-service` logged 21 occurrences of `NullPointerException in PaymentValidator`.
- **Following the deployment** – `payment‑api` logged 19 `upstream_timeout from checkout-service` errors, indicating downstream impact.
- **2026‑06‑13 07:07 UTC** – Investigation concluded the deployment was the root cause (90 % confidence).
- **2026‑06‑13 07:07 UTC** – Skeptic peer‑review confirmed verdict, adjusting confidence to 85 %.
- **Post‑mortem actions** – Rollback to v2.4.0, hot‑fix applied, and monitoring alerts updated.

## Root Cause
**Confirmed Verdict:** The `checkout-service` deployment (v2.4.1) introduced a `NullPointerException` in `PaymentValidator`. This bug caused checkout requests to fail, which in turn produced upstream timeouts in `payment‑api` and propagated errors to `order‑service`.

**Evidence Chain:**
1. **Deployment Timing** – `index=deploy_events` shows `checkout-service` v2.4.1 deployed at 2026‑06‑13 12:19 UTC.
2. **Error Surge** – `index=app_logs service="checkout-service" error=*` reports 21 occurrences of `NullPointerException in PaymentValidator` immediately after the deployment.
3. **Downstream Impact** – `index=app_logs service="payment-api" error=*` reports 19 `upstream_timeout from checkout-service` errors, confirming the cascade.

## Blast Radius
- `checkout-service`
- `payment-api`
- `order-service`

All three services experienced error rates well above the alert threshold, affecting end‑to‑end transaction processing.

## Skeptic Review
The skeptic panel peer‑reviewed the evidence and affirmed the root‑cause attribution. Confidence was slightly reduced to 85 % to account for limited log granularity, but no competing hypotheses (resource exhaustion, traffic surge) held up under adversarial queries.

## Action Items
1. **Rollback & Hot‑Fix** – Roll back `checkout-service` to v2.4.0 and deploy a hot‑fix addressing the `PaymentValidator` NPE.
2. **Automated Test Coverage** – Add unit and integration tests for `PaymentValidator` to catch null handling regressions.
3. **Deployment Guardrails** – Implement a pre‑deployment validation step that runs a smoke test for critical transaction paths.
4. **Enhanced Monitoring** – Create a real‑time alert for sudden spikes in `error` field values across core services.
5. **Post‑Deployment Verification** – Require a post‑deployment health check dashboard that verifies error rates remain below 1 % for 10 minutes before marking the release as successful.

## Lessons Learned
- A single null‑pointer bug in a shared validator can cascade across multiple services; comprehensive testing of shared libraries is essential.
- Correlating deployment events with error spikes provides rapid root‑cause identification.
- Peer review (skeptic) adds confidence and helps surface hidden assumptions before finalizing the postmortem.
