import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createBuild, defaultScene } from "../src/model.mjs";
import { damageFor, simulateTurn, turnLimits } from "../src/engine.mjs";
import { openingBranches } from "../src/opening.mjs";

const catalog = JSON.parse(readFileSync("src/data/catalog.json", "utf8"));
const build = (species, move, ability) => ({
  ...createBuild(catalog, species),
  moves: [move, "", "", ""],
  selected: 0,
  ...(ability ? { ability } : {}),
});

test("Mummy and Wandering Spirit change contact abilities, while Long Reach avoids contact", () => {
  const mummy = defaultScene(catalog);
  mummy.actors[0] = build("weavile", "icepunch", "Pressure");
  mummy.actors[0].boosts.atk = -6;
  mummy.actors[2] = build("cofagrigus", "nastyplot", "Mummy");
  const mummyResult = simulateTurn(mummy, catalog);
  assert.equal(mummyResult.error, undefined);
  assert(mummyResult.log.some((line) => line.includes("木乃伊") && line.includes("压迫感")));

  const spirit = defaultScene(catalog);
  spirit.actors[0] = build("weavile", "icepunch", "Pressure");
  spirit.actors[0].boosts.atk = -6;
  spirit.actors[2] = build("runerigus", "irondefense", "Wandering Spirit");
  const spiritResult = simulateTurn(spirit, catalog);
  assert.equal(spiritResult.error, undefined);
  assert(spiritResult.log.some((line) => line.includes("游魂") && line.includes("交换")));

  const distant = structuredClone(mummy);
  distant.actors[0] = build("decidueye", "leafblade", "Long Reach");
  distant.actors[0].boosts.atk = -6;
  const distantResult = simulateTurn(distant, catalog);
  assert.equal(distantResult.error, undefined);
  assert(!distantResult.log.some((line) => line.includes("变为木乃伊")));
});

test("Magician and Pickpocket transfer eligible held items after damage", () => {
  const magician = defaultScene(catalog);
  magician.actors[0] = build("delphox", "flamethrower", "Magician");
  magician.actors[0].boosts.spa = -6;
  magician.actors[2] = build("pikachu", "reflect", "Static");
  magician.actors[2].item = "Leftovers";
  const magicianResult = simulateTurn(magician, catalog);
  assert.equal(magicianResult.error, undefined);
  assert(magicianResult.log.some((line) => line.includes("魔术师") && line.includes("吃剩的东西")));

  const pickpocket = defaultScene(catalog);
  pickpocket.actors[0] = build("pikachu", "thunderpunch", "Static");
  pickpocket.actors[0].boosts.atk = -6;
  pickpocket.actors[0].item = "Leftovers";
  pickpocket.actors[2] = build("weavile", "sunnyday", "Pickpocket");
  const pickpocketResult = simulateTurn(pickpocket, catalog);
  assert.equal(pickpocketResult.error, undefined);
  assert(pickpocketResult.log.some((line) => line.includes("顺手牵羊") && line.includes("吃剩的东西")));
});

test("Symbiosis immediately passes an item after its ally consumes a berry", () => {
  const scene = defaultScene(catalog);
  scene.mode = "double";
  scene.actors[0] = build("pikachu", "quickattack", "Static");
  scene.actors[0].boosts.atk = -6;
  scene.actors[1].present = false;
  scene.actors[2] = build("pikachu", "reflect", "Static");
  scene.actors[2].hp = 50;
  scene.actors[2].item = "Sitrus Berry";
  scene.actors[3] = build("florges", "sunnyday", "Symbiosis");
  scene.actors[3].item = "Leftovers";
  const result = simulateTurn(scene, catalog);
  assert.equal(result.error, undefined);
  assert(result.log.some((line) => line.includes("共生") && line.includes("吃剩的东西")));
});

test("Receiver copies a copyable Ability from an ally that faints before it acts", () => {
  const scene = defaultScene(catalog);
  scene.mode = "double";
  scene.actors[0] = build("azumarill", "aquajet", "Huge Power");
  scene.actors[0].hp = 1;
  scene.actors[1] = build("passimian", "closecombat", "Receiver");
  scene.actors[2] = build("pikachu", "quickattack", "Static");
  scene.actors[3].present = false;
  const result = simulateTurn(scene, catalog);
  assert.equal(result.error, undefined);
  assert(result.log.some((line) => line.includes("接球手") && line.includes("大力士")));
});

test("Berserk raises Special Attack on the half-HP crossing and Sand Spit changes weather", () => {
  const berserk = defaultScene(catalog);
  berserk.actors[0] = build("pikachu", "quickattack", "Static");
  berserk.actors[2] = build("drampa", "dragonpulse", "Berserk");
  berserk.actors[2].hp = 51;
  const berserkResult = simulateTurn(berserk, catalog);
  assert.equal(berserkResult.error, undefined);
  assert(berserkResult.log.some((line) => line.includes("怒火冲天") && line.includes("特攻 +1")));

  const sand = defaultScene(catalog);
  sand.actors[0] = build("pikachu", "quickattack", "Static");
  sand.actors[0].boosts.atk = -6;
  sand.actors[2] = build("sandaconda", "earthquake", "Sand Spit");
  const sandResult = simulateTurn(sand, catalog);
  assert.equal(sandResult.error, undefined);
  assert(sandResult.log.some((line) => line.includes("吐沙") && line.includes("沙暴")));
  assert(sandResult.weatherResults.some((row) => row.weather === "Sand"));
});

test("Aftermath and Innards Out damage the attacker on a move-caused knockout", () => {
  const aftermath = defaultScene(catalog);
  aftermath.actors[0] = build("weavile", "icepunch", "Pressure");
  aftermath.actors[2] = build("garbodor", "sunnyday", "Aftermath");
  aftermath.actors[2].hp = 1;
  const aftermathResult = simulateTurn(aftermath, catalog);
  assert.equal(aftermathResult.error, undefined);
  assert(aftermathResult.log.some((line) => line.includes("诱爆") && line.includes("1/4")));
  assert(aftermathResult.afterAction[0].mean < 76);

  const damp = structuredClone(aftermath);
  damp.actors[0] = build("swampert", "bite", "Damp");
  const dampResult = simulateTurn(damp, catalog);
  assert.equal(dampResult.error, undefined);
  assert(!dampResult.log.some((line) => line.includes("诱爆造成")));

  const innards = defaultScene(catalog);
  innards.actors[0] = build("charizard", "flamethrower", "Blaze");
  innards.actors[2] = build("victreebelmega", "sunnyday", "Innards Out");
  innards.actors[2].hp = 10;
  const innardsResult = simulateTurn(innards, catalog);
  assert.equal(innardsResult.error, undefined);
  assert(innardsResult.log.some((line) => line.includes("飞出的内在物")));
  assert(innardsResult.afterAction[0].mean < 100);
});

test("Opportunist copies opposing boosts and Mirror Armor reflects opponent drops", () => {
  const opportunist = defaultScene(catalog);
  opportunist.mode = "double";
  opportunist.actors[0] = build("garchomp", "swordsdance", "Rough Skin");
  opportunist.actors[0].boosts.spe = 6;
  opportunist.actors[1].present = false;
  opportunist.actors[2] = build("espathra", "storedpower", "Opportunist");
  opportunist.actors[3].present = false;
  const opportunistResult = simulateTurn(opportunist, catalog);
  assert.equal(opportunistResult.error, undefined);
  assert(opportunistResult.log.some((line) => line.includes("跟风") && line.includes("攻击 +2")));

  const mirror = defaultScene(catalog);
  mirror.actors[0] = build("arcanine", "snarl", "Intimidate");
  mirror.actors[2] = build("corviknight", "sunnyday", "Mirror Armor");
  const mirrorResult = simulateTurn(mirror, catalog);
  assert.equal(mirrorResult.error, undefined);
  assert.equal(mirrorResult.opening[0].boosts[2].atk, 0);
  assert.equal(mirrorResult.opening[0].boosts[0].atk, -1);
});

test("Lightning Rod redirects a single-target Electric move and raises Special Attack", () => {
  const scene = defaultScene(catalog);
  scene.mode = "double";
  scene.actors[0] = build("pikachu", "thunderbolt", "Static");
  scene.actors[1].present = false;
  scene.actors[2] = build("pikachu", "reflect", "Static");
  scene.actors[3] = build("rhyperior", "earthquake", "Lightning Rod");
  const result = simulateTurn(scene, catalog);
  assert.equal(result.error, undefined);
  assert.equal(result.remaining.mean, 100);
  assert(result.log.some((line) => line.includes("避雷针") && line.includes("特攻 +1")));
});

test("Armor Tail and Queenly Majesty block opposing priority, while Mold Breaker bypasses", () => {
  const armor = defaultScene(catalog);
  armor.actors[0] = build("lycanrocdusk", "accelerock", "Tough Claws");
  armor.actors[2] = build("farigiraf", "sunnyday", "Armor Tail");
  const blocked = simulateTurn(armor, catalog);
  assert.equal(blocked.error, undefined);
  assert.equal(blocked.damage.max, 0);
  assert(blocked.log.some((line) => line.includes("尾甲") && line.includes("拦下")));

  const bypass = defaultScene(catalog);
  bypass.actors[0] = build("tinkaton", "fakeout", "Mold Breaker");
  bypass.actors[2] = build("farigiraf", "sunnyday", "Armor Tail");
  const bypassed = simulateTurn(bypass, catalog);
  assert.equal(bypassed.error, undefined);
  assert(bypassed.damage.mean > 0);

  const queen = defaultScene(catalog);
  queen.mode = "double";
  queen.actors[0] = build("lycanrocdusk", "accelerock", "Tough Claws");
  queen.actors[1].present = false;
  queen.actors[2] = build("pikachu", "reflect", "Static");
  queen.actors[3] = build("tsareena", "sunnyday", "Queenly Majesty");
  const queenResult = simulateTurn(queen, catalog);
  assert.equal(queenResult.error, undefined);
  assert.equal(queenResult.damage.max, 0);
  assert(queenResult.log.some((line) => line.includes("女王的威严") && line.includes("拦下")));
});

test("entry Abilities set terrain, clear screens, reset an ally, and heal a partner", () => {
  const scene=defaultScene(catalog);scene.mode="double";
  scene.actors[0]=build("raichumegax","protect","Electric Surge");
  scene.actors[0].boosts.atk=3;
  scene.actors[1]=build("slowkinggalar","psychic","Curious Medicine");
  scene.actors[2]=build("mrrime","reflect","Screen Cleaner");scene.actors[2].hp=50;
  scene.actors[3]=build("sinistcha","matchagotcha","Hospitality");
  scene.field.attacker.isReflect=true;scene.field.defender.isLightScreen=true;
  const [state]=openingBranches(scene,catalog);
  assert.equal(state.scene.field.terrain,"Electric");
  assert.equal(state.scene.field.attacker.isReflect,false);
  assert.equal(state.scene.field.defender.isLightScreen,false);
  assert.equal(state.scene.actors[0].boosts.atk,0);
  assert(state.hp[2]/state.max[2]>0.5);
});

test("Trace branches across opposing copyable Abilities and Imposter copies the opposite slot", () => {
  const trace=defaultScene(catalog);trace.mode="double";
  trace.actors[0]=build("alakazammega","psychic","Trace");trace.actors[1].present=false;
  trace.actors[2]=build("pikachu","reflect","Static");
  trace.actors[3]=build("rhyperior","earthquake","Lightning Rod");
  const traced=openingBranches(trace,catalog);
  assert.equal(traced.length,2);
  assert.deepEqual(new Set(traced.map(s=>s.scene.actors[0].currentAbility)),new Set(["Static","Lightning Rod"]));
  assert(traced.every(s=>s.p===0.5));

  const imposter=defaultScene(catalog);
  imposter.actors[0]=build("ditto","transform","Imposter");
  imposter.actors[2]=build("charizard","flamethrower","Blaze");
  const result=simulateTurn(imposter,catalog);
  assert.equal(result.error,undefined);
  assert(result.opening[0].log.some(line=>line.includes("变身者变成了")));
});

test("Spicy Spray burns a damaging attacker and Electromorphosis charges before its move", () => {
  const spicy=defaultScene(catalog);
  spicy.actors[0]=build("weavile","icepunch","Pressure");
  spicy.actors[2]=build("scovillainmega","overheat","Spicy Spray");
  spicy.actors[2].boosts.spa=-6;
  const burned=simulateTurn(spicy,catalog);
  assert.equal(burned.error,undefined);
  assert(burned.log.some(line=>line.includes("辣椒喷发")&&line.includes("灼伤")));
  assert(burned.afterEnd[0].mean<burned.afterAction[0].mean);

  const charged=defaultScene(catalog);
  charged.actors[0]=build("pikachu","quickattack","Static");charged.actors[0].boosts.atk=-6;
  charged.actors[2]=build("bellibolt","thunderbolt","Electromorphosis");
  const chargedResult=simulateTurn(charged,catalog);
  assert.equal(chargedResult.error,undefined);
  assert(chargedResult.log.some(line=>line.includes("电力转换进入充电状态")));
});

test("Good as Gold and Magic Bounce stop or reflect opposing status moves", () => {
  const gold=defaultScene(catalog);
  gold.actors[0]=build("pikachu","thunderwave","Static");
  gold.actors[2]=build("gholdengo","shadowball","Good as Gold");
  const goldResult=simulateTurn(gold,catalog);
  assert.equal(goldResult.error,undefined);
  assert(goldResult.log.some(line=>line.includes("黄金之躯挡下")));

  const bounce=defaultScene(catalog);
  bounce.actors[0]=build("pikachu","thunderwave","Static");
  bounce.actors[2]=build("espeon","calmmind","Magic Bounce");
  const bounceResult=simulateTurn(bounce,catalog);
  assert.equal(bounceResult.error,undefined);
  assert(bounceResult.log.some(line=>line.includes("魔法镜反弹")));
});

test("conditional damage Abilities start off and activate only from the current scene", () => {
  const scene=defaultScene(catalog);
  scene.actors[0]=build("houndoom","flamethrower","Flash Fire");
  scene.actors[2]=build("pikachu","reflect","Static");
  const flash=damageFor(scene.actors[0],scene.actors[2],"flamethrower",scene,catalog);
  scene.actors[0].ability="Early Bird";
  const plain=damageFor(scene.actors[0],scene.actors[2],"flamethrower",scene,catalog);
  assert.equal(flash.mean,plain.mean);

  const analytic=defaultScene(catalog);
  analytic.actors[0]=build("starmie","surf","Analytic");
  analytic.actors[0].nature="Quiet";
  analytic.actors[2]=build("charizard","sunnyday","Blaze");
  analytic.actors[2].nature="Jolly";analytic.actors[2].points.spe=32;
  const slower=damageFor(analytic.actors[0],analytic.actors[2],"surf",analytic,catalog);
  analytic.actors[2].nature="Quiet";analytic.actors[2].points.spe=0;
  const faster=damageFor(analytic.actors[0],analytic.actors[2],"surf",analytic,catalog);
  assert(slower.mean>faster.mean);
});

test("Quick Draw branches turn order and Shed Skin cures before residual damage", () => {
  const quick=defaultScene(catalog);
  quick.actors[0]=build("slowbrogalar","psychic","Quick Draw");
  quick.actors[2]=build("pikachu","thunderbolt","Static");
  const quickResult=simulateTurn(quick,catalog);
  assert.equal(quickResult.error,undefined);
  assert(quickResult.timeline.some(row=>row.actor===0&&Math.abs(row.probability-30)<0.001));
  assert(quickResult.timeline.some(row=>row.actor===2&&Math.abs(row.probability-70)<0.001));

  const shed=defaultScene(catalog);
  shed.actors[0]=build("arbok","protect","Shed Skin");shed.actors[0].hp=10;shed.actors[0].status="psn";
  shed.actors[2]=build("pikachu","reflect","Static");
  const shedResult=simulateTurn(shed,catalog);
  assert.equal(shedResult.error,undefined);
  assert.equal(shedResult.afterEnd[0].min,0);
  assert(shedResult.afterEnd[0].max>0);
});

test("Harvest restores a Berry at the end of the current turn and branches outside sun", () => {
  const scene=defaultScene(catalog);
  scene.actors[0]=build("weavile","bite","Pressure");scene.actors[0].boosts.atk=-6;
  scene.actors[2]=build("trevenant","reflect","Harvest");scene.actors[2].hp=30;scene.actors[2].item="Sitrus Berry";
  const result=simulateTurn(scene,catalog);
  assert.equal(result.error,undefined);
  assert(result.branches>1);
  assert(result.afterEnd[2].max>result.afterEnd[2].min);
});

test("Pickup automatically takes the most recently consumed item from a living Pokémon", () => {
  const scene=defaultScene(catalog);scene.mode="double";
  scene.actors[0]=build("pikachu","quickattack","Static");scene.actors[0].boosts.atk=-6;
  scene.actors[1].present=false;
  scene.actors[2]=build("pikachu","reflect","Static");scene.actors[2].hp=50;scene.actors[2].item="Sitrus Berry";
  scene.actors[3]=build("dedenne","sunnyday","Pickup");scene.actors[3].item="";
  const result=simulateTurn(scene,catalog);
  assert.equal(result.error,undefined);
  assert(result.log.some(line=>line.includes("捡拾获得")&&line.includes("文柚果")));
});

test("random contact and additional-effect Abilities are treated as blank", () => {
  const flameBody=defaultScene(catalog);
  flameBody.actors[0]=build("lycanrocdusk","accelerock","Tough Claws");
  flameBody.actors[0].boosts.atk=-6;
  flameBody.actors[2]=build("chandelure","sunnyday","Flame Body");
  const flameResult=simulateTurn(flameBody,catalog);
  assert.equal(flameResult.error,undefined);
  assert.equal(flameResult.afterEnd[0].mean,flameResult.afterAction[0].mean);

  const poisonTouch=defaultScene(catalog);
  poisonTouch.actors[0]=build("sneasler","quickattack","Poison Touch");
  poisonTouch.actors[0].boosts.atk=-6;
  poisonTouch.actors[2]=build("pikachu","reflect","Static");
  const poisonResult=simulateTurn(poisonTouch,catalog);
  assert.equal(poisonResult.error,undefined);
  assert.equal(poisonResult.afterEnd[2].mean,poisonResult.afterAction[2].mean);
});

test("Rivalry is always treated as blank without gender inputs", () => {
  const scene = defaultScene(catalog);
  scene.actors[0] = build("pyroar", "flamethrower", "Rivalry");
  scene.actors[2] = build("pikachu", "reflect", "Static");
  const rivalry = damageFor(
    scene.actors[0],
    scene.actors[2],
    "flamethrower",
    scene,
    catalog,
  );
  scene.actors[0].currentAbility = "";
  const blank = damageFor(
    scene.actors[0],
    scene.actors[2],
    "flamethrower",
    scene,
    catalog,
  );
  assert.deepEqual(rivalry.rolls, blank.rolls);
  assert(!turnLimits(scene, catalog).some((line) => line.includes("斗争心")));
});

test("Supreme Overlord uses the saved 0-5 fainted ally count", () => {
  const scene = defaultScene(catalog);
  scene.actors[0] = build(
    "kingambit",
    "kowtowcleave",
    "Supreme Overlord",
  );
  scene.actors[2] = build("corviknight", "reflect", "Pressure");
  const zero = damageFor(
    scene.actors[0],
    scene.actors[2],
    "kowtowcleave",
    scene,
    catalog,
  );
  scene.actors[0].faintedAllies = 5;
  const five = damageFor(
    scene.actors[0],
    scene.actors[2],
    "kowtowcleave",
    scene,
    catalog,
  );
  assert(five.mean > zero.mean * 1.4);
  assert(five.mean < zero.mean * 1.6);
  assert(!turnLimits(scene, catalog).some((line) => line.includes("大将")));
});

test("Last Respects shares the fainted ally count and gains 50 power per ally", () => {
  const scene = defaultScene(catalog);
  scene.actors[0] = build("houndstone", "lastrespects", "Fluffy");
  scene.actors[2] = build("corviknight", "reflect", "Pressure");
  const zero = damageFor(
    scene.actors[0],
    scene.actors[2],
    "lastrespects",
    scene,
    catalog,
  );
  scene.actors[0].faintedAllies = 5;
  const five = damageFor(
    scene.actors[0],
    scene.actors[2],
    "lastrespects",
    scene,
    catalog,
  );
  assert(five.mean > zero.mean * 5);
  assert(five.mean < zero.mean * 7);
});
