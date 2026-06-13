## Blast Radius
- checkout-service

## Severity
SEV-2 – error rate 18.4% exceeds 10% threshold.

## Error Snapshot
| Service | Error Rate (%) | Requests per Min |
|---------|----------------|------------------|
| checkout-service | 18.4 | 2247 |

## Raw Splunk Findings
```
index=* service=checkout-service | stats count as request_count, sum(eval(status>=500)) as error_count by host, service | eval error_rate=round(error_count*100/request_count,1)
```
Results:
- checkout-host-01: request_count=141 (no error data returned)
- deploy-01: request_count=1

## Suggestion to Investigation
Prioritize checking the checkout-service logs on checkout-host-01 for recent 5xx errors.