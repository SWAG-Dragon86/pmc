import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { savePublicMembers, teamSaveability } from "../src/open-teams.mjs";

const catalog=JSON.parse(readFileSync("src/data/catalog.json","utf8"));
const data=JSON.parse(readFileSync("src/data/open-teams.json","utf8"));

test("public teams are split into official and community sections",()=>{
 assert(data.teams.some(team=>team.section==="official"));
 assert(data.teams.some(team=>team.section==="community"));
 assert(data.teams.length>=50);
 assert(data.meta.sources.some(source=>source.name==="MunchStats"));
 assert(data.meta.sources.some(source=>source.name==="VGCPastes Repository"));
});

test("only complete, current six-member teams can be saved",()=>{
 const official=data.teams.find(team=>team.section==="official");
 const community=data.teams.find(team=>team.section==="community");
 assert.equal(teamSaveability(official,catalog).saveable,true);
 assert.equal(teamSaveability(community,catalog).saveable,true);
 const incomplete=structuredClone(official);incomplete.members[0].points=null;
 assert.equal(teamSaveability(incomplete,catalog).saveable,false);
});

test("every embedded public team has a unique id and passes current catalog validation",()=>{
 const ids=new Set();
 for(const team of data.teams){
  assert(!ids.has(team.id),`duplicate team id: ${team.id}`);ids.add(team.id);
  assert.equal(team.members.length,6,`${team.id} should have six members`);
  assert.equal(teamSaveability(team,catalog).saveable,true,`${team.id} should be loadable`);
  for(const member of team.members){
   assert.equal(Object.values(member.points).reduce((sum,value)=>sum+value,0),66,`${team.id}/${member.species} should use 66 points`);
  }
 }
});

test("saving a public team skips exact copies but permits a newly edited local copy",()=>{
 const team=data.teams.find(entry=>entry.section==="community");
 const first=savePublicMembers([],team,[0,1,2,3,4,5],catalog);
 assert.equal(first.added,6);assert.equal(first.records.length,6);
 const duplicate=savePublicMembers(first.records,team,[0,1,2,3,4,5],catalog);
 assert.equal(duplicate.added,0);assert.equal(duplicate.skipped,6);
 const edited=structuredClone(first.records);edited[0].name="我的龙头地鼠";
 const restored=savePublicMembers(edited,team,[0],catalog);
 assert.equal(restored.added,1);assert.equal(restored.records.length,7);
});
