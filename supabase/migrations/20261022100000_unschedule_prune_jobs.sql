select cron.unschedule(jobname)
from cron.job
where jobname in ('prune-stale-subscriptions', 'prune-activity-log', 'prune-login-failures');
