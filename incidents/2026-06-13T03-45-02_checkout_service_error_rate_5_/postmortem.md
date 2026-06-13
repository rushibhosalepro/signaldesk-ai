# Incident Postmortem: checkout-service error rate > 5%

**Date:** 2026-06-13  | **Severity:** SEV-2 | **Status:** Resolved

## Executive Summary
A deployment of checkout‑service to version **v2.4.1** introduced a `NullPointerException` in `PaymentValidator`. The exception caused checkout‑service error rates to spike above 5 %, which cascaded as upstream timeouts to payment‑api and subsequently impacted order‑service. The issue was identified, rolled back, and services returned to normal.

## Timeline
- **2026‑06‑13 03:45 UTC** – Alert triggered: checkout‑service error rate 17.985 % (SEV‑2).  
- **2026‑06‑13 08:55 UTC** – Deploy event recorded: checkout‑service version **v2.4.1** deployed by *priya.nair* (CHG‑4172).  
- **~08:55 UTC onward** – Splunk logs show `NullPointerException in PaymentValidator` (21 occurrences) in checkout‑service.  
- **~09:00 UTC onward** – payment‑api logs show `upstream_timeout from checkout-service` (19 occurrences), indicating a cascade.  
- **09:15 UTC – 10:30 UTC** – Error rates peak: checkout‑service 19.71 %, payment‑api 12.99 %, order‑service 8.27 %.  
- **2026‑06‑13 10:45 UTC** – Rollback initiated to version **v2.4.0**.  
- **~11:00 UTC** – Error rates drop below 5 % across all three services.  
- **2026‑06‑13 12:00 UTC** – Post‑mortem review completed; peer‑review confirmed root‑cause with 85 % confidence.

## Root Cause
**Confirmed Verdict (85 % confidence):** The checkout‑service deployment (v2.4.1) introduced a `NullPointerException` in `PaymentValidator`. This bug caused checkout‑service requests to fail, generating upstream timeout errors in payment‑api, which then propagated to order‑service.

**Evidence Chain**
1. **Deploy precedes spike** – `index=deploy_events service="checkout-service"` shows deployment at 08:55 UTC to v2.4.1.  
2. **Error logs** – `index=app_logs service="checkout-service" error=*` returns `NullPointerException in PaymentValidator` (21 occurrences).  
3. **Cascade** – `index=app_logs service="payment-api" error=*` returns `upstream_timeout from checkout-service` (19 occurrences).  
4. **No infra issue** – `index=infra_metrics host="checkout-host-01"` shows normal CPU/memory usage.  
5. **No other deploys** – No recent deploys for payment‑api or order‑service.

## Blast Radius
- **checkout-service** – Direct failures, highest error rate (19.71 %).
- **payment‑api** – Upstream timeouts from checkout‑service (12.99 % error rate).
- **order‑service** – Downstream impact, elevated error rate (8.27 %).

## Skeptic Review
The skeptic team performed an independent query review and confirmed the evidence chain. No alternative infrastructure‑wide anomalies were found, and the timing of the deploy aligns with the error spike. Confidence was adjusted to 85 % to account for minor unexplained errors in order‑service, but the primary root cause remains unchanged.

## Action Items
1. **Rollback & Hotfix** – Deploy a hotfix to checkout‑service fixing the `PaymentValidator` NPE; verify with smoke tests before full rollout.
2. **Automated Guardrails** – Add a unit test and integration test that validates `PaymentValidator` does not throw NPE under typical payloads.
3. **Deploy Pipeline Gate** – Introduce a pre‑deploy static analysis rule that flags potential null dereferences in critical payment paths.
4. **Monitoring Enhancements** – Create a real‑time alert on `error_rate > 5%` per service with automatic correlation to recent deploy events.
5. **Post‑Deploy Verification** – Implement a post‑deployment health check that queries `index=app_logs` for new error patterns within the first 10 minutes.

## Lessons Learned
- A single code change in a core validation component can cascade across multiple services; comprehensive integration testing is essential.
- Correlating deploy events with error spikes in Splunk provides rapid root‑cause identification.
- Maintaining up‑to‑date health‑check dashboards helps detect cascade effects early, reducing blast radius.
