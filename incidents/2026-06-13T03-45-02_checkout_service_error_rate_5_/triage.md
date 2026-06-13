# Triage Report

## Blast Radius
- checkout-service
- payment-api
- order-service

## Severity
SEV-2 – Three services are experiencing elevated error rates. checkout-service is the primary affected service with a peak error rate of 19.71% and ~2270 requests per minute. payment-api and order-service also exceed the 5% threshold, with peak rates of 12.99% and 8.27% respectively.

## Error Snapshot
| Service | Error Rate (%) | Requests per Min |
|---------|----------------|------------------|
| checkout-service | 19.71 | 2269.09 |
| payment-api | 12.99 | 1725.91 |
| order-service | 8.27 | 926.04 |

## Suggestion to Investigation
Start with checkout-service: review recent deploys (index=deploy_events service="checkout-service"), examine error messages (index=app_logs service="checkout-service" error=*), and check host resource usage (index=infra_metrics host="checkout-host-01"). Then repeat the same steps for payment-api and order-service to determine if a common change or infrastructure issue is causing the cascade.

## Raw Agent Log
### agent
Alert payload:
```json
{
  "searchName": "checkout-service error rate > 5%",
  "receivedAt": "2026-06-13T03:45:02.061Z",
  "raw": {
    "sid": "scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781322300_379",
    "search_name": "checkout-service error rate > 5%",
    "app": "search",
    "owner": "rushibhosale84@gmail.com",
    "results_link": "http://LAPTOP-CM1KFM5O:8000/app/search/@go?sid=scheduler_cnVzaGliaG9zYWxlODRAZ21haWwuY29t__search__RMD5889505bb58ab6026_at_1781322300_379",
    "result": {
      "err": "17.985"
    }
  },
  "result": {
    "err": "17.985"
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
  "summary": "Three services are experiencing elevated error rates. checkout-service is the primary affected service with a peak error rate of 19.71% and ~2270 requests per minute. payment-api and order-service also exceed the 5% threshold, with peak rates of 12.99% and 8.27% respectively.",
  "suggestionToInvestigation": "Start with checkout-service: review recent deploys (index=deploy_events service=\"checkout-service\"), examine error messages (index=app_logs service=\"checkout-service\" error=*), and check host resource usage (index=infra_metrics host=\"checkout-host-01\"). Then repeat the same steps for payment-api and order-service to determine if a common change or infrastructure issue is causing the cascade."
}