// Strength Cycle accessory rotation patch.
// Changes future Workout C programming only; saved workout logs are never modified.
(function(){
  if(window.StrengthRotationPatchApplied)return;
  window.StrengthRotationPatchApplied=true;

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
      const tri=list.indexOf('Rope Triceps');
      if(tri>=0)list[tri]='Overhead Rope Triceps Extension';

      // Avoid repeating DB Curl from Workout A in the same week.
      const curl=list.indexOf('DB Curl');
      if(curl>=0)list[curl]='Hammer Curl';
    }
    return list;
  };

  if(typeof render==='function')render();
})();