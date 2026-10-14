import { previewDamage } from './engine.mjs';
import { activeIndices } from './model.mjs';

const cache = new WeakMap();
export function battleCards(scene, catalog) {
  if (cache.has(scene)) return cache.get(scene);
  const rows = activeIndices(scene).map(index => {
    const build = scene.actors[index], targetIndex = index < 2 ? scene.target : build.target || 0;
    const target = scene.actors[targetIndex];
    const moves = build.moves.map(id => {
      if (!id) return { id, error:'empty' };
      try { return { id, ...previewDamage(build, target, id, scene, catalog) }; }
      catch (error) { return { id, error:error.message }; }
    });
    return { index, build, targetIndex, target, moves };
  });
  cache.set(scene, rows);
  return rows;
}
