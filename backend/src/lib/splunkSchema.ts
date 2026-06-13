export const SPLUNK_SCHEMA = `
## Available Splunk Indexes & Fields

### index=app_logs
Sampled every 30 seconds per service. Fields:
- service       (string)  e.g. "checkout-service", "payment-api", "order-service"
- host          (string)  e.g. "checkout-host-01", "payment-host-01", "order-host-01"
- error_rate    (float)   percentage of requests that errored, e.g. 18.4
- request_count (int)     requests in that 30-second window
- error         (string)  present only when spiking, e.g. "NullPointerException in PaymentValidator"
- _time         (epoch)   event timestamp

### index=infra_metrics
Sampled every 60 seconds per host. Fields:
- host          (string)
- cpu_pct       (float)   CPU usage percent
- mem_pct       (float)   memory usage percent
- note          (string)  optional, e.g. "scheduled_batch_reconciliation"
- _time         (epoch)

### index=deploy_events
One event per deployment. Fields:
- service       (string)
- version       (string)  e.g. "v2.4.1"
- action        (string)  "deploy"
- commit_sha    (string)
- environment   (string)  "production"
- deployer      (string)
- change_ticket (string)
- rollback_to   (string)  previous version
- host          (string)  "deploy-01"
- _time         (epoch)

## How to Use the splunk_run_query Tool
The MCP tool is called splunk_run_query and takes a "query" parameter.
Do NOT include earliest= or latest= time modifiers — they cause empty results.
The data is always available without time filters.

## Useful SPL Patterns (use these exactly, no time filters)

# Error rates by service
index=app_logs | stats avg(error_rate) as avg_err, max(error_rate) as max_err, avg(request_count) as avg_rpm by service | sort -max_err

# Recent deploys
index=deploy_events | table _time, service, version, deployer, change_ticket, rollback_to | sort -_time

# Error timeline for a specific service
index=app_logs service="checkout-service" | timechart span=2m avg(error_rate) as error_rate, avg(request_count) as rpm

# Error messages on a specific service
index=app_logs service="checkout-service" error=* | stats count by error | sort -count

# Infra metrics for a host
index=infra_metrics host="checkout-host-01" | timechart span=5m avg(cpu_pct) as cpu, avg(mem_pct) as mem

# Check cascade: which services errored after a deploy
index=app_logs error_rate>5 | stats max(error_rate) as peak_err, avg(request_count) as rpm by service | sort -peak_err

# Correlate deploy with error spike (look for deploy events near the alert time)
index=deploy_events service="checkout-service" | table _time, version, deployer, rollback_to
`;
