/** Scores for progress reporting. Missing or ungraded items are NOT silently treated as zeros. */
export type Item = Record<string, any>;
export interface Performance {
  assignmentPercent: number | null;
  quizPercent: number | null;
  provisionalGrade: number | null;
  representedWeight: number;
  assignmentGraded: number;
  quizAttempted: number;
  assignmentSubmitted: number;
  assignmentTotal: number;
  quizTotal: number;
  missingAssignments: number;
  missedQuizzes: number;
  pendingFeedback: number;
  lessonCompleted: number;
  lessonTotal: number;
  lastActivity: string | null;
}
const pct=(n:number,d:number)=>d>0?Math.round(n/d*10000)/100:null;
export function calculatePerformance(
  studentId: string, courseId: string, weights:Item,
  tasks:Item[], quizzes:Item[], lessons:Item[], submissions:Item[], attempts:Item[], progress:Item[]
):Performance {
  const ownSubmissions=submissions.filter(s=>s.student_id===studentId);
  const ownAttempts=attempts.filter(a=>a.student_id===studentId);
  const chosenTasks=tasks.filter(t=>t.course_id===courseId && (t.published || ownSubmissions.some(s=>s.task_id===t.id)));
  const chosenQuizzes=quizzes.filter(q=>q.course_id===courseId && (q.published || ownAttempts.some(a=>a.quiz_id===q.id)));
  const chosenLessons=lessons.filter(l=>l.course_id===courseId && l.published);
  const matchingSubmissions=ownSubmissions.filter(s=>chosenTasks.some(t=>t.id===s.task_id));
  const graded=matchingSubmissions.filter(s=>s.score!=null);
  // A timed/essay attempt is not a grade until reviewed. Use the highest graded
  // attempt per quiz (v3 policy), never add repeated attempts together.
  const best=new Map<string, Item>();
  for(const a of ownAttempts.filter(a=>a.status!=='in_progress'&&a.status!=='pending_review'&&chosenQuizzes.some(q=>q.id===a.quiz_id))){
    const current=best.get(a.quiz_id);
    if(!current || Number(a.score)/Math.max(1,Number(a.max_score))>Number(current.score)/Math.max(1,Number(current.max_score))) best.set(a.quiz_id,a);
  }
  const matchingAttempts=[...best.values()];
  const assignmentPossible=graded.reduce((n,s)=>n+Number(chosenTasks.find(t=>t.id===s.task_id)?.max_score||0),0);
  const assignmentEarned=graded.reduce((n,s)=>n+Number(s.score||0),0);
  const quizPossible=matchingAttempts.reduce((n,a)=>n+Number(a.max_score||0),0);
  const quizEarned=matchingAttempts.reduce((n,a)=>n+Number(a.score||0),0);
  const assignmentPercent=pct(assignmentEarned,assignmentPossible);
  const quizPercent=pct(quizEarned,quizPossible);
  const aw=Number(weights.assignment_weight), qw=Number(weights.quiz_weight);
  const representedWeight=(assignmentPercent!==null?aw:0)+(quizPercent!==null?qw:0);
  const provisionalGrade=representedWeight>0?Math.round(( (assignmentPercent??0)*aw+(quizPercent??0)*qw ) / representedWeight*100)/100:null;
  const now=Date.now();
  const latest=[...matchingSubmissions.map(s=>s.submitted_at),...matchingAttempts.map(a=>a.submitted_at),
    ...progress.filter(p=>p.user_id===studentId&&chosenLessons.some(l=>l.id===p.lesson_id)).map(p=>p.completed_at)]
    .filter(Boolean).sort().at(-1)||null;
  return {
    assignmentPercent, quizPercent, provisionalGrade, representedWeight,
    assignmentGraded:graded.length, quizAttempted:matchingAttempts.length,
    assignmentSubmitted:matchingSubmissions.length, assignmentTotal:chosenTasks.length,
    quizTotal:chosenQuizzes.length,
    missingAssignments:chosenTasks.filter(t=>t.due_at&&Date.parse(t.due_at)<now&&!matchingSubmissions.some(s=>s.task_id===t.id)).length,
    missedQuizzes:chosenQuizzes.filter(q=>q.closes_at&&Date.parse(q.closes_at)<now&&!ownAttempts.some(a=>a.quiz_id===q.id)).length,
    pendingFeedback:matchingSubmissions.filter(s=>s.score==null).length,
    lessonCompleted:progress.filter(p=>p.user_id===studentId&&chosenLessons.some(l=>l.id===p.lesson_id)).length,
    lessonTotal:chosenLessons.length,
    lastActivity:latest
  };
}
/** Prevent spreadsheet apps from interpreting student-supplied text as formulas. */
export function downloadCSV(filename:string,rows:(string|number|null|undefined)[][]){
  const cell=(value:any)=>{
    let v=String(value??'');
    if(/^\s*[=+@\-\t\r]/.test(v))v="'"+v;
    return `"${v.replace(/"/g,'""')}"`;
  };
  const csv='\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
}
