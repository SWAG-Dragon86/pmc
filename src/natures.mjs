import {STAT_NAMES} from './model.mjs';
const PINNED=['Modest','Adamant','Timid','Jolly','Bold','Calm'];
export const natureLabel=n=>n?`${n.zh}（${n.plus===n.minus?'无增减':`${STAT_NAMES[n.plus]}↑、${STAT_NAMES[n.minus]}↓`}）`:'';
export function natureOptions(natures) {
  return [...natures].sort((a,b)=>(PINNED.includes(a.name)?PINNED.indexOf(a.name):99)-(PINNED.includes(b.name)?PINNED.indexOf(b.name):99)).map(n=>[n.name,natureLabel(n)]);
}
