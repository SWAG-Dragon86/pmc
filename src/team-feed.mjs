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
