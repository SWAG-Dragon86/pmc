import React from 'react';
import { shareBalls, ballName } from './share-balls.mjs';
import { shareText } from './sharing-language.mjs';

export default function ShareBallSettings({value,onChange,language}) {
  const selected=shareBalls.find(ball=>ball.name===value);
  return <section className="panel settings-card share-ball-settings">
    <h2>{shareText('ballTheme',language)}</h2><p>{shareText('ballThemeHint',language)}</p>
    <details className="share-ball-picker"><summary><img src={`${import.meta.env.BASE_URL}${selected.sprite}`} alt=""/><span>{ballName(selected,language)}</span><span aria-hidden="true">⌄</span></summary>
    <div className="share-ball-grid">{shareBalls.map(ball=><button type="button" key={ball.name}
      className={value===ball.name?'selected':''} aria-pressed={value===ball.name} onClick={event=>{onChange(ball.name);event.currentTarget.closest('details').open=false;}}>
      <img src={`${import.meta.env.BASE_URL}${ball.sprite}`} alt="" loading="lazy"/>
      <span>{ballName(ball,language)}</span>
    </button>)}</div></details>
  </section>;
}
