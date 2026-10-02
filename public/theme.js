(function(){
 'use strict';
 const KEY='medlove-theme';
 const media=window.matchMedia('(prefers-color-scheme: dark)');
 const choices=['auto','light','dark'];
 let selected='auto';
 try{const saved=localStorage.getItem(KEY);if(choices.includes(saved))selected=saved}catch(err){}
 function apply(){
  const dark=selected==='dark'||(selected==='auto'&&media.matches);
  document.documentElement.setAttribute('data-theme',dark?'dark':'light');
  document.documentElement.style.colorScheme=dark?'dark':'light';
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>{
   const label=selected==='auto'?'Automatický':selected==='dark'?'Tmavý':'Svetlý';
   button.textContent=(selected==='dark'?'☾ ':selected==='light'?'☀ ':'◐ ')+label;
   button.setAttribute('aria-label','Režim vzhľadu: '+label+'. Kliknutím prepnúť.');
   button.title='Vzhľad: '+label+' (automatický / svetlý / tmavý)';
  });
 }
 function next(){selected=choices[(choices.indexOf(selected)+1)%choices.length];try{localStorage.setItem(KEY,selected)}catch(err){}apply()}
 document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('[data-theme-toggle]').forEach(button=>button.addEventListener('click',next));
  apply();
 });
 if(media.addEventListener)media.addEventListener('change',apply);
 else if(media.addListener)media.addListener(apply);
 apply();
})();
