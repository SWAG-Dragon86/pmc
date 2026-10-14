import { TYPES } from './model.mjs';
import { translateText } from './localization.mjs';

// The same type colors are used by the editor, battle cards and exported images.
export const TYPES_COLOR = {
  Fire:'#ce5841', Water:'#4b88cb', Electric:'#b38c18', Grass:'#548960',
  Ice:'#4d929f', Fighting:'#b6673c', Poison:'#97619e', Ground:'#af814f',
  Flying:'#788cb5', Psychic:'#c76487', Bug:'#839343', Rock:'#9b9167',
  Ghost:'#766c9c', Dragon:'#6f72bb', Dark:'#65596c', Steel:'#748c99',
  Fairy:'#bc79a5', Normal:'#8a8c84',
};
export function typeName(type, language) {
  return language==='en' ? type : translateText(TYPES[type] || type, language);
}
