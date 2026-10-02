'use strict';
(function(){
 const $=id=>document.getElementById(id);
 const token=new URLSearchParams(location.search).get('token');
 const statuses={new:'Nová',processing:'Spracováva sa',ready:'Pripravená',done:'Vybavená',cancelled:'Zrušená'};
 const payments={pending:'Čaká na platbu',paid:'Platba potvrdená',unpaid:'Hotovosť pri prevzatí',
  failed:'Platba zlyhala',refunded:'Platba vrátená'};
 const date=value=>new Date(value).toLocaleString('sk-SK',{dateStyle:'medium',timeStyle:'short'});
 async function refresh(){
  if(!token||!/^[a-f0-9]{64}$/.test(token)){$('trackingMessage').textContent='Odkaz je neplatný.';return}
  $('trackingRefresh').disabled=true;
  try{
   const api=window.MEDLOVE_CONFIG.apiBaseUrl.replace(/\/$/,'');
   const response=await fetch(api+'/api/track/'+encodeURIComponent(token),{cache:'no-store'});
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Objednávka sa nenašla.');
   $('trackingCode').textContent=data.order_code;
   $('trackingStatus').textContent='Stav: '+(statuses[data.status]||data.status);
   $('trackingPayment').textContent='Platba: '+(payments[data.payment_status]||data.payment_status);
   $('trackingTimeline').replaceChildren();
   for(const event of data.events||[]){
    const li=document.createElement('li'),title=document.createElement('strong'),at=document.createElement('small');
    title.textContent=event.event_type==='created'?'Objednávka vytvorená':
     event.event_type==='payment'?(payments[event.new_value]||'Zmena platby'):
     (statuses[event.new_value]||'Zmena stavu');
    at.textContent=date(event.created_at);li.append(title,at);$('trackingTimeline').append(li);
   }
   $('trackingDetails').classList.remove('hidden');$('trackingMessage').textContent='Stav bol aktualizovaný.';
  }catch(error){$('trackingMessage').textContent=error.message||'Stav nie je dostupný.'}
  finally{$('trackingRefresh').disabled=false}
 }
 $('trackingRefresh').addEventListener('click',refresh);void refresh();
})();