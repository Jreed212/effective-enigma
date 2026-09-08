// Adaptive main-lift warm-up / ramp sets for Strength Cycle.
// Loaded after the main app so it can extend the workout screen without touching saved data.
(function(){
  if(window.StrengthWarmupsApplied) return;
  window.StrengthWarmupsApplied=true;

  function warmupSetsFor(lift,working){
    working=+working||0;
    if(!working)return [];
    let scheme;
    if(working<=95) scheme=[[.50,8,'Warm-up'],[.70,4,'Ramp']];
    else if(working<=185) scheme=[[.40,8,'Warm-up'],[.60,5,'Build'],[.75,3,'Ramp']];
    else if(working<=275) scheme=[[.35,8,'Warm-up'],[.50,5,'Build'],[.65,3,'Ramp'],[.80,2,'Final ramp']];
    else scheme=[[.30,8,'Warm-up'],[.45,5,'Build'],[.60,3,'Ramp'],[.75,2,'Ramp'],[.85,1,'Final ramp']];
    const out=[];
    for(const [pct,reps,label] of scheme){
      let weight=round5(working*pct);
      // Standard bar minimum. If a trap bar/machine has a heavier empty weight, user can edit it.
      weight=Math.max(45,weight);
      if(weight>=working)weight=working-5;
      if(weight<=0||weight>=working)continue;
      if(out.some(x=>x.weight===weight))continue;
      out.push({weight,reps,label,pct});
    }
    return out;
  }
  window.warmupSetsFor=warmupSetsFor;

  // Preserve warm-up entries in the workout log, but do not let them affect PR/e1RM calculations.
  finish=function(reason='manual'){
    const a=p().active;if(!a)return;
    const end=reason==='timeout'?new Date(new Date(a.lastActivityAt).getTime()+15*60000).toISOString():new Date().toISOString();
    const pl=plan(a.week,a.workout),items=pl.map((it,ix)=>{
      const d=a.items[ix]||{sets:{},rir:'',warmups:{}};
      const sets=[];
      for(let si=0;si<it.sets;si++){
        const s=d.sets?.[si]||{};
        sets.push({weight:s.weight||'',reps:s.reps||'',done:!!s.done,touched:!!s.touched});
      }
      let best=0;
      for(const s of sets){if(+s.weight&&+s.reps&&+s.reps<=12)best=Math.max(best,e1rm(+s.weight,+s.reps));}
      const warmups=it.type==='main'?Object.keys(d.warmups||{}).sort((x,y)=>+x-+y).map(k=>{
        const w=d.warmups[k]||{};return{weight:w.weight||'',reps:w.reps||'',done:!!w.done,touched:!!w.touched};
      }):[];
      return{name:it.name,type:it.type,setsTarget:it.sets,repsTarget:it.reps,pct:it.pct,sets,warmups,rir:d.rir||'',bestE1rm:best,pr:it.type==='main'&&best>bestPrior(it.name,end)+.5};
    });
    const touched=items.reduce((n,it)=>n+it.sets.filter(s=>s.touched||s.done).length+((it.warmups||[]).filter(s=>s.touched||s.done).length),0);
    if(!touched&&reason==='timeout'){p().active=null;save();return;}
    p().logs.push({id:a.id,cycleNumber:p().activeCycle||1,week:a.week,workout:a.workout,startedAt:a.startedAt,endedAt:end,durationMinutes:Math.max(0,Math.round((new Date(end)-new Date(a.startedAt))/60000)),completionReason:reason,items});
    p().active=null;save();S.tab='log';render();
  };

  renderWork=function(){
    if(+S.week===0){renderWeek0();return;}
    const items=plan(S.week,S.workout),a=(p().active&&p().active.week===S.week&&p().active.workout===S.workout)?p().active:null;
    let html='<div class="card"><div class="grid2"><label>Week<select id="wk"><option value="0">Week 0 · Calibration</option>'+Array.from({length:12},(_,i)=>'<option value="'+(i+1)+'" '+(S.week===i+1?'selected':'')+'>Week '+(i+1)+'</option>').join('')+'</select></label><label>Workout<select id="wo">'+['A','B','C'].map(x=>'<option '+(S.workout===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label></div><p class="muted">Warm-up/ramp weights are calculated for you. First entry starts the workout automatically. 15 minutes of no input auto-finishes it.</p>'+(a?'<span class="pill good">Active since '+new Date(a.startedAt).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'})+'</span>':'<span class="pill">Not started</span>')+'</div>';

    items.forEach((it,ix)=>{
      const wt=it.type==='main'?workWt(it.name,it.pct):lastAccessory(it.name).weight;
      const note=it.type==='main'?(Math.round(it.pct*1000)/10)+'% TM':lastAccessory(it.name).note;
      const d=a?.items?.[ix]||{sets:{},rir:'',warmups:{}};
      html+='<div class="card"><div class="row" style="justify-content:space-between"><div><b>'+it.name+'</b><div class="big">'+it.sets+' × '+it.reps+(wt?' @ '+wt+' lb':'')+'</div><div class="small muted">'+note+'</div></div><button class="btn" data-tech="'+it.name+'">ⓘ Technique</button></div>';

      if(it.type==='main'&&wt){
        const wus=warmupSetsFor(it.name,wt);
        html+='<div class="lift"><div class="row" style="justify-content:space-between"><b>Warm-up / ramp</b><span class="small muted">Not working sets</span></div>';
        wus.forEach((wu,wi)=>{
          const saved=d.warmups?.[wi]||{};
          html+='<div class="set"><b>W'+(wi+1)+'</b><input data-wu-w="'+ix+'-'+wi+'" value="'+(saved.weight||wu.weight)+'" inputmode="decimal" placeholder="lb"><input data-wu-r="'+ix+'-'+wi+'" value="'+(saved.reps||wu.reps)+'" inputmode="numeric" placeholder="reps"><span class="small muted">'+wu.label+'</span><input data-wu-d="'+ix+'-'+wi+'" type="checkbox" '+(saved.done?'checked':'')+'></div>';
        });
        html+='</div><div class="lift"><div class="row" style="justify-content:space-between"><b>Working sets</b><span class="pill">'+it.sets+' sets</span></div>';
      }

      for(let si=0;si<it.sets;si++){
        const ss=d.sets?.[si]||{};
        html+='<div class="set"><b>'+(si+1)+'</b><input data-wt="'+ix+'-'+si+'" value="'+(ss.weight||wt||'')+'" inputmode="decimal" placeholder="lb"><input data-rp="'+ix+'-'+si+'" value="'+(ss.reps||'')+'" inputmode="numeric" placeholder="reps"><select data-ri="'+ix+'-'+si+'"><option value="">RIR</option><option>0</option><option>1</option><option selected>2</option><option>3</option><option>4+</option></select><input data-dn="'+ix+'-'+si+'" type="checkbox" '+(ss.done?'checked':'')+'></div>';
      }
      if(it.type==='main'&&wt)html+='</div>';
      html+='<label>Final-set RIR<select data-final="'+ix+'"><option value="">—</option><option>0</option><option>1</option><option '+(d.rir==='2'?'selected':'')+'>2</option><option>3</option><option>4+</option></select></label></div>';
    });

    html+='<div class="buttons"><button class="btn primary" id="done">Save Completed Workout</button><button class="btn danger" id="clear">Clear Active Session</button></div>';
    work.innerHTML=html;
    wk.onchange=()=>{S.week=+wk.value;save();render();};
    wo.onchange=()=>{S.workout=wo.value;save();render();};

    document.querySelectorAll('[data-wu-w],[data-wu-r],[data-wu-d]').forEach(el=>{
      const fn=()=>{
        const aa=touch(),key=el.dataset.wuW||el.dataset.wuR||el.dataset.wuD,[ix,wi]=key.split('-');
        aa.items[ix]=aa.items[ix]||{sets:{},rir:'',warmups:{}};
        aa.items[ix].warmups=aa.items[ix].warmups||{};
        aa.items[ix].warmups[wi]=aa.items[ix].warmups[wi]||{};
        const z=aa.items[ix].warmups[wi];
        if(el.dataset.wuW!==undefined)z.weight=el.value;
        if(el.dataset.wuR!==undefined)z.reps=el.value;
        if(el.dataset.wuD!==undefined)z.done=el.checked;
        z.touched=true;aa.lastActivityAt=new Date().toISOString();save();
      };
      el.addEventListener('input',fn);el.addEventListener('change',fn);
    });

    document.querySelectorAll('[data-wt],[data-rp],[data-dn],[data-final]').forEach(el=>{
      const fn=()=>{
        const aa=touch(),key=(el.dataset.wt||el.dataset.rp||el.dataset.dn||el.dataset.final);
        if(el.dataset.final!==undefined){aa.items[key]=aa.items[key]||{sets:{},warmups:{}};aa.items[key].rir=el.value;}
        else{const [ix,si]=key.split('-');aa.items[ix]=aa.items[ix]||{sets:{},rir:'',warmups:{}};aa.items[ix].sets[si]=aa.items[ix].sets[si]||{};const z=aa.items[ix].sets[si];if(el.dataset.wt!==undefined)z.weight=el.value;if(el.dataset.rp!==undefined)z.reps=el.value;if(el.dataset.dn!==undefined)z.done=el.checked;z.touched=true;}
        aa.lastActivityAt=new Date().toISOString();save();
      };
      el.addEventListener('input',fn);el.addEventListener('change',fn);
    });
    document.querySelectorAll('[data-tech]').forEach(b=>b.onclick=()=>openTech(b.dataset.tech));
    done.onclick=()=>{if(!p().active){if(!confirm('No sets entered. Save anyway?'))return;touch();}finish('manual');};
    clear.onclick=()=>{if(confirm('Clear the active workout?')){p().active=null;save();render();}};
  };

  // Re-render once after applying the enhancement.
  if(typeof render==='function')render();
})();