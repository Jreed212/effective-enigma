// Strength Cycle accessory rotation patch.
// Changes future Workout C programming only; saved workout logs are never modified.
(function(){
  if(window.StrengthRotationPatchApplied)return;
  window.StrengthRotationPatchApplied=true;

  // Add technique metadata for the overhead triceps variation if the base app does not already have it.
  if(typeof ex==='object'&&!ex['Overhead Rope Triceps Extension']){
    ex['Overhead Rope Triceps Extension']={
      cat:'Arms',eq:'Cable + rope',
      c:['Face away from the cable','Keep elbows pointed forward/up','Extend without flaring elbows','Control the stretch behind the head'],
      m:['Elbows drifting wide','Arching the low back','Using body momentum'],
      mus:'Triceps · long head',sub:'Rope Triceps'
    };
  }

  const baseRotation=rotation;
  rotation=function(week,w){
    const list=baseRotation(week,w).slice();
    if(w==='C'){
      const i=list.indexOf('Rope Triceps');
      if(i>=0)list[i]='Overhead Rope Triceps Extension';
    }
    return list;
  };

  if(typeof render==='function')render();
})();