import React from 'react';
import { battleCards } from './battle-view.mjs';
import { shareText, buildName, gameName } from './sharing-language.mjs';
import { typeName } from './move-types.mjs';

const percentage = value => `${Math.max(0, value || 0).toFixed(1)}%`;
export default function BattleComparison({ scene, catalog, language, enabled, onSelect }) {
  const t = key => shareText(key, language);
  const rows = enabled ? battleCards(scene, catalog) : scene.actors.map((build,index)=>({build,index,moves:build.moves.map(id=>({id})),target:scene.actors[index<2?scene.target:build.target||0]}))
    .filter(row => scene.mode === 'double' || [0,2].includes(row.index));
  return <div className="battle-comparison" aria-label={t('scene')}>
    {[0,1].map(side=><div className={`battle-comparison-side ${side?'defense':'offense'}`} key={side}>
      <div className="comparison-side-label">{t(side?'defend':'attack')}</div>
      {rows.filter(row=>(row.index<2?0:1)===side).map(row=>{
        const {build,index,target,moves}=row;
        return <article className={`comparison-pokemon ${!build.present?'absent':''}`} key={index}>
          <header><h3>{buildName(build,catalog,language)}<span>{index%2?'B':'A'}</span></h3>
            <img src={`${import.meta.env.BASE_URL}sprites/${build.species}.png`} alt={gameName('pokemon',catalog.pokemon.find(p=>p.id===build.species),language)}/>
            <small>{t('target')} · {buildName(target,catalog,language)}</small>
          </header>
          <div className="comparison-moves">{moves.map((damage,moveIndex)=>{
            const move=catalog.moves[damage.id],selected=build.selected===moveIndex;
            const status=move?.category==='Status';
            const ko=enabled&&!damage.error&&!status?damage.ko||0:0;
            return <button type="button" className={`comparison-move ${selected?'selected':''}`} key={moveIndex}
              aria-pressed={selected} disabled={!damage.id||!build.present} onClick={()=>onSelect(index,moveIndex)}>
              <div className="comparison-move-title">{move&&<img className="comparison-move-type" src={`${import.meta.env.BASE_URL}types/${move.type.toLowerCase()}.png`} alt={typeName(move.type,language)} title={typeName(move.type,language)}/>}<b>{move?gameName('moves',move,language):t('empty')}</b>
                {ko>0&&<span className={`comparison-ko ${ko>=99.999?'certain':'possible'}`}>{t(ko>=99.999?'sureKO':'possibleKO')}</span>}
              </div>
              <div className="comparison-move-damage"><span className="comparison-track"><i style={{width:`${Math.min(100,damage.mean||0)}%`,background:ko>0?'#f47b4a':'#12b99a'}}/></span>
                <strong>{!enabled||damage.error?'—':status?t('statusMove'):`${percentage(damage.min)}–${percentage(damage.max)}`}</strong></div>
              {ko>0&&<small>{t('ko')} {percentage(ko)}</small>}
              {selected&&<small className="comparison-selected">{index===3&&!build.actionEnabled?t('inactive'):t('selected')}</small>}
            </button>;
          })}</div>
          {index===3&&<label className="comparison-action-toggle"><input type="checkbox" checked={!!build.actionEnabled}
            onChange={event=>onSelect(index,build.selected,event.target.checked)}/>{t('activate')}</label>}
        </article>;
      })}
    </div>)}
  </div>;
}
