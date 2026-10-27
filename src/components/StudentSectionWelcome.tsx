'use client';
import {useEffect,useState} from 'react';
import {GraduationCap,CheckCircle2} from 'lucide-react';
import {db,prettyError} from '@/lib/supabase';
type Section={section_id:string;section_name:string;course_id:string;subject_name:string};
export default function StudentSectionWelcome({onComplete}:{onComplete:()=>Promise<void>|void}) {
 const [sections,setSections]=useState<Section[]>([]),[choice,setChoice]=useState('');
 const [loading,setLoading]=useState(true),[saving,setSaving]=useState(false),[error,setError]=useState('');
 useEffect(()=>{let live=true;db().rpc('registration_section_options').then(({data,error})=>{
   if(!live)return;if(error)setError(prettyError(error));else setSections(data||[]);setLoading(false)
 }).catch(e=>{if(live){setError(prettyError(e));setLoading(false)}});return()=>{live=false}},[]);
 async function complete(action:'complete_student_section_onboarding'|'skip_student_section_onboarding',data?:{p_section:string}){
   if(saving)return;setSaving(true);setError('');
   try{const {error}=await db().rpc(action,data);if(error)throw error;await onComplete()}
   catch(e){setError(prettyError(e));setSaving(false)}
 }
 return <div className="modal-backdrop" style={{zIndex:120}}>
  <section className="modal" role="dialog" aria-modal="true" aria-labelledby="section-welcome-title" aria-describedby="section-welcome-description">
   <div className="modal-header"><div><GraduationCap size={28} color="#6653ea"/><h2 id="section-welcome-title">Welcome! What is your section?</h2><p id="section-welcome-description">Choose your class section to get started.</p></div></div>
   <div className="modal-scroll"><p className="form-hint">Your choice also enrolls you in the associated subject. Your instructor can review or transfer your section later.</p>
   {loading?<p role="status" className="preview-status">Loading class sections…</p>:sections.length?
   <form className="form-fields" onSubmit={e=>{e.preventDefault();if(choice)void complete('complete_student_section_onboarding',{p_section:choice})}}>
     <label>Class section<select required disabled={saving} value={choice} onChange={e=>setChoice(e.target.value)}>
      <option value="">Select your section</option>{sections.map(s=><option key={s.section_id} value={s.section_id}>{s.section_name} — {s.subject_name}</option>)}
     </select></label><button type="submit" className="btn primary form-submit" disabled={saving||!choice}><CheckCircle2 size={17}/>{saving?'Saving…':'Confirm section'}</button>
   </form>:<p className="preview-status">No sections available yet. Ask the administrator to add or open a section.</p>}
   {error&&<p role="alert" className="auth-error">{error}</p>}
   {!loading&&<button className="btn outline" type="button" disabled={saving} style={{marginTop:14,width:'100%'}} onClick={()=>void complete('skip_student_section_onboarding')}>I'll choose later</button>}
   </div>
  </section>
 </div>;
}