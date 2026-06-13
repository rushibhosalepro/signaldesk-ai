# Triage Report

## Blast Radius
- checkout-service
- payment-api
- order-service

## Severity
SEV-2 – Three services (checkout-service, payment-api, order-service) are experiencing elevated error rates, with checkout-service peaking at 19.71% and payment-api at 12.99%. All exceed the alert threshold of 5% and affect multiple services, indicating a moderate‑wide issue.

## Error Snapshot
| Service | Error Rate (%) | Requests per Min |
|---------|----------------|------------------|
| checkout-service | 19.71 | 2269.09 |
| payment-api | 12.99 | 1725.91 |
| order-service | 8.27 | 926.04 |

## Suggestion to Investigation
Correlate these spikes with recent deployments (run the recent deploys query) and check infra metrics for the affected hosts to see if resource saturation contributed. Prioritize investigating checkout-service and payment-api due to >10% error rates, and verify if a recent code change or shared dependency is causing the cascade.

## Raw Agent Log
### agent
Alert payload:
```json
{
  "searchName": "checkout-service error rate > 5%",
  "receivedAt": "2026-06-13T03:46:02.219Z",
  "raw": {
    "sid": "scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781322360_380",
    "search_name": "checkout-service error rate > 5%",
    "app": "search",
    "owner": "rushibhosale84@gmail.com",
    "results_link": "http://LAPTOP-CM1KFM5O:8000/app/search/@go?sid=scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781322360_380",
    "result": {
      "err": "17.72"
    }
  },
  "result": {
    "err": "17.72"
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
  "summary": "Three services (checkout-service, payment-api, order-service) are experiencing elevated error rates, with checkout-service peaking at 19.71% and payment-api at 12.99%. All exceed the alert threshold of 5% and affect multiple services, indicating a moderate‑wide issue.",
  "suggestionToInvestigation": "Correlate these spikes with recent deployments (run the recent deploys query) and check infra metrics for the affected hosts to see if resource saturation contributed. Prioritize investigating checkout-service and payment-api due to >10% error rates, and verify if a recent code change or shared dependency is causing the cascade."
}