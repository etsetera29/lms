'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {ChevronLeft, ChevronRight, Maximize2, Minimize2} from 'lucide-react';
import {db, prettyError} from '@/lib/supabase';

const SLIDE_WIDTH = 960;
const SLIDE_HEIGHT = 540;

/** One-slide-at-a-time PPTX player. Rendering stays entirely in the student's browser. */
export default function SlideDeck({filePath}: {filePath:string}) {
  const rendererRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<HTMLDivElement>(null);
  const slidesRef = useRef<HTMLElement[]>([]);
  const [slide,setSlide] = useState(0);
  const [total,setTotal] = useState(0);
  const [scale,setScale] = useState(1);
  const [loading,setLoading] = useState(true);
  const [error,setError] = useState('');
  const [fullscreen,setFullscreen] = useState(false);

  useEffect(()=>{
    let alive = true;
    slidesRef.current = [];
    setSlide(0);
    setTotal(0);
    setLoading(true);
    setError('');
    (async()=>{
      try {
        const {data:blob,error:downloadError} = await db().storage.from('lessons').download(filePath);
        if(downloadError)throw downloadError;
        if(!alive || !blob || !rendererRef.current)return;
        const {init} = await import('pptx-preview');
        if(!alive || !rendererRef.current)return;
        rendererRef.current.replaceChildren();
        const preview = init(rendererRef.current,{width:SLIDE_WIDTH,height:SLIDE_HEIGHT});
        await preview.preview(await blob.arrayBuffer());
        if(!alive || !rendererRef.current)return;
        // The renderer outputs every slide; hide all except the selected one.
        const rendered = Array.from(rendererRef.current.querySelectorAll<HTMLElement>('.pptx-preview-slide-wrapper'));
        if(!rendered.length)throw new Error('No slides were found in this presentation.');
        rendered.forEach((element,index)=>{
          element.style.display = index === 0 ? 'block' : 'none';
          element.style.margin = '0';
        });
        slidesRef.current=rendered;
        setTotal(rendered.length);
        setSlide(0);
        setLoading(false);
      } catch(e) {
        if(alive){setLoading(false);setError('Preview unavailable. Open the original file instead. '+prettyError(e));}
      }
    })();
    return ()=>{alive=false;slidesRef.current=[]};
  },[filePath]);

  useEffect(()=>{
    const stage=stageRef.current;
    if(!stage)return;
    const resize=()=>{
      const ratio=Math.min(stage.clientWidth/SLIDE_WIDTH,stage.clientHeight/SLIDE_HEIGHT);
      setScale(Number.isFinite(ratio)&&ratio>0?ratio:1);
    };
    resize();
    const observer=new ResizeObserver(resize);
    observer.observe(stage);
    return ()=>observer.disconnect();
  },[]);

  const goTo=useCallback((requested:number)=>{
    const slides=slidesRef.current;
    if(!slides.length)return;
    const next=Math.max(0,Math.min(slides.length-1,requested));
    slides.forEach((element,index)=>{element.style.display=index===next?'block':'none'});
    setSlide(next);
  },[]);

  useEffect(()=>{
    const handleKey=(event:KeyboardEvent)=>{
      if(!slidesRef.current.length||event.altKey||event.ctrlKey||event.metaKey)return;
      const element=event.target as HTMLElement|null;
      if(element?.isContentEditable||['INPUT','TEXTAREA','SELECT'].includes(element?.tagName||''))return;
      if(['ArrowRight','PageDown'].includes(event.key)){event.preventDefault();goTo(slide+1);}
      else if(['ArrowLeft','PageUp'].includes(event.key)){event.preventDefault();goTo(slide-1);}
      else if(event.key==='Home'){event.preventDefault();goTo(0);}
      else if(event.key==='End'){event.preventDefault();goTo(slidesRef.current.length-1);}
    };
    window.addEventListener('keydown',handleKey);
    return ()=>window.removeEventListener('keydown',handleKey);
  },[goTo,slide]);

  useEffect(()=>{
    const handleFullscreen=()=>setFullscreen(document.fullscreenElement===playerRef.current);
    document.addEventListener('fullscreenchange',handleFullscreen);
    return ()=>document.removeEventListener('fullscreenchange',handleFullscreen);
  },[]);

  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement===playerRef.current){await document.exitFullscreen();}
      else if(playerRef.current?.requestFullscreen){await playerRef.current.requestFullscreen();}
    }catch{ /* If a browser blocks fullscreen, the inline presentation remains usable. */ }
  }

  return <div ref={playerRef} className="presentation-player" aria-label="PowerPoint presentation player">
    {loading&&<div className="preview-status" role="status">Rendering slides…</div>}
    {error&&<div className="preview-status" role="alert">{error}</div>}
    <div className="presentation-stage" ref={stageRef} aria-label={total?'Slide '+(slide+1)+' of '+total:'Presentation loading'}>
      <div className="pptx-render" ref={rendererRef} style={{transform:'translate(-50%, -50%) scale('+scale+')'}}/>
    </div>
    <div className="presentation-controls">
      <div className="presentation-arrows">
        <button className="presentation-control" type="button" onClick={()=>goTo(slide-1)} disabled={!total||slide===0} aria-label="Previous slide" title="Previous slide (←)"><ChevronLeft size={21}/></button>
        <span className="presentation-counter" aria-live="polite">{total?'Slide '+(slide+1)+' of '+total:'Loading slides'}</span>
        <button className="presentation-control" type="button" onClick={()=>goTo(slide+1)} disabled={!total||slide===total-1} aria-label="Next slide" title="Next slide (→)"><ChevronRight size={21}/></button>
      </div>
      <span className="presentation-keyboard-hint">Use ← and → to navigate</span>
      <button className="presentation-control presentation-fullscreen" type="button" onClick={toggleFullscreen} aria-label={fullscreen?'Exit fullscreen':'View fullscreen'} title={fullscreen?'Exit fullscreen':'Fullscreen'}>{fullscreen?<Minimize2 size={19}/>:<Maximize2 size={19}/>}</button>
    </div>
  </div>;
}
