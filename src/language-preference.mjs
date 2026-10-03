export function initialLanguage(saved,deviceLocale){
  if(['zhHans','zhHant','ja','ko','en'].includes(saved))return saved;
  const locale=String(deviceLocale||'').replaceAll('_','-').toLowerCase();
  if(locale==='ja'||locale.startsWith('ja-'))return 'ja';
  if(locale==='ko'||locale.startsWith('ko-'))return 'ko';
  if(locale==='zh'||locale.startsWith('zh-')){
    const parts=locale.split('-');
    if(parts.includes('hant'))return 'zhHant';
    if(parts.includes('hans'))return 'zhHans';
    return parts.some(part=>['tw','hk','mo'].includes(part))?'zhHant':'zhHans';
  }
  return 'en';
}
