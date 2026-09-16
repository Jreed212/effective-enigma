// Strength Cycle UX/data continuity fixes. Does not rewrite saved workout records.
(function(){
 if(window.StrengthUxFixesApplied)return;window.StrengthUxFixesApplied=true;

 // Carry accessory load forward by exercise family so renamed/rotated equivalents still find prior data.
 const accessoryAliases={
  'Leg Press':['Leg Press'],
  'Hack Squat':['Hack Squat','Leg Press'],
  'DB Curl':['DB Curl','Hammer Curl'],
  'Hammer Curl':['Hammer Curl','DB Curl'],
  'Rope Triceps':['Rope Triceps','Overhead Rope Triceps Extension'],
  'Overhead Rope Triceps Extension':['Overhead Rope Triceps Extension','Rope Triceps']
 };
 const baseLastAccessory=lastAccessory;
 lastAccessory=function(name){
  const names=accessoryAliases[name]||[name];
  for(const l of [...p().logs].reverse()){
   const it=(l.items||[]).find(x=>names.includes(x.name));if(!it)continue;
   const sets=it.sets||[],last=sets.filter(s=>s.touched||s.done).pop();if(!last)continue;
   let wt=+last.weight||0;
   const promote=sets.length&&sets.every(s=>(+s.reps||0)>=12)&&rirNum(it.rir)>=2;
   if(promote)wt+=5;
   return{weight:wt,note:(it.name!==name?'Carry forward from '+it.name:promote?'Earned +5 lb':'Carry forward')};
  }
  return baseLastAccessory(name);
 };

 // More useful PR description: exercise + actual best set + estimated 1RM.
 window.prSummary=function(l){
  return (l.items||[]).filter(i=>i.pr).map(i=>{
   let best=null,bestE=0;
   for(const s of i.sets||[]){const w=+s.weight,r=+s.reps;if(!w||!r||r>12)continue;const e=e1rm(w,r);if(e>bestE){bestE=e;best={w,r}}}
   return best?i.name+' '+best.w+' lb × '+best.r+' (e1RM '+Math.round(bestE)+' lb)':i.name;
  }).join(' · ');
 };

 // Patch history displays after each render so existing data stays untouched.
 const baseRender=render;
 render=function(){
  baseRender();
  document.querySelectorAll('.pr').forEach(el=>{
   if(el.textContent.trim()==='🏆 PR recorded'){
    const hist=el.closest('.history');if(!hist)return;
    const title=hist.querySelector('b')?.textContent||'';
    const m=title.match(/Week (\d+) · Workout (.+)/);if(!m)return;
    const l=[...p().logs].reverse().find(x=>String(x.week)===m[1]&&String(x.workout)===m[2]);
    const s=l&&prSummary(l);if(s)el.textContent='🏆 PR · '+s;
   }
  });
 };

 // warmups.js owns finish when loaded. Wrap it so a manual Save Completed Workout lands on Home.
 setTimeout(()=>{
  const currentFinish=finish;
  finish=function(reason='manual'){
   currentFinish(reason);
   if(reason==='manual'){S.tab='home';save();render();}
  };
 },0);
})();