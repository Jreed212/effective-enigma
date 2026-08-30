// Strength Cycle cloud adapter
// This file is inactive until CLOUD_CONFIG is populated.
window.CLOUD_CONFIG = window.CLOUD_CONFIG || {
  supabaseUrl: '',
  supabaseAnonKey: ''
};

window.StrengthCloud = (() => {
  let client = null;
  const configured = () => Boolean(window.CLOUD_CONFIG.supabaseUrl && window.CLOUD_CONFIG.supabaseAnonKey);
  function init(){
    if(!configured() || !window.supabase) return null;
    client = window.supabase.createClient(window.CLOUD_CONFIG.supabaseUrl, window.CLOUD_CONFIG.supabaseAnonKey, {
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }
  async function session(){ if(!client) init(); return client ? (await client.auth.getSession()).data.session : null; }
  async function signUp(email,password){ if(!client) init(); return client.auth.signUp({email,password}); }
  async function signIn(email,password){ if(!client) init(); return client.auth.signInWithPassword({email,password}); }
  async function signOut(){ if(!client) init(); return client?.auth.signOut(); }

  async function pullUserState(){
    const s=await session(); if(!s) return null; const uid=s.user.id;
    const [profile,cal,checkins,logs,tm,member]=await Promise.all([
      client.from('profiles').select('*').eq('id',uid).maybeSingle(),
      client.from('calibrations').select('*').eq('user_id',uid),
      client.from('checkins').select('*').eq('user_id',uid).order('checkin_date'),
      client.from('workout_logs').select('*').eq('user_id',uid).order('started_at'),
      client.from('tm_history').select('*').eq('user_id',uid).order('created_at'),
      client.from('group_members').select('group_id,role,training_groups(id,name,join_code,owner_id)').eq('user_id',uid).maybeSingle()
    ]);
    if(profile.error) throw profile.error;
    return {user:s.user,profile:profile.data,calibrations:cal.data||[],checkins:checkins.data||[],logs:logs.data||[],tmHistory:tm.data||[],membership:member.data||null};
  }

  async function pushProfile(p){
    const s=await session(); if(!s) throw new Error('Not signed in'); const uid=s.user.id;
    const row={id:uid,display_name:p.name||'Lifter',program_start:p.start||null,body_weight:p.weight||null,waist:p.waist||null,height:p.height||null,goal:p.goal||'Strength',current_week:p.currentWeek||0,current_workout:p.currentWorkout||'A',updated_at:new Date().toISOString()};
    const {error}=await client.from('profiles').upsert(row); if(error) throw error;
  }
  async function pushCalibrations(p){
    const s=await session(); if(!s) throw new Error('Not signed in'); const uid=s.user.id;
    const rows=Object.entries(p.cal||{}).map(([lift,c])=>({user_id:uid,lift,weight:+c.weight,reps:+c.reps,rir:String(c.rir??''),e1rm:+c.e1rm,training_max:+c.tm,target_guess:c.targetGuess?+c.targetGuess:null,ramp_sets:c.ramp||[],updated_at:new Date().toISOString()}));
    if(!rows.length) return; const {error}=await client.from('calibrations').upsert(rows); if(error) throw error;
  }
  async function pushWorkout(log){
    const s=await session(); if(!s) throw new Error('Not signed in'); const uid=s.user.id;
    const row={id:log.id,user_id:uid,week:log.week,workout:log.workout,started_at:log.startedAt,ended_at:log.endedAt,duration_minutes:log.durationMinutes||0,completion_reason:log.completionReason||'manual',items:log.items||[],updated_at:new Date().toISOString()};
    const {error}=await client.from('workout_logs').upsert(row); if(error) throw error;
  }
  return {configured,init,session,signUp,signIn,signOut,pullUserState,pushProfile,pushCalibrations,pushWorkout};
})();
