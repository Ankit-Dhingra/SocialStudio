import React from 'react';
import {AbsoluteFill,Audio,Sequence,interpolate,useCurrentFrame,staticFile} from 'remotion';
import type {Short} from '../src/core.js';
const accent='#34d399';
function RequestVisual({frame}:{frame:number}){
 const dots=Array.from({length:15},(_,i)=>i);
 return <div style={{position:'relative',height:390,border:'2px solid #334155',borderRadius:30,background:'#101d33',marginTop:70,overflow:'hidden'}}>
 <div style={{position:'absolute',top:20,left:24,fontSize:28,color:'#94a3b8'}}>CLIENT REQUESTS</div>
 {dots.map(i=>{const x=80+((frame*5+i*70)%750);const y=85+(i%5)*49;return <div key={i} style={{position:'absolute',left:x,top:y,width:23,height:23,borderRadius:'50%',background:i%3===0?'#38bdf8':accent,boxShadow:'0 0 14px #34d39955'}}/>})}
 <div style={{position:'absolute',right:35,bottom:27,padding:'15px 20px',borderRadius:16,background:'#2563eb',fontSize:26,fontWeight:800}}>NODE SERVER</div></div>;
}
function CodeVisual({code}:{code:string}){return <div style={{marginTop:80,background:'#0b1221',border:'2px solid #334155',borderRadius:26,padding:35,fontSize:32,fontFamily:'monospace',whiteSpace:'pre-wrap',lineHeight:1.7,color:'#93c5fd',overflowWrap:'anywhere'}}>{code.replaceAll('\\n', '\n')}</div>}
function Slide({scene,index}:{scene:Short['scenes'][number],index:number}){
 const frame=useCurrentFrame();const inOpacity=interpolate(frame,[0,10],[0,1],{extrapolateRight:'clamp'});
 const translate=interpolate(frame,[0,15],[80,0],{extrapolateRight:'clamp'});
 return <AbsoluteFill style={{padding:'200px 70px 180px',color:'#f8fafc',opacity:inOpacity,transform:`translateY(${translate}px)`}}>
  <div style={{fontSize:28,letterSpacing:7,color:accent,fontWeight:800}}>TECH EXPLAINED / {String(index+1).padStart(2,'0')}</div>
  <h1 style={{fontSize:scene.type==='hook'?96:78,lineHeight:1.12,margin:'70px 0 30px',fontWeight:900}}>{scene.headline}</h1>
  {scene.type==='code'?<CodeVisual code={scene.code}/>:scene.type==='diagram'?<RequestVisual frame={frame}/>:<div style={{marginTop:110,padding:55,background:'#14243c',borderLeft:`10px solid ${accent}`,borderRadius:16,fontSize:54,lineHeight:1.35,fontWeight:650}}>{scene.label}</div>}
  <div style={{position:'absolute',bottom:240,left:70,right:70,fontSize:40,fontWeight:650,color:'#e2e8f0',lineHeight:1.3}}>{scene.narration}</div>
 </AbsoluteFill>
}
export const TechShort=({short,audioSrc,durations}:{short:Short,audioSrc:string,durations:number[]})=>{
 let cursor=0;
 return <AbsoluteFill style={{background:'radial-gradient(circle at 50% 10%, #20345c, #07101e 70%)',fontFamily:'Arial,sans-serif'}}>
  {short.scenes.map((scene: Short['scenes'][number], i: number)=>{const from=cursor;cursor+=durations[i];return <Sequence from={from} durationInFrames={durations[i]} key={i}><Slide scene={scene} index={i}/></Sequence>})}
  <div style={{position:'absolute',bottom:76,left:70,right:70,height:8,background:'#334155',borderRadius:8}}><div style={{height:8,width:'100%',background:accent,opacity:.5}}/></div>
  <Audio src={staticFile(audioSrc)}/>
 </AbsoluteFill>;
};
