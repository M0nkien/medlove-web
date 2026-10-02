'use strict';
const {rateLimit}=require('express-rate-limit');
const esc=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function createRestock(db,app,frontendUrl,env=process.env){
 const enabled=Boolean(env.RESEND_API_KEY&&env.EMAIL_FROM);
 const limit=rateLimit({windowMs:60*60*1000,max:5,standardHeaders:'draft-7',legacyHeaders:false,
  message:{error:'Príliš veľa pokusov. Skús to neskôr.'}});
 app.post('/api/restock/subscribe',limit,async(req,res)=>{
  if(!enabled)return res.status(503).json({error:'Upozornenia na naskladnenie zatiaľ nie sú aktivované.'});
  const body=req.body||{},productId=String(body.product_id||''),email=String(body.email||'').trim().toLowerCase();
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(productId)
   ||email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||body.consent!==true)
    return res.status(400).json({error:'Skontroluj e-mail a súhlas s jednorazovým upozornením.'});
  try{
   const product=await db.from('products').select('id,stock,active').eq('id',productId).maybeSingle();
   if(product.error)throw product.error;
   if(!product.data||!product.data.active)return res.status(404).json({error:'Produkt sa nenašiel.'});
   if(product.data.stock>0)return res.status(409).json({error:'Produkt je už skladom.'});
   const saved=await db.from('restock_subscriptions')
    .upsert({product_id:productId,email,notified_at:null},{onConflict:'product_id,email'});
   if(saved.error)throw saved.error;
   return res.status(202).json({ok:true,message:'Prihlásenie na jednorazové upozornenie bolo prijaté.'});
  }catch(error){console.error('Prihlásenie na naskladnenie:',error.message);
   return res.status(503).json({error:'Prihlásenie sa momentálne nepodarilo.'})}
 });
 let running=false;
 async function notify(){
  if(!enabled||running)return;
  running=true;
  try{
   // Store pending signups no longer than 180 days; successful notices for 30 days.
   const olderThan180=new Date(Date.now()-180*24*60*60*1000).toISOString();
   const olderThan30=new Date(Date.now()-30*24*60*60*1000).toISOString();
   const expired=await db.from('restock_subscriptions').delete().lt('created_at',olderThan180);
   if(expired.error)console.warn('Čistenie starých prihlásení:',expired.error.message);
   const delivered=await db.from('restock_subscriptions').delete().not('notified_at','is',null)
    .lt('notified_at',olderThan30);
   if(delivered.error)console.warn('Čistenie doručených prihlásení:',delivered.error.message);
   const available=await db.from('products').select('id,name').eq('active',true).gt('stock',0);
   if(available.error)throw available.error;
   for(const product of available.data||[]){
    const pending=await db.from('restock_subscriptions').select('id,email')
     .eq('product_id',product.id).is('notified_at',null).order('created_at').limit(40);
    if(pending.error)throw pending.error;
    for(const person of pending.data||[]){
     try{
      const link=frontendUrl+'/#produkty';
      const response=await fetch('https://api.resend.com/emails',{
       method:'POST',
       headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json',
        'Idempotency-Key':'restock-'+person.id},
       body:JSON.stringify({
        from:env.EMAIL_FROM,to:[person.email],subject:'Medlove: '+product.name+' je opäť skladom',
        text:'Produkt '+product.name+' je opäť dostupný. Ponuka: '+link+'\nToto je jednorazové upozornenie.',
        html:'<p>Produkt <b>'+esc(product.name)+'</b> je opäť dostupný.</p>'
         +'<p><a href="'+link+'">Pozrieť ponuku Medlove</a></p>'
         +'<p>Toto je jednorazové upozornenie.</p>'
       }),signal:AbortSignal.timeout(10000)
      });
      if(!response.ok)throw Error('Resend HTTP '+response.status);
      const result=await db.from('restock_subscriptions')
       .update({notified_at:new Date().toISOString()}).eq('id',person.id).is('notified_at',null);
      if(result.error)throw result.error;
     }catch(error){console.error('Upozornenie na naskladnenie:',person.id,error.message)}
    }
   }
  }catch(error){console.error('Kontrola skladu:',error.message)}finally{running=false}
 }
 setTimeout(notify,45000).unref();
 setInterval(notify,10*60*1000).unref();
 return {enabled};
}
module.exports={createRestock};
