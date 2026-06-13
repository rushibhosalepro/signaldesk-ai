# Triage Report

## Blast Radius
- checkout-service
- payment-api
- order-service

## Severity
SEV-2 – Three core services (checkout, payment, order) are experiencing elevated error rates, with checkout-service peaking at 19.59% errors, payment-api at 13.18%, and order-service at 8.77%. All services show high request volumes, indicating a broad impact on production traffic.

## Error Snapshot
| Service | Error Rate (%) | Requests per Min |
|---------|----------------|------------------|
| checkout-service | 19.59 | 2261.01 |
| payment-api | 13.18 | 1724.54 |
| order-service | 8.77 | 922.31 |

## Suggestion to Investigation
Correlate these spikes with recent deployments (query index=deploy_events) and check infra metrics for the hosts running these services. Prioritize reviewing the latest checkout-service deployment and any shared dependencies that could cause cascading failures.

## Raw Agent Log
### agent
Alert payload:
```json
{
  "searchName": "checkout-service error rate > 5%",
  "receivedAt": "2026-06-13T07:09:04.433Z",
  "raw": {
    "sid": "scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781334540_557",
    "search_name": "checkout-service error rate > 5%",
    "app": "search",
    "owner": "rushibhosale84@gmail.com",
    "results_link": "http://LAPTOP-CM1KFM5O:8000/app/search/@go?sid=scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781334540_557",
    "result": {
      "err": "17.74"
    }
  },
  "result": {
    "err": "17.74"
  }
}
```

Use Splunk MCP tools to gather error rates and service data, then return the JSON result.

---

### agent


---

### agent
{"type":"text","text":"{\"results\":[{\"service\":\"checkout-service\",\"avg_err\":\"2.8739716312056736\",\"max_err\":\"19.59\",\"avg_rpm\":\"2261.0141843971633\"},{\"service\":\"payment-api\",\"avg_err\":\"1.7030496453900705\",\"max_err\":\"13.18\",\"avg_rpm\":\"1724.5390070921985\"},{\"service\":\"order-service\",\"avg_err\":\"1.070709219858156\",\"max_err\":\"8.77\",\"avg_rpm\":\"922.3120567375887\"}],\"truncated\":false,\"total_rows\":3}","structuredContent":{"results":[{"service":"checkout-service","avg_err":"2.8739716312056736","max_err":"19.59","avg_rpm":"2261.0141843971633"},{"service":"payment-api","avg_err":"1.7030496453900705","max_err":"13.18","avg_rpm":"1724.5390070921985"},{"service":"order-service","avg_err":"1.070709219858156","max_err":"8.77","avg_rpm":"922.3120567375887"}],"truncated":false,"total_rows":3}}

---

### agent
{
  "blastRadius": ["checkout-service", "payment-api", "order-service"],
  "severity": "SEV-2",
  "erroringServices": [
    {
      "service": "checkout-service",
      "latestErrorRate": 19.59,
      "requestsPerMin": 2261.01
    },
    {
      "service": "payment-api",
      "latestErrorRate": 13.18,
      "requestsPerMin": 1724.54
    },
    {
      "service": "order-service",
      "latestErrorRate": 8.77,
      "requestsPerMin": 922.31
    }
  ],
  "summary": "Three core services (checkout, payment, order) are experiencing elevated error rates, with checkout-service peaking at 19.59% errors, payment-api at 13.18%, and order-service at 8.77%. All services show high request volumes, indicating a broad impact on production traffic.",
  "suggestionToInvestigation": "Correlate these spikes with recent deployments (query index=deploy_events) and check infra metrics for the hosts running these services. Prioritize reviewing the latest checkout-service deployment and any shared dependencies that could cause cascading failures."
}