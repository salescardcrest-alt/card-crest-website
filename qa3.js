const { JSDOM, VirtualConsole } = require('jsdom');
const fs=require('fs'),path=require('path');
const ROOT='/home/claude/cc';const errors=[];
const vc=new VirtualConsole(); vc.on('jsdomError',e=>errors.push('JSDOM: '+e.message)); vc.on('error',(...a)=>errors.push('err: '+a.join(' ')));
const dom=new JSDOM(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),{runScripts:'dangerously',url:'http://localhost/#/',virtualConsole:vc,pretendToBeVisual:true});
const {window}=dom, doc=window.document;
window.matchMedia=()=>({matches:false,addListener(){},removeListener(){},addEventListener(){},removeEventListener(){}});
window.scrollTo=()=>{};window.requestAnimationFrame=cb=>setTimeout(()=>cb(Date.now()),0);
window.IntersectionObserver=class{observe(){}unobserve(){}disconnect(){}};
Object.defineProperty(window.navigator,'clipboard',{value:{writeText:async()=>{}},configurable:true});
window.HTMLElement.prototype.focus=function(){};window.HTMLElement.prototype.scrollIntoView=function(){};
[...doc.querySelectorAll('script[src]')].map(s=>s.getAttribute('src')).forEach(src=>{try{window.eval(fs.readFileSync(path.join(ROOT,src),'utf8'))}catch(e){errors.push('LOAD '+src+': '+e.message)}});
const wait=ms=>new Promise(r=>setTimeout(r,ms||40));
(async()=>{
const CC=window.CC; CC.Auth.login('admin@cardcrest.in','admin1234'); CC.App.paintAuth();
const R=['/','/cards','/cards/hdfc-millennia','/compare','/eligibility','/calculator','/offers','/offers/off-001','/stores','/stores/amazon','/rewards','/refer','/dashboard','/dashboard/cards','/dashboard/applications','/dashboard/transactions','/profile','/help','/how-it-works','/legal/privacy','/legal/terms','/admin','/nope'];
const titles={};
for(const r of R){window.location.hash='#'+r;await wait(50);
  const t=doc.title; titles[t]=(titles[t]||0)+1;
  if(!/Card Crest/.test(t)) errors.push('title missing brand: '+r+' → '+t);
  const h1=doc.querySelectorAll('#view h1').length;
  if(h1===0) errors.push('no <h1> on '+r);
  if(h1>1) errors.push(h1+' <h1> on '+r);
  const desc=doc.querySelector('meta[name=description]').content;
  if(!desc||desc.length<30) errors.push('weak meta description on '+r);
  // buttons without accessible name
  [...doc.querySelectorAll('#view button')].forEach(b=>{
    if(!b.textContent.trim() && !b.getAttribute('aria-label')) errors.push('button without label on '+r);
  });
  // inputs without label
  [...doc.querySelectorAll('#view input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]), #view select, #view textarea')].forEach(i=>{
    const id=i.id; const lab=id?doc.querySelector(`#view label[for="${id}"]`):null;
    if(!lab && !i.getAttribute('aria-label') && !i.placeholder) errors.push('unlabelled field on '+r+' #'+id);
  });
}
const dupes=Object.entries(titles).filter(([,n])=>n>1);
if(dupes.length) errors.push('duplicate titles: '+dupes.map(d=>d[0]).join(' | '));
console.log('routes checked:',R.length,'| unique titles:',Object.keys(titles).length);
console.log('=== ISSUES ('+errors.length+') ===');
[...new Set(errors)].slice(0,25).forEach(e=>console.log(' • '+e));
if(!errors.length)console.log(' none');
process.exit(0);
})();
