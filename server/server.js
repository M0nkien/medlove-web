'use strict';
require('dotenv').config();
const express=require('express');
const rateLimit=require('express-rate-limit');
const Stripe=require('stripe');
const {createClient}=require('@supabase/supabase-js');
const {createNotifier}=require('./email');

const app=express();app.disable('x-powered-by');app.set('trust proxy',1);
const frontendUrl=(process.env.FRONTEND_URL||'http://localhost:5500').replace(/\/$/,'');
const port=Number(process.env.PORT||10000);
const supabaseUrl=process.env.SUPABASE_URL;
const supabaseKey=process.env.SUPABASE_SECRET_KEY;
if(!supabaseUrl||!supabaseKey){console.error('Chýba SUPABASE_URL alebo SUPABASE_SECRET_KEY');process.exit(1)}
const db=createClient(supabaseUrl,supabaseKey,{auth:{autoRefreshToken:false,persistSession:false}});
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;
const mailer=createNotifier(db);

app.use((req,res,next)=>{
 res.setHeader('Access-Control-Allow-Origin',frontendUrl);
 res.setHeader('Vary','Origin');
 res.setHeader('Access-Control-Allow-Headers','Content-Type');
 res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(req.method==='OPTIONS')return res.sendStatus(204);
 if(req.method==='POST'&&req.path!=='/api/stripe/webhook'&&req.headers.origin!==frontendUrl)
   return res.status(403).json({error:'Nepovolený pôvod požiadavky.'});
 next();
});

// Stripe podpis počíta nad nezmeneným raw body. Táto route MUSÍ byť pred express.json().
app.post('/api/stripe/webhook',express.raw({type:'application/json',limit:'256kb'}),async(req,res)=>{
 if(!stripe||!process.env.STRIPE_WEBHOOK_SECRET)return res.sendStatus(503);
 let event;
 try{event=stripe.webhooks.constructEvent(req.body,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET)}
 catch(err){console.warn('Neplatný podpis Stripe webhooku:',err.message);return res.status(400).send('Invalid webhook signature')}
 const session=event.data.object;
 try{
  if(event.type==='checkout.session.completed'&&session.payment_status==='paid'){
   const {data:order,error}=await db.from('orders').select('id,total,payment_status,order_code')
    .eq('stripe_checkout_session_id',session.id).maybeSingle();
   if(error||!order)throw Error('Objednávka k session sa nenašla.');
   const cents=Math.round(Number(order.total)*100);
   if(session.currency!=='eur'||session.amount_total!==cents||session.metadata?.order_id!==order.id)
     throw Error('Nesúhlasí platba, mena alebo identifikátor objednávky.');
   const r=await db.rpc('mark_medlove_order_paid',{
    p_order_id:order.id,p_session_id:session.id,
    p_payment_intent:typeof session.payment_intent==='string'?session.payment_intent:null
   });
   if(r.error)throw r.error;
   if(r.data!==true){
    const check=await db.from('orders').select('payment_status').eq('id',order.id).single();
    if(check.error||check.data?.payment_status!=='paid')
     throw Error('Databáza nepotvrdila platbu '+order.order_code);
   }
   console.log('Potvrdený Stripe checkout:',order.order_code);
   await mailer.notify(order.id);
  }
  if(event.type==='checkout.session.expired'){
   const {data:order,error}=await db.from('orders').select('id').eq('stripe_checkout_session_id',session.id).maybeSingle();
   if(error)throw error;
   if(order){const r=await db.rpc('release_medlove_pending_order',{p_order_id:order.id,p_session_id:session.id});if(r.error)throw r.error;}
  }
  return res.json({received:true});
 }catch(err){console.error('Stripe webhook nedokončený:',err.message);return res.sendStatus(500)}
});

app.use(express.json({limit:'25kb'}));

// Overenie platby sa vykonáva výhradne na serveri podľa Stripe Checkout Session.
async function verifyAndSyncCheckout(order) {
 if(order.payment_status==='paid') {await mailer.notify(order.id);return 'paid';}
 if(order.payment_status!=='pending') return order.payment_status;
 if(!stripe||!order.stripe_checkout_session_id) return 'pending';
 const session=await stripe.checkout.sessions.retrieve(order.stripe_checkout_session_id);
 if(session.id!==order.stripe_checkout_session_id||session.metadata?.order_id!==order.id
  ||session.currency!=='eur'||session.amount_total!==Math.round(Number(order.total)*100))
   throw Error('Nesúlad údajov Stripe a objednávky '+order.order_code);
 if(session.status==='complete'&&session.payment_status==='paid'){
  const r=await db.rpc('mark_medlove_order_paid',{
   p_order_id:order.id,p_session_id:session.id,
   p_payment_intent:typeof session.payment_intent==='string'?session.payment_intent:null
  });
  if(r.error)throw r.error;
  if(r.data!==true){
   const check=await db.from('orders').select('payment_status').eq('id',order.id).single();
   if(check.error||check.data?.payment_status!=='paid')
    throw Error('Databáza nepotvrdila platbu '+order.order_code);
  }
  console.log('Stripe platba potvrdená v databáze:',order.order_code);
  await mailer.notify(order.id);
  return 'paid';
 }
 if(session.status==='expired'){
  const r=await db.rpc('release_medlove_pending_order',{p_order_id:order.id,p_session_id:session.id});
  if(r.error)throw r.error;
  return 'failed';
 }
 return 'pending';
}

const paymentStatusLimit=rateLimit({
 windowMs:10*60*1000,max:25,standardHeaders:'draft-7',legacyHeaders:false
});
app.get('/api/orders/:code/payment-status',paymentStatusLimit,async(req,res)=>{
 const code=String(req.params.code||'');
 if(!/^MED-[A-F0-9]{12}$/.test(code))return res.status(400).json({error:'Neplatný kód objednávky.'});
 try{
  const {data:order,error}=await db.from('orders')
   .select('id,order_code,total,payment_type,payment_status,stripe_checkout_session_id')
   .eq('order_code',code).maybeSingle();
  if(error)throw error;
  if(!order)return res.status(404).json({error:'Objednávka sa nenašla.'});
  if(order.payment_type!=='card')return res.json({payment_status:order.payment_status});
  const status=await verifyAndSyncCheckout(order);
  return res.json({payment_status:status});
 }catch(err){
  console.error('Nepodarilo sa overiť platbu:',code,err.message);
  return res.status(503).json({error:'Overenie platby sa momentálne nepodarilo. Skús to neskôr.'});
 }
});

app.get('/api/health',(_req,res)=>res.json({service:'medlove-api',version:'6.2.0',ok:true,stripeConfigured:Boolean(stripe&&process.env.STRIPE_WEBHOOK_SECRET),emailConfigured:mailer.enabled}));

const orderLimit=rateLimit({windowMs:30*60*1000,max:12,standardHeaders:'draft-7',legacyHeaders:false,message:{error:'Príliš veľa pokusov. Skús to o chvíľu.'}});
app.post('/api/orders',orderLimit,async(req,res)=>{
 let created=null,session=null;
 try{
  const b=req.body||{};
  if(!Array.isArray(b.items)||!b.items.length||b.items.length>30)
   return res.status(400).json({error:'Neplatný košík.'});
  const items=b.items.map(i=>({product_id:String(i.product_id||''),qty:Number(i.qty)}));
  if(items.some(i=>!/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(i.product_id)||!Number.isInteger(i.qty)||i.qty<1||i.qty>20))
   return res.status(400).json({error:'Neplatné množstvo alebo produkt.'});
  const name=String(b.customer_name||'').trim(),phone=String(b.phone||'').trim(),email=String(b.email||'').trim(),address=String(b.delivery_address||'').trim(),note=String(b.note||'').trim();
  const delivery=b.delivery_type,payment=b.payment_type;
  if(name.length<2||name.length>120||phone.length<6||phone.length>30||email.length>254||address.length>400||note.length>1000)
   return res.status(400).json({error:'Skontroluj kontaktné údaje.'});
  if(payment!=='cash'&&payment!=='card')return res.status(400).json({error:'Neplatný spôsob platby.'});
  if(delivery!=='pickup'&&delivery!=='local')return res.status(400).json({error:'Neplatná doprava.'});
  if(delivery==='local'&&!address)return res.status(400).json({error:'Pri dovoze zadaj adresu.'});
  if(payment==='card'&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return res.status(400).json({error:'Pri platbe kartou je potrebný platný e-mail.'});
  if(payment==='card'&&(!stripe||!process.env.STRIPE_WEBHOOK_SECRET))
   return res.status(503).json({error:'Online platby ešte nie sú zapnuté. Vyber hotovosť pri prevzatí.'});

  // Cenu, aktívne produkty, zásoby a minimum pre dovoz kontroluje SQL transakcia.
  const result=await db.rpc('create_medlove_order',{
   p_customer_name:name,p_phone:phone,p_email:email||null,p_delivery_type:delivery,
   p_payment_type:payment,p_delivery_address:address||null,p_note:note||null,p_items:items
  });
  if(result.error)throw result.error;
  created=result.data?.[0];if(!created)throw Error('Databáza nevrátila objednávku.');
  if(payment==='cash'){
   await mailer.notify(created.order_id);
   return res.status(201).json({order_code:created.order_code,total:created.total});
  }

  const lines=await db.from('order_items').select('product_name,unit_price,quantity').eq('order_id',created.order_id);
  if(lines.error||!lines.data?.length)throw lines.error||Error('Chýbajú položky objednávky.');
  session=await stripe.checkout.sessions.create({
   mode:'payment',payment_method_types:['card'],locale:'sk',customer_email:email,
   client_reference_id:created.order_id,metadata:{order_id:created.order_id},
   line_items:lines.data.map(i=>({price_data:{currency:'eur',unit_amount:Math.round(Number(i.unit_price)*100),product_data:{name:i.product_name}},quantity:i.quantity})),
   expires_at:Math.floor(Date.now()/1000)+31*60,
   success_url:frontendUrl+'/success.html?order='+encodeURIComponent(created.order_code),
   cancel_url:frontendUrl+'/cancel.html'
  },{idempotencyKey:'medlove-'+created.order_id});
  const update=await db.from('orders').update({stripe_checkout_session_id:session.id,updated_at:new Date().toISOString()})
   .eq('id',created.order_id).eq('payment_status','pending').select('id').single();
  if(update.error)throw update.error;
  return res.status(201).json({order_code:created.order_code,checkout_url:session.url});
 }catch(err){
  console.error('Chyba objednávky:',err.message);
  if(created?.order_id){
   // Stripe reláciu nezverejňujeme, ak sa nedokončila evidencia objednávky.
   if(session){try{await stripe.checkout.sessions.expire(session.id)}catch(ex){console.warn('Nepodarilo sa expirovať checkout:',ex.message)}}
   const release=await db.rpc('release_medlove_pending_order',{p_order_id:created.order_id,p_session_id:session?.id||null});
   if(!release.data)await db.rpc('release_medlove_pending_order',{p_order_id:created.order_id,p_session_id:null});
  }
  const known=/Neplatn|Nedostatočn|nie je dostupný|povinn|dovoz|množstvo|sklad|kontaktn/.test(err.message||'');
  return res.status(known?400:500).json({error:known?err.message:'Objednávku sa nepodarilo dokončiť. Skús to znova.'});
 }
});

// Dodatočná rekonciliácia v prípade zmeškaného webhooku alebo prerušeného checkoutu.
// Na Render produkcii použi always-on Web Service, nie spiacu testovaciu službu.
let reconciliationRunning=false;
async function reconcilePayments(){
 if(reconciliationRunning||!stripe)return;
 reconciliationRunning=true;
 try{
  const cutoff=new Date(Date.now()-35*60*1000).toISOString();
  const {data:pending,error}=await db.from('orders')
   .select('id,total,stripe_checkout_session_id').eq('payment_type','card')
   .eq('payment_status','pending').lt('created_at',cutoff).limit(50);
  if(error)throw error;
  for(const order of pending||[]){
   try{
    const sid=order.stripe_checkout_session_id;
    if(!sid){await db.rpc('release_medlove_pending_order',{p_order_id:order.id,p_session_id:null});continue}
    let session=await stripe.checkout.sessions.retrieve(sid);
    if(session.status==='complete'&&session.payment_status==='paid'
       &&session.metadata?.order_id===order.id&&session.currency==='eur'
       &&session.amount_total===Math.round(Number(order.total)*100)){
      const r=await db.rpc('mark_medlove_order_paid',{
       p_order_id:order.id,p_session_id:sid,
       p_payment_intent:typeof session.payment_intent==='string'?session.payment_intent:null
      });if(r.error)throw r.error;
      if(r.data!==true){
       const check=await db.from('orders').select('payment_status').eq('id',order.id).single();
       if(check.error||check.data?.payment_status!=='paid')
        throw Error('Rekonciliácia nepotvrdila platbu '+order.id);
      }
      await mailer.notify(order.id);
    }else if(session.status==='expired'){
      const r=await db.rpc('release_medlove_pending_order',{p_order_id:order.id,p_session_id:sid});if(r.error)throw r.error;
    }else if(session.status==='open'){
      session=await stripe.checkout.sessions.expire(sid);
      if(session.status==='expired'){
       const r=await db.rpc('release_medlove_pending_order',{p_order_id:order.id,p_session_id:sid});if(r.error)throw r.error;
      }
    }else console.warn('Platba vyžaduje manuálnu kontrolu:',order.id,session.status,session.payment_status);
   }catch(err){console.error('Nepodarilo sa zosúladiť platbu:',order.id,err.message)}
  }
 }catch(err){console.error('Rekonciliácia zlyhala:',err.message)}
 finally{reconciliationRunning=false}
}
setTimeout(reconcilePayments,20*1000).unref();
setInterval(reconcilePayments,10*60*1000).unref();
// Po výpadku poskytovateľa znovu spracujeme neodoslané potvrdenia.
setTimeout(()=>mailer.sendPending().catch(e=>console.error('E-mailová fronta:',e.message)),30*1000).unref();
setInterval(()=>mailer.sendPending().catch(e=>console.error('E-mailová fronta:',e.message)),10*60*1000).unref();

app.listen(port,'0.0.0.0',()=>console.log('Medlove API na porte '+port));
