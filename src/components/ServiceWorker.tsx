'use client';
import {useEffect} from 'react';
export default function ServiceWorker(){
 useEffect(()=>{
  if(!('serviceWorker' in navigator) || location.protocol!=='https:')return;
  navigator.serviceWorker.register('/sw.js',{scope:'/'}).catch(()=>{/* web app is still functional without PWA */});
 },[]);
 return null;
}
