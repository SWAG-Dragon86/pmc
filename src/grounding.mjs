// Keep entry hazards and turn/terrain effects on the same Champions grounding rule.
const abilityOf = (build) => build.currentAbility ?? build.ability;
export function battleTypesOf(build, scene, catalog) {
  if (build.battleTypes) return build.battleTypes;
  if (abilityOf(build) === 'Mimicry') {
    const type = { Electric: 'Electric', Grassy: 'Grass', Psychic: 'Psychic', Misty: 'Fairy' }[scene.field.terrain];
    if (type) return [type];
  }
  return catalog.pokemon.find(entry => entry.id === build.species)?.types || [];
}
export function groundedOnTerrain(build, scene, catalog) {
  if (scene.field.gravity || build.item === 'Iron Ball') return true;
  return !battleTypesOf(build, scene, catalog).includes('Flying') &&
    !['Levitate', 'Eelevate'].includes(abilityOf(build)) && build.item !== 'Air Balloon';
}
