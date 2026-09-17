// Strength Cycle accessory rotation patch.
// Changes future programming only; saved workout logs are never modified.
(function(){
  if(window.StrengthRotationPatchApplied)return;
  window.StrengthRotationPatchApplied=true;

  if(typeof ex==='object'&&!ex['Overhead Rope Triceps Extension']){
    ex['Overhead Rope Triceps Extension']={cat:'Arms',eq:'Cable + rope',c:['Face away from the cable','Keep elbows pointed forward/up','Extend without flaring elbows','Control the stretch behind the head'],m:['Elbows drifting wide','Arching the low back','Using body momentum'],mus:'Triceps · long head',sub:'Rope Triceps'};
  }
  if(typeof ex==='object'&&!ex['Incline Barbell Bench Press']){
    ex['Incline Barbell Bench Press']={cat:'Chest',eq:'Incline bench + barbell',c:['Set bench to a moderate incline','Plant feet and set shoulder blades','Lower bar under control to upper chest','Press smoothly without bouncing'],m:['Bench angle too steep','Bouncing the bar','Losing upper-back position','Excessive elbow flare'],mus:'Upper chest · Triceps · Front delts',sub:'Incline DB Bench · Machine Chest Press'};
  }

  const baseRotation=rotation;
  rotation=function(week,w){
    const list=baseRotation(week,w).slice();
    // We have an incline barbell bench available, so use it instead of the DB version going forward.
    for(let i=0;i<list.length;i++)if(list[i]==='Incline DB Bench')list[i]='Incline Barbell Bench Press';
    if(w==='C'){
      const tri=list.indexOf('Rope Triceps');if(tri>=0)list[tri]='Overhead Rope Triceps Extension';
      const curl=list.indexOf('DB Curl');if(curl>=0)list[curl]='Hammer Curl';
    }
    return list;
  };

  if(typeof render==='function')render();
})();