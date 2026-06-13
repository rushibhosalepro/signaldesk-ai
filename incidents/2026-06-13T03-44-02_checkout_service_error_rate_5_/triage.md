# Triage Report

## Blast Radius
- checkout-service
- payment-api
- order-service

## Severity
SEV-2 – Three core services (checkout, payment, order) are experiencing elevated error rates, with checkout-service peaking at ~19.7% errors, payment-api at ~13%, and order-service at ~8%. All exceed the alert threshold of 5% and together affect multiple customer‑facing functions.

## Error Snapshot
| Service | Error Rate (%) | Requests per Min |
|---------|----------------|------------------|
| checkout-service | 19.71 | 2269.09 |
| payment-api | 12.99 | 1725.91 |
| order-service | 8.27 | 926.04 |

## Suggestion to Investigation
Correlate these spikes with recent deployments (run the recent deploys query) and check infra metrics for the hosts running these services. Prioritize the checkout-service as it has the highest error rate, then verify if any recent code changes or resource constraints (CPU/memory) could be causing the cascade.

## Raw Agent Log
### agent
Alert payload:
```json
{
  "searchName": "checkout-service error rate > 5%",
  "receivedAt": "2026-06-13T03:44:02.482Z",
  "raw": {
    "sid": "scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781322240_378",
    "search_name": "checkout-service error rate > 5%",
    "app": "search",
    "owner": "rushibhosale84@gmail.com",
    "results_link": "http://LAPTOP-CM1KFM5O:8000/app/search/@go?sid=scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781322240_378",
    "result": {
      "err": "18.495"
    }
  },
  "result": {
    "err": "18.495"
  }
}
```

Use Splunk MCP tools to gather error rates and service data, then return the JSON result.

---

### agent


---

### agent
{"type":"text","text":"{\"results\":[{\"service\":\"checkout-service\",\"avg_err\":\"2.8592198581560284\",\"max_err\":\"19.71\",\"avg_rpm\":\"2269.0921985815603\"},{\"service\":\"payment-api\",\"avg_err\":\"1.6841134751773048\",\"max_err\":\"12.99\",\"avg_rpm\":\"1725.9078014184397\"},{\"service\":\"order-service\",\"avg_err\":\"1.0195035460992903\",\"max_err\":\"8.27\",\"avg_rpm\":\"926.0354609929078\"}],\"truncated\":false,\"total_rows\":3}","structuredContent":{"results":[{"service":"checkout-service","avg_err":"2.8592198581560284","max_err":"19.71","avg_rpm":"2269.0921985815603"},{"service":"payment-api","avg_err":"1.6841134751773048","max_err":"12.99","avg_rpm":"1725.9078014184397"},{"service":"order-service","avg_err":"1.0195035460992903","max_err":"8.27","avg_rpm":"926.0354609929078"}],"truncated":false,"total_rows":3}}

---

### agent
{
  "blastRadius": ["checkout-service", "payment-api", "order-service"],
  "severity": "SEV-2",
  "erroringServices": [
    {
      "service": "checkout-service",
      "latestErrorRate": 19.71,
      "requestsPerMin": 2269.09
    },
    {
      "service": "payment-api",
      "latestErrorRate": 12.99,
      "requestsPerMin": 1725.91
    },
    {
      "service": "order-service",
      "latestErrorRate": 8.27,
      "requestsPerMin": 926.04
    }
  ],
  "summary": "Three core services (checkout, payment, order) are experiencing elevated error rates, with checkout-service peaking at ~19.7% errors, payment-api at ~13%, and order-service at ~8%. All exceed the alert threshold of 5% and together affect multiple customer‑facing functions.",
  "suggestionToInvestigation": "Correlate these spikes with recent deployments (run the recent deploys query) and check infra metrics for the hosts running these services. Prioritize the checkout-service as it has the highest error rate, then verify if any recent code changes or resource constraints (CPU/memory) could be causing the cascade."
}