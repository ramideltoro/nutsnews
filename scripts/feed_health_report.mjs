#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertProductionOperation } from '../web/runtimeSafety.mjs';

assertProductionOperation('feed-health-report');

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const FEED_LIMIT = Math.max(1, Math.min(Number(process.env.FEED_HEALTH_LIMIT || 500), 5000));
const RUN_LIMIT = Math.max(1, Math.min(Number(process.env.WORKER_RUN_LIMIT || 100), 1000));
const OUT_DIR = path.join(process.cwd(), 'reports', 'feed-health');

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Cannot generate the production feed health report: Supabase URL or service role key is missing.');
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

async function supabase(pathname) {
  const response = await fetch(`${SUPABASE_URL}${pathname}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, Accept: 'application/json' },
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Supabase request failed ${response.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : [];
}

const [feeds, runs, feedHealth] = await Promise.all([
  supabase(`/rest/v1/rss_feeds?select=id,source,url,is_active,is_positive_source&order=is_active.desc,source.asc&limit=${FEED_LIMIT}`),
  supabase(`/rest/v1/worker_runs?select=run_started_at,run_completed_at,run_source,shard_index,feed_count,fetched_count,candidate_count,accepted_count,rejected_count,success,error_name&order=run_started_at.desc&limit=${RUN_LIMIT}`),
  supabase(`/rest/v1/feed_health?select=source,feed_url,last_checked_at,last_success_at,last_failure_at,last_status,consecutive_failure_count,last_article_count,last_accepted_count,last_rejected_count&order=last_checked_at.desc&limit=${FEED_LIMIT}`),
]);

if (![feeds, runs, feedHealth].every(Array.isArray)) {
  throw new Error('Supabase returned an unexpected response for the feed health report.');
}
const activeFeeds = feeds.filter((feed) => feed.is_active !== false);
const inactiveFeeds = feeds.length - activeFeeds.length;
const activeGoogleFeedCount = activeFeeds.filter((feed) =>
  /news\.google\.com/i.test(String(feed.url || '')),
).length;
const now = Date.now();
const staleHealthRecords = feedHealth.filter((record) => {
  const checkedAt = Date.parse(record.last_checked_at || '');
  return !Number.isFinite(checkedAt) || now - checkedAt > 24 * 60 * 60 * 1000;
});
const failedFeeds = feedHealth
  .filter((record) => Number(record.consecutive_failure_count || 0) > 0)
  .sort((a, b) => Number(b.consecutive_failure_count || 0) - Number(a.consecutive_failure_count || 0))
  .slice(0, 25);
const latestRun = runs[0] || null;
const latestHealthCheckAt = feedHealth[0]?.last_checked_at || null;

const report = {
  createdAt: new Date().toISOString(),
  feedCount: feeds.length,
  activeFeedCount: activeFeeds.length,
  inactiveFeedCount: inactiveFeeds,
  activeGoogleFeedCount,
  feedHealthRecordCount: feedHealth.length,
  staleHealthRecordCount: staleHealthRecords.length,
  latestHealthCheckAt,
  latestRun,
  failedFeeds,
};
const markdown = [
  '# NutsNews Feed Health Report',
  '',
  `Generated: ${report.createdAt}`,
  '',
  `- Feeds checked: ${feeds.length}`,
  `- Active feeds: ${activeFeeds.length}`,
  `- Inactive feeds: ${inactiveFeeds}`,
  `- Active Google News RSS feeds: ${activeGoogleFeedCount}`,
  `- Feed health records: ${feedHealth.length}`,
  `- Feed health records stale by more than 24 hours: ${staleHealthRecords.length}`,
  `- Latest feed health check: ${latestHealthCheckAt || 'none recorded'}`,
  latestRun ? `- Latest worker run: source=${latestRun.run_source}, shard=${latestRun.shard_index}, success=${latestRun.success}, feeds=${latestRun.feed_count}, fetched=${latestRun.fetched_count}, candidates=${latestRun.candidate_count}, accepted=${latestRun.accepted_count}` : '- Latest worker run: none found',
  '',
  '## Feeds with consecutive failures',
  '',
  'Feeds with consecutive failures: ' + failedFeeds.length,
  ...failedFeeds.map((feed) => '- ' + String(feed.source || feed.feed_url || 'unknown') + ': ' + Number(feed.consecutive_failure_count || 0) + ' consecutive failure(s), last checked ' + (feed.last_checked_at || 'never')) ,
  '',
].join('\n');

writeFileSync(path.join(OUT_DIR, 'feed-health-report.md'), markdown);
writeFileSync(path.join(OUT_DIR, 'feed-health-report.json'), JSON.stringify(report, null, 2));
console.log(markdown);
