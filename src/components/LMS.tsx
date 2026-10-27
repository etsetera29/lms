'use client';

import { useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { BookOpen, BrainCircuit, GraduationCap, LayoutDashboard, ClipboardList, FileQuestion, ChartColumnIncreasing, Megaphone, Users, Plus, LogOut, ChevronRight, Search, UploadCloud, CheckCircle2, Clock3, Download, Eye, FileText, ShieldCheck, Sparkles, Menu, X, RefreshCcw, Trash2, Check, RotateCcw, Layers3, KeyRound, LockKeyhole } from 'lucide-react';
import { calculatePerformance, downloadCSV } from '@/lib/performance';
import {CalendarPanel, NotificationPanel, V3QuizForm, V3TakeQuiz, V3TaskForm, V3GradeForm, V3EssayReview} from './V3';
import {CalendarDays, BellRing, ShieldAlert, MessageSquare, Award, Smartphone, ClipboardCheck, FileUp, UserRoundCog, Database} from 'lucide-react';
import {V4Attendance,V4Discussions,V4Badges,V4Analytics,V4Import,V4Instructors,V4Exports,V4MobileInstall,V4InstructorWorkspace} from './V4';
import SlideDeck from './SlideDeck';
import StudentSectionWelcome from './StudentSectionWelcome';
import SubjectAdmin from './SubjectAdmin';
import { db, configReady, ADMIN_LOGIN_EMAIL, ago, isNew, prettyError, percent, makePath, fileSuffix, ensureFile, lessonAllowed, submissionAllowed } from '@/lib/supabase';
import {validateSubmissionFile} from '@/lib/submissionValidation';

type RecordItem = Record<string, any>;
const nav = [
  {id:'overview',name:'Overview',Icon:LayoutDashboard},
  {id:'calendar',name:'Calendar',Icon:CalendarDays},
  {id:'notifications',name:'Notifications',Icon:BellRing},
  {id:'lessons',name:'Lessons',Icon:BookOpen},
  {id:'tasks',name:'Assignments',Icon:ClipboardList},
  {id:'quizzes',name:'Quizzes',Icon:FileQuestion},
  {id:'grades',name:'Grades',Icon:ChartColumnIncreasing},
  {id:'announcements',name:'Announcements',Icon:Megaphone},
  {id:'subjects',name:'Subjects & enrollment',Icon:BookOpen},
  {id:'sections',name:'Class sections',Icon:Layers3},
  {id:'attendance',name:'Attendance',Icon:ClipboardCheck},
  {id:'discussion',name:'Discussions',Icon:MessageSquare},
  {id:'badges',name:'Learning badges',Icon:Award},
  {id:'mobile',name:'Mobile app',Icon:Smartphone}
];
const starterQuestion=()=>({prompt:'',points:1,options:['','','',''],correct:0});

export default function LMS() {
  const [user,setUser]=useState<User|null>(null);
  const [checking,setChecking]=useState(true);
  const [profile,setProfile]=useState<RecordItem|null>(null);
  const [courses,setCourses]=useState<RecordItem[]>([]);
  const [enrollments,setEnrollments]=useState<RecordItem[]>([]);
  const [sections,setSections]=useState<RecordItem[]>([]);
  const [sectionMembers,setSectionMembers]=useState<RecordItem[]>([]);
  const [lessons,setLessons]=useState<RecordItem[]>([]);
  const [progress,setProgress]=useState<RecordItem[]>([]);
  const [tasks,setTasks]=useState<RecordItem[]>([]);
  const [submissions,setSubmissions]=useState<RecordItem[]>([]);
  const [quizzes,setQuizzes]=useState<RecordItem[]>([]);
  const [attempts,setAttempts]=useState<RecordItem[]>([]);
  const [announcements,setAnnouncements]=useState<RecordItem[]>([]);
  const [notificationReads,setNotificationReads]=useState<RecordItem[]>([]);
  const [securityEvents,setSecurityEvents]=useState<RecordItem[]>([]);
  const [profiles,setProfiles]=useState<RecordItem[]>([]);
  const [tab,setTab]=useState('overview');
  const [courseId,setCourseId]=useState('all');
  const [search,setSearch]=useState('');
  const [menuOpen,setMenuOpen]=useState(false);
  const [loading,setLoading]=useState(false);
  const [busy,setBusy]=useState(false);
  const [toast,setToast]=useState<{message:string;error:boolean}|null>(null);
  const [modal,setModal]=useState<string|null>(null);
  const [focused,setFocused]=useState<RecordItem|null>(null);
  const isAdmin=profile?.role==='admin';

  useEffect(()=>{
    if (!configReady) {setChecking(false);return;}
    const api=db();
    api.auth.getUser().then(({data})=>{setUser(data.user);setChecking(false);}).catch(()=>setChecking(false));
    const {data:{subscription}}=api.auth.onAuthStateChange((_event, session)=>setUser(session?.user ?? null));
    return ()=>subscription.unsubscribe();
  },[]);

  async function reload(activeUser=user) {
    if (!activeUser) return;
    setLoading(true);
    try {
      const api=db();
      const {data:p,error:e}=await api.from('profiles').select('*').eq('id',activeUser.id).single();
      if(e) throw e;
      setProfile(p);
      const isTeacher=p.role==='admin'||p.role==='instructor';
      const jobs:[string,string][]=[['class_sections','created_at'],['section_enrollments','joined_at'],['courses','created_at'],['enrollments','joined_at'],['lessons','created_at'],['lesson_progress','completed_at'],['tasks','created_at'],['submissions','submitted_at'],['quizzes','created_at'],['quiz_attempts','submitted_at'],['announcements','created_at'],['notification_reads','read_at']];
      if(isTeacher) jobs.push(['profiles','created_at']);
      if(p.role==='admin') jobs.push(['quiz_security_events','observed_at']);
      const lists=await Promise.all(jobs.map(async([name,order])=>{
        const res=await api.from(name).select(name==='class_sections'?'id,course_id,name,is_open,assignment_weight,quiz_weight,created_at,archived_at':'*').order(order,{ascending:false}).limit(1000);
        if(res.error) throw res.error;
        return res.data || [];
      }));
      const indexed=Object.fromEntries(jobs.map(([name],i)=>[name,lists[i]]));
      setSections(indexed.class_sections||[]);setSectionMembers(indexed.section_enrollments||[]);
      setCourses(indexed.courses||[]);setEnrollments(indexed.enrollments||[]);setLessons(indexed.lessons||[]);
      setProgress(indexed.lesson_progress||[]);setTasks(indexed.tasks||[]);setSubmissions(indexed.submissions||[]);
      setQuizzes(indexed.quizzes||[]);setAttempts(indexed.quiz_attempts||[]);
      setAnnouncements(indexed.announcements||[]);setProfiles(indexed.profiles||[]);setNotificationReads(indexed.notification_reads||[]);setSecurityEvents(indexed.quiz_security_events||[]);
    } catch(e){notify(prettyError(e),true);} finally {setLoading(false);}
  }
  useEffect(()=>{if(user) void reload(user); else {setProfile(null);setCourses([])}},[user?.id]);

  function notify(message:string,error=false){setToast({message,error});window.setTimeout(()=>setToast(null),5200);}
  async function act(action:()=>Promise<any>,success:string,close=true){
    setBusy(true);
    try {await action();notify(success);if(close){setModal(null);setFocused(null);} await reload();}
    catch(e){notify(prettyError(e),true);}finally{setBusy(false);}
  }
  async function signOut(){await db().auth.signOut();setTab('overview');setMenuOpen(false);}
  const myCourseIds=isAdmin?new Set(courses.map(c=>c.id)):new Set(enrollments.filter(e=>e.user_id===user?.id).map(e=>e.course_id));
  const visibleCourses=courses.filter(c=>myCourseIds.has(c.id));
  const include=(x:RecordItem)=> (courseId==='all'||x.course_id===courseId) && myCourseIds.has(x.course_id);
  const match=(x:RecordItem)=>`${x.title||''} ${x.description||''} ${x.instructions||''}`.toLowerCase().includes(search.trim().toLowerCase());
  const shownLessons=lessons.filter(x=>include(x)&&match(x)).sort((a,b)=>Number(a.week_number||1)-Number(b.week_number||1));
  const shownTasks=tasks.filter(x=>include(x)&&match(x));
  const shownQuizzes=quizzes.filter(x=>include(x)&&match(x));
  const shownAnnouncements=announcements.filter(x=>(!x.course_id||include(x))&&match(x));
  const courseName=(id:string)=>courses.find(c=>c.id===id)?.title||'All subjects';
  const isComplete=(id:string)=>progress.some(p=>p.lesson_id===id&&p.user_id===user?.id);
  const taskSubmission=(id:string)=>submissions.find(s=>s.task_id===id&&s.student_id===user?.id);
  const quizAttempt=(id:string)=>attempts.filter(a=>a.quiz_id===id&&a.student_id===user?.id).sort((a,b)=>Number(b.attempt_no||1)-Number(a.attempt_no||1))[0];
  const completed=lessons.filter(l=>myCourseIds.has(l.course_id) && isComplete(l.id)).length;
  const graded=submissions.filter(s=>s.student_id===user?.id&&s.score!=null);
  const tried=attempts.filter(a=>a.student_id===user?.id&&a.status==='graded');
  const obtained=graded.reduce((x,s)=>x+Number(s.score),0)+tried.reduce((x,a)=>x+Number(a.score),0);
  const possible=graded.reduce((x,s)=>x+Number(tasks.find(t=>t.id===s.task_id)?.max_score||0),0)+tried.reduce((x,a)=>x+Number(a.max_score),0);

  function openModal(name:string,data?:RecordItem){setModal(name);setFocused(data||null);setMenuOpen(false);}
  async function togglePublished(table:string,item:RecordItem){
    await act(async()=>{const {error}=await db().from(table).update({published:!item.published}).eq('id',item.id);if(error)throw error;},item.published?'Unpublished successfully.':'Published successfully.',false);
  }
  async function removeItem(table:string,item:RecordItem){
    if(!window.confirm(`Delete "${item.title}" permanently? This cannot be undone.`))return;
    await act(async()=>{
      const filePaths=table==='tasks'?submissions.filter(s=>s.task_id===item.id).map(s=>s.file_path):[];
      const {error}=await db().from(table).delete().eq('id',item.id);if(error)throw error;
      if(table==='lessons') await db().storage.from('lessons').remove([item.file_path]);
      if(filePaths.length) await db().storage.from('submissions').remove(filePaths);
    },'Deleted successfully.',false);
  }
  async function joinSection(code:string):Promise<boolean>{
    setBusy(true);try{const {error}=await db().rpc('join_section',{p_code:code.trim()});if(error)throw error;notify('Successfully joined your class section.');await reload();return true;}
    catch(e){notify(prettyError(e),true);return false;}finally{setBusy(false);}
  }
  async function markComplete(lesson:RecordItem){
    await act(async()=>{
      const api=db();
      if(isComplete(lesson.id)){
        const {error}=await api.from('lesson_progress').delete().eq('lesson_id',lesson.id).eq('user_id',user?.id);if(error)throw error;
      } else {
        const {error}=await api.from('lesson_progress').insert({lesson_id:lesson.id,user_id:user?.id});if(error)throw error;
      }
    },isComplete(lesson.id)?'Marked as not completed.':'Lesson marked complete.',false);
  }

  if(!configReady) return <div className="config-page"><BrainCircuit size={44}/><h1>FCPC Learning Hub</h1><p>Configure the Supabase environment variables first.</p><code>NEXT_PUBLIC_SUPABASE_URL</code><code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code><p>See README.md for deployment steps.</p></div>;
  if(checking) return <div className="splash"><BrainCircuit size={43}/><h2>FCPC Learning Hub</h2><span>Loading your learning space…</span></div>;
  if(!user) return <AuthScreen notify={notify}/>;
  if(!profile) return <div className="splash"><BrainCircuit size={43}/><p>{loading?'Preparing your dashboard…':'Profile not loaded. Please try again.'}</p><button className="btn primary" onClick={()=>reload()}>Retry</button><button className="btn ghost" onClick={signOut}>Sign out</button>{toast&&<p>{toast.message}</p>}</div>;

  if(profile.role==='instructor') return <V4InstructorWorkspace userId={user.id} fullName={profile.full_name} onSignOut={signOut} onReload={()=>reload()} courses={courses} sections={sections} members={sectionMembers} profiles={profiles} tasks={tasks} submissions={submissions} quizzes={quizzes} attempts={attempts} lessons={lessons} progress={progress}/>;

  const currentCourse=courseId==='all'?'All subjects':courseName(courseId);
  const newLessons=lessons.filter(l=>include(l)&&isNew(l.created_at)).length;
  const pending=tasks.filter(t=>include(t)&&!taskSubmission(t.id)).length;

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen?'open':''}`}>
      <div className="brand"><span className="brand-symbol"><BrainCircuit size={24}/></span><div><strong>FCPC Learning Hub</strong><small>Learning Management System</small></div><button className="close-mobile" onClick={()=>setMenuOpen(false)}><X size={22}/></button></div>
      <div className="side-caption">WORKSPACE</div>
      <div className="side-nav">
        {nav.map(({id,name,Icon})=><button key={id} className={`side-link ${tab===id?'selected':''}`} onClick={()=>{setTab(id);setSearch('');setMenuOpen(false);}}><Icon size={19}/>{name}{id==='lessons'&&newLessons>0&&<span className="pill-count">{newLessons}</span>}</button>)}
        {isAdmin&&<><button className={`side-link ${tab==='integrity'?'selected':''}`} onClick={()=>{setTab('integrity');setMenuOpen(false);}}><ShieldAlert size={19}/>Quiz activity review</button><button className={`side-link ${tab==='students'?'selected':''}`} onClick={()=>{setTab('students');setMenuOpen(false);}}><Users size={19}/>Students</button><button className={`side-link ${tab==='reports'?'selected':''}`} onClick={()=>{setTab('reports');setMenuOpen(false);}}><ChartColumnIncreasing size={19}/>Performance reports</button><button className={`side-link ${tab==='analytics'?'selected':''}`} onClick={()=>{setTab('analytics');setMenuOpen(false);}}><ChartColumnIncreasing/>Advanced analytics</button><button className={`side-link ${tab==='bulk-import'?'selected':''}`} onClick={()=>{setTab('bulk-import');setMenuOpen(false);}}><FileUp size={19}/>Roster import</button><button className={`side-link ${tab==='instructors'?'selected':''}`} onClick={()=>{setTab('instructors');setMenuOpen(false);}}><UserRoundCog size={19}/>Instructors</button><button className={`side-link ${tab==='exports'?'selected':''}`} onClick={()=>{setTab('exports');setMenuOpen(false);}}><Database size={19}/>Exports</button></>}
      </div>
      <div className="side-caption" style={{marginTop:28}}>MY SUBJECTS</div>
      <div className="course-links">
        <button className={courseId==='all'?'course-choice chosen':'course-choice'} onClick={()=>{setCourseId('all');setMenuOpen(false);}}><span className="course-dot all"/>All subjects</button>
        {visibleCourses.map(c=><button key={c.id} className={courseId===c.id?'course-choice chosen':'course-choice'} onClick={()=>{setCourseId(c.id);setMenuOpen(false);}}><span className={`course-dot ${c.color}`}/><span className="side-course-label">{c.title}</span></button>)}
      </div>
      <div className="sidebar-bottom"><div className="account-avatar">{(profile.full_name||'U')[0]?.toUpperCase()}</div><div className="account-info"><strong>{profile.full_name}</strong><small>{isAdmin?'Administrator':'Student'}</small></div><button className="icon-button" onClick={signOut} title="Sign out"><LogOut size={19}/></button></div>
    </aside>
    {menuOpen&&<div className="mobile-scrim" onClick={()=>setMenuOpen(false)}/>}
    <main className="main-area">
      <header className="topbar"><button className="mobile-menu" aria-label="Open menu" onClick={()=>setMenuOpen(true)}><Menu size={23}/></button><div className="crumb"><span>Learning Hub</span><ChevronRight size={15}/><b>{nav.find(n=>n.id===tab)?.name||(tab==='reports'?'Performance reports':'Students')}</b></div><div className="topbar-actions"><span className="mode-tag"><ShieldCheck size={14}/>{isAdmin?'Admin mode':'Student portal'}</span><button className="btn icon-only" onClick={()=>reload()} disabled={loading} aria-label="Refresh data"><RefreshCcw size={17} className={loading?'spin':''}/></button></div></header>
      <div className="page-content">
        <div className="page-title-row"><div><p className="eyebrow">{isAdmin?'INSTRUCTOR WORKSPACE':'YOUR LEARNING SPACE'}</p><h1>{tab==='overview'?(isAdmin?'Teaching dashboard':`Welcome back, ${profile.full_name.split(' ')[0]}!`):tab==='students'?'Student directory':tab==='reports'?'Performance reports':tab==='integrity'?'Quiz activity review':nav.find(n=>n.id===tab)?.name}</h1><p className="subtitle">{tab==='overview'?isAdmin?'Manage content, monitor learning, and grade submissions.':'Pick up where you left off and stay on top of your coursework.':currentCourse}</p></div><div className="page-actions">{isAdmin&&['lessons','tasks','quizzes','announcements'].includes(tab)&&<button className="btn primary" onClick={()=>openModal(tab==='lessons'?'lesson':tab==='tasks'?'task':tab==='quizzes'?'quiz':'announcement')}><Plus size={17}/>Create {tab==='lessons'?'lesson':tab==='tasks'?'assignment':tab==='quizzes'?'quiz':'post'}</button>}</div></div>
        {tab==='overview'&&<>
          <div className="welcome-panel"><div><div className="welcome-mini"><Sparkles size={14}/> {isAdmin?'TEACHING CONTROL CENTER':'THE WEEK AHEAD'}</div><h2>{isAdmin?'Teach smarter. Keep everyone on track.':'Build your skills, one lesson at a time.'}</h2><p>{isAdmin?'Two courses, one organized space. Publish lessons, build quizzes, and give useful feedback.':'Your lessons, deadlines, and performance are all here. You’ve got this.'}</p><button className="btn white-btn" onClick={()=>setTab('lessons')}>Explore lessons <ChevronRight size={16}/></button></div><div className="welcome-decoration"><BrainCircuit size={112} strokeWidth={1.2}/></div></div>
          <div className="stats-grid">
            <Stat title="My subjects" value={visibleCourses.length} Icon={BookOpen} color="violet" foot="Available courses"/>
            <Stat title="Lessons" value={lessons.filter(include).length} Icon={GraduationCap} color="blue" foot={isAdmin?`${newLessons} published this week`:`${completed} completed`}/>
            <Stat title={isAdmin?'Submissions':'Assignments due'} value={isAdmin?submissions.filter(s=>tasks.some(t=>t.id===s.task_id&&include(t))).length:pending} Icon={ClipboardList} color="amber" foot={isAdmin?'Student uploads':'Not submitted yet'}/>
            <Stat title={isAdmin?'Quizzes':'Current grade'} value={isAdmin?shownQuizzes.length:'By class'} Icon={ChartColumnIncreasing} color="green" foot={isAdmin?'Quizzes created':'See weighted grades by class'}/>
          </div>
          <div className="two-col"><section className="panel"><div className="panel-heading"><div><h3>Recent lessons</h3><span>Latest learning materials</span></div><button className="text-link" onClick={()=>setTab('lessons')}>View all <ChevronRight size={15}/></button></div>{lessons.filter(include).slice(0,4).length?lessons.filter(include).slice(0,4).map(l=><button className="activity-row" key={l.id} onClick={()=>openModal('view-lesson',l)}><span className="activity-icon violet"><FileText size={19}/></span><span className="activity-text"><b>{l.title}</b><small>{courseName(l.course_id)} · {ago(l.created_at)}</small></span>{isNew(l.created_at)&&<span className="tiny-badge">NEW</span>}<ChevronRight size={17}/></button>):<Empty title="No lessons yet" body={isAdmin?'Publish your first lesson to get started.':'Check back for new materials.'}/>}</section>
            <section className="panel"><div className="panel-heading"><div><h3>Class updates</h3><span>Announcements and reminders</span></div><button className="text-link" onClick={()=>setTab('announcements')}>View all <ChevronRight size={15}/></button></div>{announcements.filter(x=>!x.course_id||include(x)).slice(0,4).length?announcements.filter(x=>!x.course_id||include(x)).slice(0,4).map(a=><div className="announcement-brief" key={a.id}><div className="mini-indicator"/><div><b>{a.title}</b><p>{a.body}</p><small>{ago(a.created_at)}</small></div></div>):<Empty title="No announcements" body="Course updates will appear here."/>}</section></div>
          {!isAdmin&&<section className="panel"><div className="panel-heading"><div><h3>Your class sections</h3><span>Enter the enrollment code from your instructor to join a subject.</span></div><button className="btn outline" onClick={()=>setTab('sections')}><KeyRound size={16}/> Join class</button></div>{sectionMembers.filter(m=>m.user_id===user.id).map(m=><div className="activity-row" key={m.section_id}><span className="activity-icon violet"><Layers3 size={18}/></span><span className="activity-text"><b>{sections.find(x=>x.id===m.section_id)?.name||'Class section'}</b><small>{courseName(m.course_id)}</small></span></div>)}{!sectionMembers.some(m=>m.user_id===user.id)&&<Empty title="No enrolled classes" body="Get a section enrollment code from your teacher and open Class sections."/>}</section>}
        </>}
        {tab==='calendar'&&<CalendarPanel courses={visibleCourses} lessons={lessons.filter(include)} tasks={tasks.filter(include)} quizzes={quizzes.filter(include)}/>}
        {tab==='notifications'&&<NotificationPanel userId={user.id} isAdmin={isAdmin} courses={courses} lessons={lessons.filter(include)} tasks={tasks.filter(include)} quizzes={quizzes.filter(include)} announcements={announcements.filter(x=>!x.course_id||include(x))} submissions={submissions} attempts={attempts} reads={notificationReads} onReload={()=>reload()} onNavigate={setTab}/>}
        {tab==='integrity'&&isAdmin&&<div className="panel"><div className="panel-heading"><div><h3>Quiz activity signals</h3><span>Tab switches, blur and copy/paste signals for instructor review—not proof of cheating.</span></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Quiz</th><th>Signal</th><th>Observed</th></tr></thead><tbody>{securityEvents.map(ev=>{const a=attempts.find(x=>x.id===ev.attempt_id);return <tr key={ev.id}><td>{profiles.find(p=>p.id===ev.student_id)?.full_name||'Student'}</td><td>{quizzes.find(q=>q.id===a?.quiz_id)?.title||'Quiz'}</td><td>{ev.event_type.replaceAll('_',' ')}</td><td>{new Date(ev.observed_at).toLocaleString('en-PH')}</td></tr>})}</tbody></table></div>{!securityEvents.length&&<Empty title="No activity flags" body="Activity signals recorded during timed quizzes appear here."/>}</div>}
        {['lessons','tasks','quizzes'].includes(tab)&&<div className="content-toolbar"><div className="search-box"><Search size={18}/><input aria-label="Search" value={search} onChange={e=>setSearch(e.target.value)} placeholder={`Search ${tab}...`}/></div><span className="results-label">{tab==='lessons'?shownLessons.length:tab==='tasks'?shownTasks.length:shownQuizzes.length} items</span></div>}
        {tab==='lessons'&&<div className="cards-grid">{shownLessons.map(l=><article key={l.id} className="lesson-card"><div className="file-thumbnail"><span className={`file-icon ${l.file_type}`}><FileText size={29}/></span><span className="file-ext">{l.file_type.toUpperCase()}</span></div><div className="lesson-card-body"><div className="card-overline">{courseName(l.course_id)} · Week {l.week_number||1} {isNew(l.created_at)&&<span className="tiny-badge">NEW</span>}</div><h3>{l.title}</h3><p>{l.description||'View the lesson directly in the learning portal.'}</p><div className="card-meta"><Clock3 size={14}/>{ago(l.created_at)}{!isAdmin&&isComplete(l.id)&&<span className="done-tag"><Check size={13}/> Completed</span>}</div><div className="card-buttons"><button className="btn primary small" onClick={()=>openModal('view-lesson',l)}><Eye size={15}/>Open lesson</button>{isAdmin&&<><button className="mini-action" onClick={()=>togglePublished('lessons',l)}>{l.published?'Hide':'Publish'}</button><button className="mini-action danger" title="Delete" onClick={()=>removeItem('lessons',l)}><Trash2 size={16}/></button></>}</div>{isAdmin&&!l.published&&<span className="draft-label">DRAFT</span>}</div></article>)}{!shownLessons.length&&<Empty title="No lessons found" body={isAdmin?'Create a new lesson or clear your search.':'Lessons will appear here when published.'}/>}</div>}
        {tab==='tasks'&&<div className="stack-list">{shownTasks.map(t=>{const s=taskSubmission(t.id);const sent=submissions.filter(x=>x.task_id===t.id).length;const overdue=!!t.due_at&&new Date(t.due_at)<new Date();const notOpen=!!t.opens_at&&new Date(t.opens_at)>new Date();return <div className="list-card" key={t.id}><div className="list-icon amber"><ClipboardList size={24}/></div><div className="list-body"><div className="card-overline">{courseName(t.course_id)}</div><h3>{t.title}</h3><p>{t.instructions}</p><div className="chips"><span><Clock3 size={13}/> Due: {ago(t.due_at)}</span><span>{t.max_score} points</span>{Array.isArray(t.rubric)&&t.rubric.length>0&&<span>{t.rubric.length} rubric criteria</span>}{overdue&&<span className="chip-warn">Deadline passed</span>}{notOpen&&<span className="chip-muted">Opens {ago(t.opens_at)}</span>}{isAdmin&&!t.published&&<span className="chip-muted">Draft</span>}{s&&<span className="chip-good">{s.score!=null?`Graded: ${s.score}/${t.max_score}`:'Submitted'}</span>}</div></div><div className="list-actions">{isAdmin?<><span className="submissions-count">{sent} submission{sent===1?'':'s'}</span><button className="btn outline" onClick={()=>{setTab('grades');setCourseId(t.course_id)}}>Grade</button><button className="mini-action" onClick={()=>togglePublished('tasks',t)}>{t.published?'Hide':'Publish'}</button><button className="mini-action danger" onClick={()=>removeItem('tasks',t)}><Trash2 size={16}/></button></>:<button className="btn primary" onClick={()=>openModal('submit',t)}>{s?'View submission':overdue?'View assignment':notOpen?'Not open':'Submit work'} <ChevronRight size={16}/></button>}</div></div>})}{!shownTasks.length&&<Empty title="No assignments found" body="Assignments will be listed as they are added."/>}</div>}
        {tab==='quizzes'&&<div className="stack-list">{isAdmin&&attempts.filter(a=>a.status==='pending_review'&&quizzes.some(q=>q.id===a.quiz_id&&include(q))).map(a=><div className="list-card" key={`review-${a.id}`}><div className="list-icon violet"><FileQuestion size={24}/></div><div className="list-body"><h3>Essay grading: {quizzes.find(q=>q.id===a.quiz_id)?.title}</h3><p>{profiles.find(p=>p.id===a.student_id)?.full_name} · Attempt {a.attempt_no}</p></div><button className="btn outline" onClick={()=>openModal('essay-grade',a)}>Grade essay</button></div>)}{shownQuizzes.map(q=>{const own=attempts.filter(a=>a.quiz_id===q.id&&a.student_id===user.id);const a=quizAttempt(q.id);const closed=!!q.closes_at&&new Date(q.closes_at)<new Date();const notOpen=!!q.opens_at&&new Date(q.opens_at)>new Date();const canTry=own.length<(q.max_attempts||1)||!!own.find(a=>a.status==='in_progress');return <div className="list-card" key={q.id}><div className="list-icon violet"><FileQuestion size={24}/></div><div className="list-body"><div className="card-overline">{courseName(q.course_id)}</div><h3>{q.title}</h3><p>{q.instructions||'Timed quiz with secure scoring.'}</p><div className="chips"><span><Clock3 size={13}/> Closes: {ago(q.closes_at)}</span><span>{q.time_limit_minutes||'—'} min · Up to {q.max_attempts||1} attempt(s)</span>{a&&a.status==='graded'&&<span className="chip-good">Latest: {a.score}/{a.max_score}</span>}{a?.status==='pending_review'&&<span className="chip-muted">Essay grading pending</span>}{!a&&(closed||notOpen)&&<span className="chip-muted">{closed?'Closed':'Not open yet'}</span>}{isAdmin&&!q.published&&<span className="chip-muted">Draft</span>}</div></div><div className="list-actions">{isAdmin?<><span className="submissions-count">{attempts.filter(a=>a.quiz_id===q.id).length} attempts</span><button className="mini-action" onClick={()=>togglePublished('quizzes',q)}>{q.published?'Hide':'Publish'}</button><button className="mini-action danger" onClick={()=>removeItem('quizzes',q)}><Trash2 size={16}/></button></>:<button className="btn outline" disabled={!canTry||closed||notOpen} onClick={()=>openModal('take-quiz',q)}>{closed?'Closed':notOpen?'Not open':!canTry?'Attempts used':a?.status==='in_progress'?'Resume quiz':'Start attempt'}<ChevronRight size={15}/></button>}</div></div>})}{!shownQuizzes.length&&<Empty title="No quizzes found" body="Quizzes will be listed as they are published."/>}</div>}
        {tab==='announcements'&&<div className="stack-list">{shownAnnouncements.map(a=><div className="announcement-card" key={a.id}><div className="announcement-top"><span className="notice-tag"><Megaphone size={14}/> {a.course_id?courseName(a.course_id):'All subjects'}</span><small>{ago(a.created_at)}</small></div><h3>{a.title}</h3><p>{a.body}</p>{isAdmin&&<button className="mini-action danger" onClick={()=>removeItem('announcements',a)}><Trash2 size={15}/> Delete</button>}</div>)}{!shownAnnouncements.length&&<Empty title="No announcements" body="Important course notices will appear here."/>}</div>}
        {tab==='grades'&&(isAdmin?<AdminGrades tasks={tasks.filter(include)} submissions={submissions} attempts={attempts} quizzes={quizzes.filter(include)} profiles={profiles} courses={courses} sections={sections} members={sectionMembers} onGrade={s=>openModal('grade',s)}/>:<StudentGrades userId={user.id} courses={courses.filter(c=>myCourseIds.has(c.id)&&(courseId==='all'||c.id===courseId))} sections={sections} members={sectionMembers} tasks={tasks.filter(include)} lessons={lessons.filter(include)} progress={progress} submissions={submissions.filter(s=>s.student_id===user.id)} attempts={attempts.filter(a=>a.student_id===user.id)} quizzes={quizzes.filter(include)} />)}
        {tab==='attendance'&&<V4Attendance userId={user.id} isStaff={isAdmin} courses={courses} sections={sections} members={sectionMembers} profiles={profiles}/>}
        {tab==='discussion'&&<V4Discussions userId={user.id} isStaff={isAdmin} courses={courses} sections={sections} members={sectionMembers} profiles={profiles}/>}
        {tab==='badges'&&!isAdmin&&<V4Badges userId={user.id} courses={visibleCourses} lessons={lessons} progress={progress} quizzes={quizzes} attempts={attempts}/>}
        {tab==='badges'&&isAdmin&&<p className="report-note">Learning badges are visible to students. Open a student test account to review them.</p>}
        {tab==='mobile'&&<V4MobileInstall/>}
        {tab==='analytics'&&isAdmin&&<V4Analytics courses={courses} sections={sections} members={sectionMembers} profiles={profiles} tasks={tasks} quizzes={quizzes} lessons={lessons} progress={progress} submissions={submissions} attempts={attempts}/>}
        {tab==='bulk-import'&&isAdmin&&<V4Import courses={courses} sections={sections} onReload={()=>reload()}/>}
        {tab==='instructors'&&isAdmin&&<V4Instructors courses={courses} sections={sections} profiles={profiles} onReload={()=>reload()}/>}
        {tab==='exports'&&isAdmin&&<V4Exports courses={courses} sections={sections} members={sectionMembers} profiles={profiles} lessons={lessons} progress={progress} tasks={tasks} submissions={submissions} quizzes={quizzes} attempts={attempts} announcements={announcements}/>}
        {tab==='subjects'&&<SubjectAdmin isAdmin={isAdmin} courses={courses} enrollments={enrollments} sections={sections} members={sectionMembers} profiles={profiles} userId={user.id} onChanged={()=>reload()} notify={notify}/>}
        {tab==='sections'&&<ClassSectionsPanel isAdmin={isAdmin} courses={courses} sections={sections} members={sectionMembers} profiles={profiles} userId={user.id} onJoin={joinSection} onChanged={()=>reload()} notify={notify}/>}
        {tab==='reports'&&isAdmin&&<PerformanceReports courses={courses} sections={sections} members={sectionMembers} profiles={profiles} tasks={tasks} quizzes={quizzes} lessons={lessons} progress={progress} submissions={submissions} attempts={attempts} />}
        {tab==='students'&&isAdmin&&<div className="panel"><div className="panel-heading"><div><h3>Enrolled students</h3><span>{profiles.filter(p=>p.role==='student').length} registered student accounts</span></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Student number</th><th>Class sections</th><th>Joined</th></tr></thead><tbody>{profiles.filter(p=>p.role==='student').map(p=><tr key={p.id}><td><b>{p.full_name}</b></td><td>{p.student_number||'—'}</td><td>{sectionMembers.filter(e=>e.user_id===p.id).map(e=>`${courses.find(c=>c.id===e.course_id)?.code} · ${sections.find(s=>s.id===e.section_id)?.name}`).join(', ')||'None'}</td><td>{ago(p.created_at)}</td></tr>)}</tbody></table></div></div>}
        <footer className="main-footer">FCPC Learning Hub · Built for focused learning · {new Date().getFullYear()}</footer>
      </div>
    </main>
    {profile?.role==='student' && profile.onboarding_complete===false && <StudentSectionWelcome onComplete={()=>reload()}/>}
    {toast&&<div className={`toast ${toast.error?'error':''}`} role="status">{toast.error?<X size={18}/>:<CheckCircle2 size={18}/>} {toast.message}</div>}
    {modal&&<div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy){setModal(null);setFocused(null);}}}><div className={`modal ${modal==='view-lesson'?'wide':''}`} role="dialog" aria-modal="true"><div className="modal-header"><div><h2>{modal==='lesson'?'Upload a lesson':modal==='task'?'New assignment':modal==='quiz'?'Create a quiz':modal==='announcement'?'Post an announcement':modal==='view-lesson'?focused?.title:modal==='take-quiz'?focused?.title:modal==='submit'?'Assignment submission':modal==='grade'?'Grade submission':modal==='essay-grade'?'Review essay':''}</h2><p>{modal==='view-lesson'?courseName(focused?.course_id):'FCPC Learning Hub'}</p></div><button className="icon-button" disabled={busy} onClick={()=>{setModal(null);setFocused(null);}}><X size={22}/></button></div><div className="modal-scroll">
      {modal==='lesson'&&<LessonForm busy={busy} courses={courses} onSubmit={(title,description,course_id,file,week_number,publish_at,video_url)=>act(async()=>{
        ensureFile(file,lessonAllowed);const path=makePath(course_id,file);
        const api=db();const uploaded=await api.storage.from('lessons').upload(path,file,{contentType:fileSuffix(file)==='pdf'?'application/pdf':'application/vnd.openxmlformats-officedocument.presentationml.presentation',upsert:false});if(uploaded.error)throw uploaded.error;
        const {error}=await api.from('lessons').insert({title,description,course_id,file_path:path,file_type:fileSuffix(file),week_number,publish_at,video_url});
        if(error){await api.storage.from('lessons').remove([path]);throw error;}
      },'Lesson uploaded and published.')}/>}
      {modal==='task'&&<V3TaskForm busy={busy} courses={courses} onSubmit={data=>act(async()=>{const {error}=await db().from('tasks').insert(data);if(error)throw error;},'Assignment created.')}/>}
      {modal==='announcement'&&<AnnouncementForm busy={busy} courses={courses} onSubmit={data=>act(async()=>{const {error}=await db().from('announcements').insert(data);if(error)throw error;},'Announcement posted.')}/>}
      {modal==='quiz'&&<V3QuizForm busy={busy} courses={courses} onSubmit={data=>act(async()=>{
        const api=db();const {questions,...quiz}=data;
        const {data:q,error:qError}=await api.from('quizzes').insert({...quiz,published:false}).select('id').single();if(qError)throw qError;
        try {
          for(const [i,question] of questions.entries()) {
            const {data:row,error}=await api.from('quiz_questions').insert({quiz_id:q.id,prompt:question.prompt,kind:question.kind,points:question.points,position:i}).select('id').single();if(error)throw error;
            if(question.kind==='mcq'){
              const {data:opts,error:oe}=await api.from('quiz_options').insert(question.options.map((label:string,position:number)=>({question_id:row.id,label,position}))).select('id,position');if(oe)throw oe;
              const {error:ke}=await api.from('quiz_keys').insert({question_id:row.id,option_id:opts?.find(o=>o.position===question.correct)?.id});if(ke)throw ke;
            }
            if(question.bank){const {error:be}=await api.from('question_bank').insert({course_id:quiz.course_id,prompt:question.prompt,kind:question.kind,points:question.points,choices:question.kind==='mcq'?question.options:[],correct_index:question.kind==='mcq'?question.correct:null});if(be)throw be;}
          }
          const {error:pubError}=await api.from('quizzes').update({published:true}).eq('id',q.id);if(pubError)throw pubError;
        }catch(e){await api.from('quizzes').delete().eq('id',q.id);throw e;}
      },'Quiz created and published.')}/>}
      {modal==='view-lesson'&&focused&&<LessonViewer lesson={focused} isAdmin={isAdmin} completed={isComplete(focused.id)} onComplete={()=>markComplete(focused)}/>}
      {modal==='submit'&&focused&&<SubmissionForm busy={busy} task={focused} submission={taskSubmission(focused.id)} onSubmit={(file,comment)=>act(async()=>{
        ensureFile(file,submissionAllowed);const validatedMime=await validateSubmissionFile(file);const api=db();const path=makePath(`${focused.id}/${user.id}`,file);
        const {error:uploadError}=await api.storage.from('submissions').upload(path,file,{contentType:validatedMime,upsert:false});if(uploadError)throw uploadError;
        const existing=taskSubmission(focused.id);
        const row={file_path:path,original_filename:file.name,comment};
        const res=existing?await api.from('submissions').update(row).eq('id',existing.id):await api.from('submissions').insert({...row,task_id:focused.id,student_id:user.id});
        if(res.error){await api.storage.from('submissions').remove([path]);throw res.error;}
        if(existing?.file_path&&existing.file_path!==path) await api.storage.from('submissions').remove([existing.file_path]);
      },'Assignment submitted.')}/>}
      {modal==='take-quiz'&&focused&&<V3TakeQuiz busy={busy} quiz={focused} onFinish={(id,answers,expired)=>act(async()=>{
        const {error}=await db().rpc('finish_quiz_v3',{p_attempt_id:id,p_answers:answers,p_use_saved:!!expired});if(error)throw error;
      },'Quiz submitted. Essay answers require instructor review.')}/>}
      {modal==='grade'&&focused&&<V3GradeForm busy={busy} submission={focused} task={tasks.find(t=>t.id===focused.task_id)} student={profiles.find(p=>p.id===focused.student_id)} onSubmit={(scores,score,feedback,revision)=>act(async()=>{
        const {error}=await db().rpc('grade_submission_v3',{p_id:focused.id,p_scores:scores,p_manual_score:score,p_feedback:feedback,p_return_revision:revision});if(error)throw error;
      },'Grade saved.')}/>}
      {modal==='essay-grade'&&focused&&<V3EssayReview attempt={focused} questions={[]} busy={busy} onSubmit={(scores,feedback)=>act(async()=>{const {error}=await db().rpc('grade_essay_v3',{p_attempt_id:focused.id,p_essay_scores:scores,p_feedback:feedback});if(error)throw error;},'Essay grade published.')}/>}
    </div></div></div>}
  </div>;
}

function AuthScreen({notify}:{notify:(msg:string,error?:boolean)=>void}){
  const [register,setRegister]=useState(false);
  const [isAdminLogin,setIsAdminLogin]=useState(false);
  const [email,setEmail]=useState('');const [password,setPassword]=useState('');
  const [name,setName]=useState('');const [number,setNumber]=useState('');
  const [busy,setBusy]=useState(false);const [authError,setAuthError]=useState('');
  async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setAuthError('');
    try {
      const api=db();
      if(register){
        if(password.length<8)throw Error('Password must be at least 8 characters.');
        if(email.trim().toLowerCase()===ADMIN_LOGIN_EMAIL)throw Error('This email address is reserved.');
        const {data,error}=await api.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim(),student_number:number.trim()}}});if(error)throw error;
        if(!data.session||!data.user)throw Error('Please turn OFF Confirm Email in Supabase Authentication → Providers → Email, then register.');
        notify('Account created. Welcome to your learning hub!');window.location.reload();
      } else {
        const {error}=await api.auth.signInWithPassword({email:isAdminLogin?ADMIN_LOGIN_EMAIL:email.trim(),password});if(error)throw error;
      }
    } catch(e){setAuthError(prettyError(e));notify(prettyError(e),true);}finally{setBusy(false);}
  }
  return <div className="auth-page"><section className="auth-showcase"><div className="showcase-brand"><span className="brand-symbol"><BrainCircuit size={25}/></span><b>FCPC Learning Hub</b></div><div className="showcase-content"><div className="showcase-label">A BETTER WAY TO LEARN</div><h1>Everything you need.<br/><em>One learning space.</em></h1><p>Explore lessons, complete assignments, take quizzes, and monitor your progress in two essential subjects.</p><div className="auth-course-tile"><span className="course-icon violet"><BrainCircuit size={25}/></span><div><b>Fundamentals of AI</b><small>Learn the intelligence behind tomorrow</small></div><ChevronRight size={18}/></div><div className="auth-course-tile"><span className="course-icon teal"><BookOpen size={25}/></span><div><b>Living in the IT Era</b><small>Navigate the modern digital world</small></div><ChevronRight size={18}/></div></div><div className="showcase-footer">Made for curious minds and future-ready learners.</div></section>
    <section className="auth-form-side"><div className="auth-form-card"><div className="mobile-brand"><BrainCircuit size={25}/> FCPC Learning Hub</div><div className="auth-eyebrow">{register?'GET STARTED':isAdminLogin?'INSTRUCTOR ACCESS':'WELCOME BACK'}</div><h2>{register?'Create your account':isAdminLogin?'Admin sign in':'Sign in to continue'}</h2><p className="auth-intro">{register?'Register without email verification, then join your class using a teacher-provided code.':'Access your learning materials and stay on track.'}</p>
      <div className="auth-switch"><button className={!isAdminLogin?'active':''} onClick={()=>{setIsAdminLogin(false);setRegister(false)}}>Student</button><button className={isAdminLogin?'active':''} onClick={()=>{setIsAdminLogin(true);setRegister(false)}}>Administrator</button></div>
      <form onSubmit={submit} className="form-fields">{register&&<><label>Full name<input required maxLength={120} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Maria Santos"/></label><label>Student number <span className="optional">(optional)</span><input maxLength={40} value={number} onChange={e=>setNumber(e.target.value)} placeholder="e.g. 2026-001"/></label></>}
      {!isAdminLogin&&<label>Email address<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="student@example.com" autoComplete="email"/></label>}
      {isAdminLogin&&<div className="admin-user"><ShieldCheck size={18}/> Username: <b>admin</b></div>}
      <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} placeholder="Enter your password" autoComplete={register?'new-password':'current-password'}/></label>
      {authError&&<p className="auth-error" role="alert">{authError}</p>}<button type="submit" disabled={busy} className="btn primary auth-submit">{busy?'Processing…':register?'Create student account':'Sign in'} <ChevronRight size={17}/></button></form>
      {!isAdminLogin&&<p className="signup-toggle">{register?'Already have an account?':'New to FCPC Learning Hub?'} <button onClick={()=>setRegister(v=>!v)}>{register?'Sign in':'Register here'}</button></p>}
      {isAdminLogin&&<p className="auth-note">Administrator accounts are created securely during setup.</p>}
      <div className="auth-footnote">Your learning. Your progress. Your future.</div>
    </div></section></div>;
}

function Stat({title,value,Icon,color,foot}:{title:string;value:any;Icon:any;color:string;foot:string}){return <div className="stat-card"><div className="stat-header"><span>{title}</span><div className={`stat-icon ${color}`}><Icon size={20}/></div></div><div className="stat-value">{value}</div><div className="stat-foot">{foot}</div></div>}
function Empty({title,body}:{title:string;body:string}){return <div className="empty"><BookOpen size={29}/><h4>{title}</h4><p>{body}</p></div>}
function LessonForm({busy,courses,onSubmit}:{busy:boolean;courses:RecordItem[];onSubmit:(title:string,description:string,course:string,file:File,week:number,publishAt:string|null,videoUrl:string|null)=>void}){
 const [title,setTitle]=useState(''),[description,setDescription]=useState(''),[course,setCourse]=useState(courses[0]?.id||''),[file,setFile]=useState<File|null>(null),[week,setWeek]=useState(1),[publishAt,setPublishAt]=useState(''),[video,setVideo]=useState('');
 return <form className="form-fields" onSubmit={e=>{e.preventDefault();if(!file)return;if(video&&!(video.startsWith('https://')||video.startsWith('http://')))return alert('Video URL must start with https:// or http://');onSubmit(title.trim(),description.trim(),course,file,week,publishAt?new Date(publishAt).toISOString():null,video.trim()||null)}}><label>Lesson title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)}/></label><label>Subject<select value={course} onChange={e=>setCourse(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Description<textarea rows={3} value={description} onChange={e=>setDescription(e.target.value)}/></label><div className="form-grid"><label>Week / module<input type="number" min="1" max="24" value={week} onChange={e=>setWeek(Number(e.target.value))}/></label><label>Scheduled publish date (optional)<input type="datetime-local" value={publishAt} onChange={e=>setPublishAt(e.target.value)}/></label></div><label>Optional external lesson video link<input type="url" value={video} onChange={e=>setVideo(e.target.value)} placeholder="https://www.youtube.com/watch?v=…"/></label><label>Slides (PPTX or PDF, up to 15 MB)<input type="file" accept=".pptx,.pdf" required onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button type="submit" className="btn primary form-submit" disabled={busy||!file||!course}>{busy?'Uploading…':'Publish or schedule lesson'}</button></form>;
}
function TaskForm({busy,courses,onSubmit}:{busy:boolean;courses:RecordItem[];onSubmit:(data:RecordItem)=>void}){
  const [title,setTitle]=useState('');const [instructions,setInstructions]=useState('');const [course,setCourse]=useState(courses[0]?.id||'');const [due,setDue]=useState('');const [points,setPoints]=useState(100);
  return <form className="form-fields" onSubmit={e=>{e.preventDefault();onSubmit({title:title.trim(),instructions:instructions.trim(),course_id:course,due_at:due?new Date(due).toISOString():null,max_score:points});}}><label>Assignment title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="AI in Everyday Life — Reflection"/></label><label>Subject<select value={course} onChange={e=>setCourse(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Instructions<textarea required rows={5} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Instructions, rubric, and upload requirements"/></label><div className="form-grid"><label>Due date <span className="optional">(optional)</span><input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><label>Maximum score<input required type="number" step="0.01" min="1" value={points} onChange={e=>setPoints(Number(e.target.value))}/></label></div><button className="btn primary form-submit" disabled={busy||!course}>{busy?'Creating…':'Publish assignment'}</button></form>;
}
function AnnouncementForm({busy,courses,onSubmit}:{busy:boolean;courses:RecordItem[];onSubmit:(data:RecordItem)=>void}){
  const [title,setTitle]=useState('');const [body,setBody]=useState('');const [course,setCourse]=useState('');
  return <form className="form-fields" onSubmit={e=>{e.preventDefault();onSubmit({title:title.trim(),body:body.trim(),course_id:course||null});}}><label>Announcement title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Important class update"/></label><label>Audience<select value={course} onChange={e=>setCourse(e.target.value)}><option value="">All subjects</option>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Message<textarea required rows={6} value={body} onChange={e=>setBody(e.target.value)} placeholder="Share the details with your students…"/></label><button className="btn primary form-submit" disabled={busy}>{busy?'Posting…':'Post announcement'}</button></form>;
}
function QuizForm({busy,courses,onSubmit}:{busy:boolean;courses:RecordItem[];onSubmit:(data:RecordItem)=>void}){
  const [title,setTitle]=useState('');const [instructions,setInstructions]=useState('');const [course,setCourse]=useState(courses[0]?.id||'');const [opens,setOpens]=useState('');const [closes,setCloses]=useState('');const [questions,setQuestions]=useState([starterQuestion()]);
  function changeQuestion(i:number,field:string,value:any){setQuestions(q=>q.map((item,n)=>i===n?{...item,[field]:value}:item));}
  function changeOption(i:number,idx:number,value:string){setQuestions(q=>q.map((item,n)=>i===n?{...item,options:item.options.map((o,j)=>j===idx?value:o)}:item));}
  function save(e:React.FormEvent){e.preventDefault();if(questions.some(q=>!q.prompt.trim()||q.options.some(o=>!o.trim())))return;
    if(opens&&closes&&new Date(closes)<=new Date(opens))return alert('The closing time must be after the opening time.');
    onSubmit({title:title.trim(),instructions:instructions.trim(),course_id:course,opens_at:opens?new Date(opens).toISOString():null,closes_at:closes?new Date(closes).toISOString():null,questions});
  }
  return <form className="form-fields" onSubmit={save}><label>Quiz title<input required maxLength={180} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Week 2 — AI Basics Quiz"/></label><label>Subject<select value={course} onChange={e=>setCourse(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label><label>Instructions<textarea rows={2} value={instructions} onChange={e=>setInstructions(e.target.value)} placeholder="Answer all questions. One attempt is allowed."/></label><div className="form-grid"><label>Opens <span className="optional">(optional)</span><input type="datetime-local" value={opens} onChange={e=>setOpens(e.target.value)}/></label><label>Closes <span className="optional">(optional)</span><input type="datetime-local" value={closes} onChange={e=>setCloses(e.target.value)}/></label></div><div className="quiz-builder-label">Questions <span>{questions.length} total</span></div>{questions.map((q,i)=><div className="question-builder" key={i}><div className="qb-head"><strong>Question {i+1}</strong>{questions.length>1&&<button type="button" className="mini-action danger" onClick={()=>setQuestions(a=>a.filter((_,j)=>j!==i))}><Trash2 size={15}/></button>}</div><label>Question<input required value={q.prompt} onChange={e=>changeQuestion(i,'prompt',e.target.value)} placeholder="Enter the question"/></label><div className="form-grid"><label>Points<input type="number" required min={0.5} step={0.5} value={q.points} onChange={e=>changeQuestion(i,'points',Number(e.target.value))}/></label></div><span className="input-caption">Choices (select the correct answer)</span>{q.options.map((o,j)=><div className="answer-editor" key={j}><input type="radio" name={`correct_${i}`} checked={q.correct===j} onChange={()=>changeQuestion(i,'correct',j)} title="Correct answer"/><span>{String.fromCharCode(65+j)}</span><input required placeholder={`Option ${String.fromCharCode(65+j)}`} value={o} onChange={e=>changeOption(i,j,e.target.value)}/></div>)}</div>)}<button type="button" className="btn outline" onClick={()=>setQuestions(q=>[...q,starterQuestion()])}><Plus size={16}/>Add question</button><p className="form-hint">Correct options are stored privately, and scores are calculated by the database, not the browser.</p><button className="btn primary form-submit" disabled={busy||!course}>{busy?'Saving quiz…':'Publish quiz'}</button></form>;
}
function LessonViewer({lesson,isAdmin,completed,onComplete}:{lesson:RecordItem;isAdmin:boolean;completed:boolean;onComplete:()=>void}){
  const [signed,setSigned]=useState('');
  const [status,setStatus]=useState('Preparing your lesson…');
  useEffect(()=>{
    let alive=true;
    setSigned('');setStatus('Preparing your lesson…');
    (async()=>{
      try{
        const {data,error}=await db().storage.from('lessons').createSignedUrl(lesson.file_path,3600);
        if(error)throw error;
        if(alive){setSigned(data.signedUrl);setStatus('');}
      }catch(e){if(alive)setStatus('File link unavailable. '+prettyError(e));}
    })();
    return ()=>{alive=false};
  },[lesson.id,lesson.file_path]);
  return <div className="lesson-viewer">
    <p className="viewer-desc">Week {lesson.week_number||1} · {lesson.description}</p>
    {lesson.video_url&&/^https?:\/\//.test(lesson.video_url)&&<a className="btn outline" href={lesson.video_url} target="_blank" rel="noopener noreferrer">Watch linked lesson video</a>}
    {status&&<div className="preview-status">{status}</div>}
    {lesson.file_type==='pdf'&&signed&&<iframe className="pdf-frame" title={lesson.title} src={signed+'#toolbar=1'} />}
    {lesson.file_type==='pptx'&&<SlideDeck filePath={lesson.file_path}/>}
    <div className="viewer-actions">
      {signed&&<a href={signed} className="btn outline" target="_blank" rel="noopener noreferrer"><Download size={17}/>Open original file</a>}
      {!isAdmin&&<button className={completed?'btn outline':'btn primary'} onClick={onComplete}><CheckCircle2 size={17}/>{completed?'Mark as incomplete':'Mark as completed'}</button>}
    </div>
    <p className="form-hint">Slides display one at a time in your browser. Transitions, embedded videos and some fonts may differ from PowerPoint.</p>
  </div>;
}
function SubmissionForm({busy,task,submission,onSubmit}:{busy:boolean;task:RecordItem;submission?:RecordItem;onSubmit:(file:File,comment:string)=>void}){
  const [file,setFile]=useState<File|null>(null);const [comment,setComment]=useState(submission?.comment||'');const [download,setDownload]=useState(false);const [fileError,setFileError]=useState('');const [validating,setValidating]=useState(false);const checkCounter=useRef(0);
  async function getFile(){if(!submission)return;setDownload(true);try{await openFile('submissions',submission.file_path);}catch(e){alert(prettyError(e));}finally{setDownload(false);}}
  async function chooseFile(event:React.ChangeEvent<HTMLInputElement>){
    const input=event.currentTarget;
    const selected=input.files?.[0]||null;
    const requestId=++checkCounter.current;
    setFile(null);setFileError('');
    if(!selected){setValidating(false);return;}
    setValidating(true);
    try{
      await validateSubmissionFile(selected);
      if(requestId===checkCounter.current)setFile(selected);
    }catch(e){
      if(requestId===checkCounter.current){setFileError(prettyError(e));input.value='';}
    }finally{if(requestId===checkCounter.current)setValidating(false);}
  }
  return <div><div className="submission-summary"><h3>{task.title}</h3><p>{task.instructions}</p><div className="chips"><span>Due {ago(task.due_at)}</span><span>Maximum {task.max_score} points</span></div>{Array.isArray(task.rubric)&&task.rubric.length>0&&<div className="v3-rubric"><b>Scoring rubric</b>{task.rubric.map((r:RecordItem)=><p key={r.id}>{r.label}: {r.points} pts</p>)}</div>}</div>{submission&&<div className="existing-submission"><CheckCircle2 size={20}/><div><b>Submitted {ago(submission.submitted_at)}</b><p>{submission.original_filename}</p>{submission.score!=null&&<p><strong>Grade: {submission.score}/{task.max_score}</strong>{submission.feedback&&` · ${submission.feedback}`}</p>}<button className="text-link" type="button" onClick={getFile} disabled={download}>View submitted file</button></div></div>}{submission?.score!=null&&!submission.returned_for_revision?<p className="form-hint">This assignment is graded. Contact the instructor for feedback.</p>:<form className="form-fields" onSubmit={e=>{e.preventDefault();if(file)onSubmit(file,comment);}}><label>Upload your work<div className="upload-target"><UploadCloud size={25}/><b>{file?.name||(validating?'Checking document…':'Choose a PDF or DOCX file')}</b><small>PDF or DOCX only · Max 15 MB · File type and contents verified</small><input required type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseFile}/></div></label>{fileError&&<p role="alert" className="auth-error">{fileError}</p>}<label>Notes for your instructor<textarea rows={3} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Optional comments about your work"/></label><p className="form-hint">Submission windows and resubmission permission are enforced by the database. After the due time, uploads are blocked. Returned work may be revised before the deadline.</p><button className="btn primary form-submit" disabled={!file||validating||busy||!!(task.due_at&&Date.now()>Date.parse(task.due_at))||!!(task.opens_at&&Date.now()<Date.parse(task.opens_at))||!!(submission&&!task.allow_resubmission)}>{busy?'Submitting…':submission?'Replace submission':'Submit assignment'}</button></form>}</div>;
}
function TakeQuiz({quiz,busy,onSubmit}:{quiz:RecordItem;busy:boolean;onSubmit:(answers:any[])=>void}){
  const [questions,setQuestions]=useState<RecordItem[]>([]);const [options,setOptions]=useState<RecordItem[]>([]);const [selected,setSelected]=useState<Record<string,string>>({});const [loading,setLoading]=useState(true);const [error,setError]=useState('');
  useEffect(()=>{let live=true;(async()=>{try{
    const api=db();const {data:q,error:qe}=await api.from('quiz_questions').select('*').eq('quiz_id',quiz.id).order('position');if(qe)throw qe;
    const ids=(q||[]).map(x=>x.id);const {data:o,error:oe}=ids.length?await api.from('quiz_options').select('id,question_id,label,position').in('question_id',ids).order('position'):{data:[],error:null};if(oe)throw oe;
    if(live){setQuestions(q||[]);setOptions(o||[]);}
  }catch(e){if(live)setError(prettyError(e));}finally{if(live)setLoading(false);}})();return()=>{live=false}},[quiz.id]);
  if(loading)return <div className="preview-status">Loading questions…</div>;
  if(error)return <div className="preview-status">{error}</div>;
  return <form className="form-fields" onSubmit={e=>{e.preventDefault();if(!window.confirm('Submit your final answers? You only get one attempt.'))return;onSubmit(questions.map(q=>({question_id:q.id,option_id:selected[q.id]})));}}><div className="quiz-intro"><p>{quiz.instructions||'Choose the best answer for each question.'}</p><span>{questions.length} questions · One attempt</span></div>{questions.map((q,i)=><div key={q.id} className="take-question"><h3>{i+1}. {q.prompt} <small>({q.points} {q.points===1?'pt':'pts'})</small></h3>{options.filter(o=>o.question_id===q.id).map(o=><label key={o.id} className={`answer-choice ${selected[q.id]===o.id?'checked':''}`}><input required type="radio" name={`q_${q.id}`} checked={selected[q.id]===o.id} onChange={()=>setSelected(old=>({...old,[q.id]:o.id}))}/><span>{o.label}</span></label>)}</div>)}<button className="btn primary form-submit" type="submit" disabled={busy||!questions.length||questions.some(q=>!selected[q.id])}>{busy?'Submitting…':'Submit final answers'}</button></form>;
}
function GradeForm({busy,submission,task,student,onSubmit}:{busy:boolean;submission:RecordItem;task?:RecordItem;student?:RecordItem;onSubmit:(score:number,feedback:string)=>void}){
  const [score,setScore]=useState(submission.score??'');const [feedback,setFeedback]=useState(submission.feedback??'');
  return <form className="form-fields" onSubmit={e=>{e.preventDefault();onSubmit(Number(score),feedback)}}><div className="submission-summary"><p><b>Student:</b> {student?.full_name||'Student'}</p><p><b>Assignment:</b> {task?.title}</p><p><b>File:</b> {submission.original_filename}</p></div><label>Score (max {task?.max_score})<input required type="number" min={0} max={task?.max_score} step="0.01" value={score} onChange={e=>setScore(e.target.value)}/></label><label>Feedback<textarea rows={5} value={feedback} onChange={e=>setFeedback(e.target.value)} placeholder="Explain the score and suggest improvements…"/></label><button type="submit" className="btn primary form-submit" disabled={busy||score===''||Number(score)<0||Number(score)>Number(task?.max_score)}>{busy?'Saving…':'Save grade'}</button></form>;
}
function ClassSectionsPanel({isAdmin,courses,sections,members,profiles,userId,onJoin,onChanged,notify}:{
  isAdmin:boolean;courses:RecordItem[];sections:RecordItem[];members:RecordItem[];profiles:RecordItem[];
  userId:string;onJoin:(code:string)=>Promise<boolean>;onChanged:()=>void;notify:(message:string,error?:boolean)=>void;
}){
  const [code,setCode]=useState('');
  const [name,setName]=useState('');
  const [course,setCourse]=useState(courses[0]?.id||'');
  const [assignmentWeight,setAssignmentWeight]=useState(60);
  const [lastCode,setLastCode]=useState('');
  const [lastSection,setLastSection]=useState('');
  const [busy,setBusy]=useState(false);
  const [student,setStudent]=useState('');
  const [destination,setDestination]=useState('');
  const mySections=sections.filter(s=>members.some(m=>m.section_id===s.id&&m.user_id===userId));
  async function create(e:React.FormEvent){e.preventDefault();setBusy(true);
    try {
      const {data,error}=await db().rpc('create_section',{p_course_id:course,p_name:name.trim(),p_assignment_weight:assignmentWeight,p_quiz_weight:100-assignmentWeight});
      if(error)throw error;
      const result=Array.isArray(data)?data[0]:data;
      if(!result?.enrollment_code)throw Error('Section was created but the new enrollment code was not returned.');
      setLastCode(result.enrollment_code);setLastSection(result.section_id);setName('');notify('Section created. Copy the enrollment code below.');await onChanged();
    }catch(e){notify(prettyError(e),true);}finally{setBusy(false);}
  }
  async function rotate(section:RecordItem){
    if(!window.confirm(`Regenerate the code for ${section.name}? The old code will immediately stop working.`))return;
    setBusy(true);try{
      const {data,error}=await db().rpc('rotate_section_code',{p_section_id:section.id});if(error)throw error;
      setLastCode(String(data));setLastSection(section.id);notify('Code changed. Copy and share the new one securely.');
    }catch(e){notify(prettyError(e),true);}finally{setBusy(false);}
  }
  async function archiveSection(section:RecordItem,archived:boolean){
    if(archived&&!window.confirm('Archive '+section.name+'? Existing grades and attendance will be preserved, but new students cannot select it.'))return;
    setBusy(true);
    try{
      const {error}=await db().rpc('archive_class_section',{p_section:section.id,p_archive:archived});
      if(error)throw error;
      notify(archived?'Section archived.':'Section restored. Open enrollment again when ready.');
      await onChanged();
    }catch(e){notify(prettyError(e),true);}finally{setBusy(false);}
  }
  async function setOpen(section:RecordItem){setBusy(true);try{
    const {error}=await db().from('class_sections').update({is_open:!section.is_open}).eq('id',section.id);if(error)throw error;
    notify(section.is_open?'Enrollment closed for this section.':'Enrollment reopened.');await onChanged();
  }catch(e){notify(prettyError(e),true);}finally{setBusy(false);}}
  async function transfer(e:React.FormEvent){e.preventDefault();setBusy(true);try{
    const {error}=await db().rpc('transfer_section',{p_student:student.split('|')[0],p_section:destination});if(error)throw error;
    notify('Student moved to the selected section.');await onChanged();
  }catch(e){notify(prettyError(e),true);}finally{setBusy(false);}}
  return <div className="sections-grid">
    {isAdmin?<>
      <section className="panel padded-panel"><div className="panel-heading"><div><h3>Create class section</h3><span>New students choose an open section after registration. Existing students can also use section enrollment codes.</span></div></div>
        <form className="form-fields" onSubmit={create}>
          <label>Subject<select required value={course} onChange={e=>setCourse(e.target.value)}>{courses.map(c=><option key={c.id} value={c.id}>{c.title}</option>)}</select></label>
          <label>Section name<input required minLength={2} maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. BSBA 1A / Monday 8:00 AM"/></label>
          <div className="form-grid"><label>Assignments (%)<input type="number" required min={0} max={100} value={assignmentWeight} onChange={e=>setAssignmentWeight(Number(e.target.value))}/></label><label>Quizzes (%)<input readOnly value={100-assignmentWeight}/></label></div>
          <p className="form-hint">Each section can have its own grading weights. They always add to 100%.</p>
          <button className="btn primary form-submit" disabled={busy||!course||!name.trim()}><Plus size={17}/> Create section</button>
        </form>
      </section>
      <section className="panel padded-panel"><div className="panel-heading"><h3>Latest enrollment code</h3></div>
        {lastCode?<><div className="generated-code" aria-label="New section enrollment code"><KeyRound size={19}/><code>{lastCode}</code></div><p className="form-hint">For {sections.find(s=>s.id===lastSection)?.name||'the new section'}. The code is shown only after creation or regeneration. Save it somewhere private now.</p><button className="btn outline" onClick={async()=>{try{await navigator.clipboard.writeText(lastCode);notify('Copied enrollment code.');}catch{notify('Copy manually from the displayed code.',true);}}}><KeyRound size={16}/>Copy code</button></>:<Empty title="No code shown" body="Create a section or regenerate an existing section code to reveal its new code."/>}
        <div className="report-note"><LockKeyhole size={17}/> Codes are generated on the database server. Students cannot query a list of codes.</div>
      </section>
      <section className="panel wide-panel"><div className="panel-heading"><div><h3>Manage sections</h3><span>{sections.filter(s=>!s.archived_at).length} active sections; archived sections are kept for academic history. Shared subject materials are visible to all sections of that subject.</span></div></div>
        {sections.map(s=><div className="section-admin-row" key={s.id}><div className="section-title"><strong>{s.name}</strong><span>{courses.find(c=>c.id===s.course_id)?.title} · {members.filter(m=>m.section_id===s.id).length} students · {s.archived_at?'Archived':s.is_open?'Enrollment open':'Enrollment closed'}</span></div><div className="section-actions">{!s.archived_at&&<><SectionWeightEditor section={s} busy={busy} onChanged={onChanged} notify={notify}/><button disabled={busy} className="btn outline small" onClick={()=>rotate(s)}><KeyRound size={14}/>New code</button><button disabled={busy} className="btn outline small" onClick={()=>setOpen(s)}>{s.is_open?'Close joining':'Open joining'}</button></>}<button disabled={busy} className="btn outline small" onClick={()=>archiveSection(s,!s.archived_at)}>{s.archived_at?'Restore section':'Archive section'}</button></div></div>)}
        {!sections.length&&<Empty title="Create your first section" body="Begin by making a section for one of the subjects."/>}
      </section>
      <section className="panel wide-panel padded-panel"><div className="panel-heading"><div><h3>Transfer a student</h3><span>Move a registered student to a different section of the same subject.</span></div></div>
        <form className="form-fields transfer-form" onSubmit={transfer}><label>Student and current section<select required value={student} onChange={e=>{setStudent(e.target.value);setDestination('');}}><option value="">Select student</option>{members.map(m=><option key={`${m.user_id}_${m.course_id}`} value={`${m.user_id}|${m.course_id}`}>{profiles.find(p=>p.id===m.user_id)?.full_name||'Student'} · {sections.find(s=>s.id===m.section_id)?.name}</option>)}</select></label><label>New section<select required value={destination} onChange={e=>setDestination(e.target.value)}><option value="">Choose destination</option>{sections.filter(s=>!s.archived_at&&s.course_id===student.split('|')[1]&&s.id!==members.find(m=>m.user_id===student.split('|')[0]&&m.course_id===student.split('|')[1])?.section_id).map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label><button className="btn primary" disabled={busy||!student||!destination}>Transfer student</button></form>
      </section>
    </>:<>
      <section className="panel padded-panel"><div className="panel-heading"><div><h3>Join your class</h3><span>Ask your instructor for the enrollment code.</span></div></div>
        <form className="form-fields" onSubmit={async e=>{e.preventDefault();if(!code.trim())return;if(await onJoin(code))setCode('');}}><label>Enrollment code<input required spellCheck={false} autoCapitalize="characters" value={code} onChange={e=>setCode(e.target.value.toUpperCase())} placeholder="FCPC-..."/></label><button className="btn primary form-submit"><KeyRound size={17}/>Join section</button></form>
        <p className="form-hint">You can be in one section per subject. To change sections, contact your instructor.</p>
      </section>
      <section className="panel padded-panel"><div className="panel-heading"><h3>My classes</h3></div>{mySections.length?mySections.map(s=><div className="class-tile" key={s.id}><b>{s.name}</b><span>{courses.find(c=>c.id===s.course_id)?.title}</span><span>Assignments {s.assignment_weight}% · Quizzes {s.quiz_weight}%</span></div>):<Empty title="No class sections yet" body="Your lessons and assessments will appear after joining with a valid code."/>}</section>
    </>}
  </div>;
}
function SectionWeightEditor({section,busy,onChanged,notify}:{section:RecordItem;busy:boolean;onChanged:()=>void;notify:(message:string,error?:boolean)=>void}){
  const [assignment,setAssignment]=useState(Number(section.assignment_weight));const [saving,setSaving]=useState(false);
  useEffect(()=>setAssignment(Number(section.assignment_weight)),[section.assignment_weight]);
  async function save(){setSaving(true);try{
    if(!Number.isInteger(assignment)||assignment<0||assignment>100)throw Error('Assignment weight must be a whole number from 0 to 100.');
    const {error}=await db().from('class_sections').update({assignment_weight:assignment,quiz_weight:100-assignment}).eq('id',section.id);if(error)throw error;
    notify('Grading percentages updated.');await onChanged();
  }catch(e){notify(prettyError(e),true);}finally{setSaving(false);}}
  return <div className="weight-inline"><label title="Assignment weighting">Tasks <input type="number" min={0} max={100} value={assignment} onChange={e=>setAssignment(Number(e.target.value))}/>%</label><span>Quizzes {100-assignment}%</span><button className="btn outline small" disabled={busy||saving||assignment===Number(section.assignment_weight)} onClick={save}>Save weights</button></div>;
}

function AdminGrades({tasks,submissions,attempts,quizzes,profiles,courses,sections,members,onGrade}:{tasks:RecordItem[];submissions:RecordItem[];attempts:RecordItem[];quizzes:RecordItem[];profiles:RecordItem[];courses:RecordItem[];sections:RecordItem[];members:RecordItem[];onGrade:(s:RecordItem)=>void}){
  const [sectionId,setSectionId]=useState('all');
  const selected=sections.find(s=>s.id===sectionId);
  const studentBelongs=(id:string,courseId:string)=>!selected || (selected.course_id===courseId&&members.some(m=>m.section_id===selected.id&&m.user_id===id));
  const entries=submissions.filter(s=>tasks.some(t=>t.id===s.task_id&&studentBelongs(s.student_id,t.course_id)));
  const filteredAttempts=attempts.filter(a=>quizzes.some(q=>q.id===a.quiz_id&&studentBelongs(a.student_id,q.course_id)));
  async function preview(path:string){try{await openFile('submissions',path);}catch(e){alert(prettyError(e));}}
  function exportGrades(){downloadCSV('fcpc-gradebook.csv',[
    ['Student','Student number','Subject','Section','Assignment','Submitted','Score','Max score','Feedback'],
    ...entries.map(s=>{const p=profiles.find(p=>p.id===s.student_id),t=tasks.find(t=>t.id===s.task_id), m=members.find(m=>m.user_id===s.student_id&&m.course_id===t?.course_id);return [p?.full_name||'',p?.student_number||'',courses.find(c=>c.id===t?.course_id)?.title||'',sections.find(x=>x.id===m?.section_id)?.name||'',t?.title||'',s.submitted_at,s.score??'',t?.max_score??'',s.feedback||''];})
  ]);}
  return <><div className="grade-tools"><label>Section <select value={sectionId} onChange={e=>setSectionId(e.target.value)}><option value="all">All sections</option>{sections.map(s=><option key={s.id} value={s.id}>{courses.find(c=>c.id===s.course_id)?.code} · {s.name}</option>)}</select></label><button className="btn outline" onClick={exportGrades}><Download size={15}/>Export gradebook CSV</button></div>
    <div className="stats-grid compact"><Stat title="Submitted work" value={entries.length} Icon={ClipboardList} color="blue" foot="Assignment files"/><Stat title="Awaiting grade" value={entries.filter(s=>s.score==null).length} Icon={Clock3} color="amber" foot="Needs instructor review"/><Stat title="Graded" value={entries.filter(s=>s.score!=null).length} Icon={CheckCircle2} color="green" foot="Feedback recorded"/><Stat title="Quiz attempts" value={filteredAttempts.length} Icon={FileQuestion} color="violet" foot="Auto-graded"/></div>
    <section className="panel"><div className="panel-heading"><div><h3>Assignment submissions</h3><span>Filtered by section when selected.</span></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Assignment</th><th>Submitted</th><th>Score</th><th>Actions</th></tr></thead><tbody>{entries.map(s=>{const t=tasks.find(t=>t.id===s.task_id);return <tr key={s.id}><td><b>{profiles.find(p=>p.id===s.student_id)?.full_name||'Student'}</b></td><td>{t?.title}</td><td>{ago(s.submitted_at)}</td><td>{s.score==null?<span className="chip-warn">Pending</span>:`${s.score} / ${t?.max_score}`}</td><td><div className="table-actions"><button className="btn outline small" onClick={()=>preview(s.file_path)}><Eye size={15}/>File</button><button className="btn primary small" onClick={()=>onGrade(s)}>Grade</button></div></td></tr>})}</tbody></table>{!entries.length&&<Empty title="No submissions" body="Student work will appear here."/>}</div></section>
    <section className="panel"><div className="panel-heading"><h3>Auto-graded quizzes</h3></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Quiz</th><th>Score</th><th>Submitted</th></tr></thead><tbody>{filteredAttempts.map(a=><tr key={a.id}><td>{profiles.find(p=>p.id===a.student_id)?.full_name||'Student'}</td><td>{quizzes.find(q=>q.id===a.quiz_id)?.title}</td><td><b>{a.status==='pending_review'?'Essay review pending':a.status==='in_progress'?'In progress':`${a.score}/${a.max_score}`}</b></td><td>{ago(a.submitted_at)}</td></tr>)}</tbody></table></div></section></>;
}
function StudentGrades({userId,courses,sections,members,tasks,lessons,progress,submissions,attempts,quizzes}:{userId:string;courses:RecordItem[];sections:RecordItem[];members:RecordItem[];tasks:RecordItem[];lessons:RecordItem[];progress:RecordItem[];submissions:RecordItem[];attempts:RecordItem[];quizzes:RecordItem[]}){
  return <div className="student-performance">
    {courses.map(c=>{const membership=members.find(m=>m.course_id===c.id&&m.user_id===userId);const section=sections.find(s=>s.id===membership?.section_id);
      if(!section)return null;
      const report=calculatePerformance(userId,c.id,section,tasks,quizzes,lessons,submissions,attempts,progress);
      const tList=tasks.filter(t=>t.course_id===c.id);const qList=quizzes.filter(q=>q.course_id===c.id);
      return <section className="panel padded-panel" key={c.id}><div className="panel-heading"><div><h3>{c.title}</h3><span>{section.name} · Assignments {section.assignment_weight}% · Quizzes {section.quiz_weight}%</span></div></div>
        <div className="report-hero"><div><small>PROVISIONAL WEIGHTED GRADE</small><strong>{report.provisionalGrade!==null?`${report.provisionalGrade}%`:'Not yet available'}</strong><span>Based only on assessed work; not an official final grade.</span></div><ChartColumnIncreasing size={46}/></div>
        <div className="report-metrics"><div><b>{report.assignmentPercent===null?'—':`${report.assignmentPercent}%`}</b><span>Assignments · {report.assignmentGraded}/{report.assignmentTotal} graded</span></div><div><b>{report.quizPercent===null?'—':`${report.quizPercent}%`}</b><span>Quizzes · {report.quizAttempted}/{report.quizTotal} attempted</span></div><div><b>{report.lessonCompleted}/{report.lessonTotal}</b><span>Lessons completed</span></div><div><b>{report.pendingFeedback}</b><span>Awaiting grading</span></div></div>
        <p className="report-note">{report.representedWeight<100?`Only ${report.representedWeight}% of grade categories currently have scores. Unscored categories are excluded and the active weights are proportionally adjusted. `:''}Missed deadlines: {report.missingAssignments} assignments, {report.missedQuizzes} quizzes. Missing or pending work is not automatically scored zero.</p>
        <div className="table-wrap"><table><thead><tr><th>Assessment</th><th>Type</th><th>Status</th><th>Score / feedback</th></tr></thead><tbody>
          {tList.map(t=>{const s=submissions.find(x=>x.task_id===t.id);return <tr key={t.id}><td><b>{t.title}</b></td><td>Assignment</td><td>{s?(s.score==null?'Awaiting grade':'Graded'):(t.due_at&&Date.parse(t.due_at)<Date.now()?'Past due':'Not submitted')}</td><td>{s?.score!=null?`${s.score} / ${t.max_score}`:'—'} {s?.feedback&&<small>· {s.feedback}</small>}</td></tr>})}
          {qList.map(q=>{const own=attempts.filter(x=>x.quiz_id===q.id);const reviewed=own.filter(a=>a.status==='graded').sort((a,b)=>Number(b.score)/Number(b.max_score)-Number(a.score)/Number(a.max_score));const a=reviewed[0];const pending=own.some(x=>x.status==='pending_review');return <tr key={q.id}><td><b>{q.title}</b></td><td>Quiz</td><td>{pending?'Essay review pending':a?'Graded':own.some(x=>x.status==='in_progress')?'In progress':q.closes_at&&Date.parse(q.closes_at)<Date.now()?'Closed':'Not attempted'}</td><td>{a?`${a.score} / ${a.max_score}`:'—'}</td></tr>})}
        </tbody></table>{!tList.length&&!qList.length&&<Empty title="No assessments" body="Your instructor has not published any graded activities yet."/>}</div>
      </section>})}
    {!courses.length&&<Empty title="No grades yet" body="Join a class section with your instructor's code to begin tracking scores."/>}
  </div>;
}
function PerformanceReports({courses,sections,members,profiles,tasks,quizzes,lessons,progress,submissions,attempts}:{courses:RecordItem[];sections:RecordItem[];members:RecordItem[];profiles:RecordItem[];tasks:RecordItem[];quizzes:RecordItem[];lessons:RecordItem[];progress:RecordItem[];submissions:RecordItem[];attempts:RecordItem[]}){
  const [sectionId,setSectionId]=useState('all');
  const rows=members.filter(m=>sectionId==='all'||m.section_id===sectionId).map(m=>{
    const section=sections.find(s=>s.id===m.section_id),p=profiles.find(x=>x.id===m.user_id);
    if(!section||!p)return null;
    return {member:m,section,student:p,report:calculatePerformance(m.user_id,m.course_id,section,tasks,quizzes,lessons,submissions,attempts,progress)};
  }).filter(Boolean) as {member:RecordItem;section:RecordItem;student:RecordItem;report:ReturnType<typeof calculatePerformance>}[];
  function exportReport(){downloadCSV('fcpc-student-performance.csv',[
    ['Student','Student number','Subject','Section','Assignments weight %','Quizzes weight %','Assignments %','Quizzes %','Provisional grade %','Grading categories represented %','Lessons completed','Total lessons','Assignments submitted','Total assignments','Assignments graded','Pending grading','Past-due unsubmitted assignments','Quizzes attempted','Total quizzes','Closed unattempted quizzes','Last activity'],
    ...rows.map(x=>[x.student.full_name,x.student.student_number,courses.find(c=>c.id===x.member.course_id)?.title,x.section.name,x.section.assignment_weight,x.section.quiz_weight,x.report.assignmentPercent,x.report.quizPercent,x.report.provisionalGrade,x.report.representedWeight,x.report.lessonCompleted,x.report.lessonTotal,x.report.assignmentSubmitted,x.report.assignmentTotal,x.report.assignmentGraded,x.report.pendingFeedback,x.report.missingAssignments,x.report.quizAttempted,x.report.quizTotal,x.report.missedQuizzes,x.report.lastActivity])
  ]);}
  const gradedRows=rows.filter(x=>x.report.provisionalGrade!==null);
  const avg=gradedRows.length?Math.round(gradedRows.reduce((n,x)=>n+(x.report.provisionalGrade||0),0)/gradedRows.length*100)/100:null;
  return <><div className="grade-tools"><label>Filter section <select value={sectionId} onChange={e=>setSectionId(e.target.value)}><option value="all">All sections</option>{sections.map(s=><option key={s.id} value={s.id}>{courses.find(c=>c.id===s.course_id)?.code} · {s.name}</option>)}</select></label><button className="btn outline" onClick={exportReport}><Download size={16}/>Export performance CSV</button></div>
    <div className="stats-grid compact"><Stat title="Student enrollments" value={rows.length} Icon={Users} color="blue" foot="One entry per subject/section"/><Stat title="Provisional average" value={avg!==null?`${avg}%`:'—'} Icon={ChartColumnIncreasing} color="violet" foot="Only students with scores"/><Stat title="Pending grades" value={rows.reduce((n,x)=>n+x.report.pendingFeedback,0)} Icon={Clock3} color="amber" foot="Submitted but not graded"/><Stat title="Past-due work" value={rows.reduce((n,x)=>n+x.report.missingAssignments+x.report.missedQuizzes,0)} Icon={ClipboardList} color="green" foot="Missing after deadline"/></div>
    <p className="report-note"><ShieldCheck size={16}/> Grades are provisional. Weighted categories without any scored work are excluded and remaining weights are normalized. Unsubmitted and ungraded activities are tracked separately, not marked as zero. Section membership controls who belongs in each report.</p>
    <section className="panel"><div className="panel-heading"><div><h3>Student performance</h3><span>Sort through class results and download a detailed CSV for further analysis.</span></div></div><div className="table-wrap"><table><thead><tr><th>Student</th><th>Class section</th><th>Lessons</th><th>Assignments</th><th>Quizzes</th><th>Provisional grade</th><th>Follow-up</th></tr></thead><tbody>{rows.map(x=><tr key={`${x.member.user_id}_${x.member.course_id}`}><td><b>{x.student.full_name}</b><small className="muted-line">{x.student.student_number||'No student number'}</small></td><td>{x.section.name}<small className="muted-line">{courses.find(c=>c.id===x.member.course_id)?.code}</small></td><td>{x.report.lessonCompleted}/{x.report.lessonTotal}</td><td>{x.report.assignmentPercent!==null?`${x.report.assignmentPercent}%`:'—'}<small className="muted-line">{x.report.assignmentGraded}/{x.report.assignmentTotal} graded</small></td><td>{x.report.quizPercent!==null?`${x.report.quizPercent}%`:'—'}<small className="muted-line">{x.report.quizAttempted}/{x.report.quizTotal} attempted</small></td><td><b>{x.report.provisionalGrade!==null?`${x.report.provisionalGrade}%`:'—'}</b><small className="muted-line">{x.report.representedWeight}% category coverage</small></td><td>{x.report.pendingFeedback>0&&<span className="chip-warn">{x.report.pendingFeedback} to grade</span>}{x.report.missingAssignments+x.report.missedQuizzes>0&&<span className="chip-warn">{x.report.missingAssignments+x.report.missedQuizzes} missed</span>}{!x.report.pendingFeedback&&!x.report.missingAssignments&&!x.report.missedQuizzes&&'Up to date'}</td></tr>)}</tbody></table>{!rows.length&&<Empty title="No students in selected sections" body="Invite students using the section enrollment code."/>}</div></section>
  </>;
}

async function openFile(bucket:'submissions'|'lessons',path:string){
  // Open the tab synchronously to avoid popup blockers after the async signed-URL request.
  const tab=window.open('about:blank','_blank');
  try{
    const {data,error}=await db().storage.from(bucket).createSignedUrl(path,600);
    if(error)throw error;
    if(tab)tab.location.href=data.signedUrl;
    else {const a=document.createElement('a');a.href=data.signedUrl;a.target='_blank';a.rel='noopener noreferrer';document.body.appendChild(a);a.click();a.remove();}
  }catch(e){tab?.close();throw e;}
}
