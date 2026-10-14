import { teamSaveability } from "./open-teams.mjs";

export const TEAM_FEED_STORAGE_KEY = "pmc.open-teams.feed.v1";

export function validateTeamFeed(bundled, incoming, catalog) {
  if (!incoming || !Array.isArray(incoming.teams) || !/^\d{4}-\d{2}-\d{2}$/.test(incoming.meta?.updatedAt || ""))
    throw new Error("在线队伍格式无效");
  if (incoming.meta.updatedAt < bundled.meta.updatedAt) throw new Error("在线队伍版本比内置数据旧");
  const seen = new Set();
  for (const team of incoming.teams) {
    if (!team || typeof team.id !== "string" || !team.id || seen.has(team.id) || !["official", "community"].includes(team.section) || !Array.isArray(team.members))
      throw new Error("在线队伍有重复或无效记录");
    seen.add(team.id);
    const valid=teamSaveability(team,catalog);
    if (!valid.saveable) throw new Error(`在线队伍 ${team.id} 不适用于当前版本：${valid.reason}`);
  }
  if (bundled.teams.some(team => !seen.has(team.id))) throw new Error("在线队伍缺少已有阵容");
  return incoming;
}

export function sameTeams(first, second) {
  return JSON.stringify(first.teams) === JSON.stringify(second.teams);
}

export function newestFeed(feeds) {
  return [...feeds].sort((a, b) => (b.meta.checkedAt || b.meta.updatedAt).localeCompare(a.meta.checkedAt || a.meta.updatedAt))[0];
}

export async function fetchTeamFeed(bundled, current, catalog, { baseUrl, android = false, fetcher = fetch } = {}) {
  const local = new URL('live-teams.json', baseUrl).href;
  let urls = [local];
  if (!android) {
    try {
      const config = await fetcher(new URL('team-feeds.json', baseUrl), {cache:'no-store',signal:AbortSignal.timeout(5000)});
      const data = await config.json();
      urls.push(...(data.mirrors || []).filter(url => /^https:\/\/[^\s]+\/live-teams\.json$/.test(url)));
    } catch { /* The same-site feed remains available without the optional mirror list. */ }
  }
  const results = await Promise.allSettled([...new Set(urls)].map(async url => {
    const address = new URL(url); address.searchParams.set('check', String(Date.now()));
    const response = await fetcher(address.href, { cache:'no-store', signal:AbortSignal.timeout(android ? 25000 : 12000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return validateTeamFeed(bundled, await response.json(), catalog);
  }));
  const valid = results.filter(result => result.status === 'fulfilled').map(result => result.value);
  if (!valid.length) throw new Error('updateFailed');
  // A successful response from a stale main site must not stop the mirror check.
  const fresh = newestFeed([...valid, current]);
  return { feed:fresh, changed:!sameTeams(current, fresh), checkedAt:new Date().toISOString() };
}
