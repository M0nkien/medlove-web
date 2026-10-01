'use strict';
// Resend transactional notifications: environment credentials live only on Render.
const clean=s=>String(s==null?'':s);
const escapeHtml=s=>clean(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const validEmail=s=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean(s).trim());
const eur=n=>Number(n).toLocaleString('sk-SK',{style:'currency',currency:'EUR'});
function createNotifier(db,env=process.env){
 const key=clean(env.RESEND_API_KEY).trim();
 const from=clean(env.EMAIL_FROM).trim();
 const owner=clean(env.ORDER_NOTIFICATION_EMAIL).trim();
 const enabled=Boolean(key&&from&&(validEmail(owner)||env.ENABLE_CUSTOMER_EMAILS==='true'));
 if(key&&!from)console.warn('RESEND_API_KEY je nastavený, ale EMAIL_FROM chýba.');
 if(owner&&!validEmail(owner))console.warn('ORDER_NOTIFICATION_EMAIL nemá platný formát.');
 async function claim(orderId,kind){
  const now=new Date().toISOString();
  const insert=await db.from('email_deliveries').insert({order_id:orderId,kind,status:'sending',locked_at:now}).select('order_id').maybeSingle();
  if(!insert.error&&insert.data)return true;
  if(insert.error&&insert.error.code!=='23505')throw insert.error;
  // Posielať smie iba jeden worker. Zaseknutý pokus sa odomkne po 10 min.
  const expired=new Date(Date.now()-10*60*1000).toISOString();
  const retry=await db.from('email_deliveries').update({locked_at:now})
   .eq('order_id',orderId).eq('kind',kind).eq('status','sending').lt('locked_at',expired)
   .select('order_id').maybeSingle();
  if(retry.error)throw retry.error;
  return !!retry.data;
 }
 async function post(to,subject,html,text,idempotencyKey){
  const result=await fetch('https://api.resend.com/emails',{
   method:'POST',
   headers:{
    'Authorization':'Bearer '+key,'Content-Type':'application/json',
    'Idempotency-Key':idempotencyKey
   },
   body:JSON.stringify({from,to:[to],subject,html,text})
  });
  const data=await result.json().catch(()=>({}));
  if(!result.ok||!data.id)throw Error('Resend HTTP '+result.status+' '+clean(data.message||data.name));
  return data.id;
 }
 async function notify(orderId){
  if(!enabled)return;
  const {data:order,error}=await db.from('orders')
   .select('id,order_code,customer_name,phone,email,delivery_type,delivery_address,note,payment_type,payment_status,total,status')
   .eq('id',orderId).maybeSingle();
  if(error)throw error;
  if(!order||order.status==='cancelled')return;
  if(order.payment_type==='card'&&order.payment_status!=='paid')return;
  if(order.payment_type!=='cash'&&order.payment_type!=='card')return;
  const lines=await db.from('order_items').select('product_name,quantity,unit_price,line_total').eq('order_id',orderId);
  if(lines.error)throw lines.error;
  const items=lines.data||[];
  const detailText=items.map(i=>i.product_name+' × '+i.quantity+' — '+eur(i.line_total)).join('\n');
  const detailHtml=items.map(i=>'<li>'+escapeHtml(i.product_name)+' × '+i.quantity+' — '+escapeHtml(eur(i.line_total))+'</li>').join('');
  const delivery=order.delivery_type==='local'?'Lokálny dovoz':'Osobný odber';
  const payment=order.payment_type==='card'?'Zaplatené kartou':'Hotovosť pri prevzatí';
  const destinations=[];
  if(validEmail(order.email)&&env.ENABLE_CUSTOMER_EMAILS!=='false')
   destinations.push({kind:'customer',to:order.email,subject:'Medlove: potvrdenie objednávky '+order.order_code,
    text:'Ďakujeme za objednávku '+order.order_code+'.\n'+detailText+'\nSpolu: '+eur(order.total)+'\nDoručenie: '+delivery+'\nPlatba: '+payment+'\nPri osobnom odbere alebo dovoze sa s tebou dohodneme telefonicky.\nMedlove – Včelia farma Slnečná',
    html:'<h2>Ďakujeme za objednávku '+escapeHtml(order.order_code)+'</h2><ul>'+detailHtml+'</ul><p><b>Spolu: '+escapeHtml(eur(order.total))+'</b></p><p>Doručenie: '+escapeHtml(delivery)+'<br>Platba: '+escapeHtml(payment)+'</p><p>Termín odberu alebo dovozu dohodneme telefonicky.</p><p>Medlove – Včelia farma Slnečná</p>'});
  if(validEmail(owner))destinations.push({kind:'owner',to:owner,subject:'Nová objednávka Medlove '+order.order_code,
   text:'Objednávka: '+order.order_code+'\nMeno: '+order.customer_name+'\nTelefón: '+order.phone+'\nE-mail: '+(order.email||'neuvedený')+'\n'+detailText+'\nSpolu: '+eur(order.total)+'\nDoručenie: '+delivery+'\nAdresa: '+(order.delivery_address||'osobný odber')+'\nPlatba: '+payment+'\nPoznámka: '+(order.note||'—'),
   html:'<h2>Nová objednávka '+escapeHtml(order.order_code)+'</h2><p>Meno: '+escapeHtml(order.customer_name)+'<br>Telefón: '+escapeHtml(order.phone)+'<br>E-mail: '+escapeHtml(order.email||'neuvedený')+'</p><ul>'+detailHtml+'</ul><p><b>Spolu: '+escapeHtml(eur(order.total))+'</b><br>Doručenie: '+escapeHtml(delivery)+'<br>Adresa: '+escapeHtml(order.delivery_address||'osobný odber')+'<br>Platba: '+escapeHtml(payment)+'</p><p>Poznámka: '+escapeHtml(order.note||'—')+'</p>'});
  for(const item of destinations){
   try{
    if(!await claim(order.id,item.kind))continue;
    const providerId=await post(item.to,item.subject,item.html,item.text,'medlove-'+order.id+'-'+item.kind);
    const update=await db.from('email_deliveries').update({status:'sent',sent_at:new Date().toISOString(),provider_id:providerId})
     .eq('order_id',order.id).eq('kind',item.kind).eq('status','sending');
    if(update.error)throw update.error;
    console.log('Objednávkový e-mail prijatý poskytovateľom:',order.order_code,item.kind);
   }catch(err){
    console.error('Nepodarilo sa odoslať e-mail:',order.order_code,item.kind,err.message);
    // Zaseknuté sending je po desiatich minútach znova spracovateľné.
   }
  }
 }
 async function sendPending(){
  if(!enabled)return;
  // Neodosielame notifikácie k historickým testovacím objednávkam pri prvom zapnutí.
  const fromDate=env.EMAIL_NOTIFICATIONS_FROM;
  if(!fromDate||!Number.isFinite(Date.parse(fromDate)))return;
  const {data,error}=await db.from('orders').select('id')
   .gte('created_at',new Date(fromDate).toISOString())
   .in('payment_type',['cash','card'])
   .neq('status','cancelled')
   .order('created_at',{ascending:false}).limit(50);
  if(error)throw error;
  for(const row of data||[])await notify(row.id);
 }
 return {enabled,notify,sendPending};
}
module.exports={createNotifier};
