'use strict';
// Kanban uses the same guarded changeStatus() and cancellation RPC as the order table.
function renderKanban(){
 const board=document.getElementById('ordersKanbanBoard');if(!board)return;
 board.replaceChildren();
 const keys=['new','processing','ready','done'];
 const names={new:'Nové',processing:'Spracovávajú sa',ready:'Pripravené',done:'Vybavené'};
 keys.forEach(key=>{
  const column=document.createElement('section');column.className='kanban-column';column.dataset.status=key;
  const title=document.createElement('div');title.className='kanban-header';
  const label=document.createElement('strong');label.textContent=names[key];
  const badge=document.createElement('span');
  const group=orders.filter(o=>o.status===key);
  badge.textContent=String(group.length);title.append(label,badge);
  const cards=document.createElement('div');cards.className='kanban-cards';
  if(!group.length){const empty=document.createElement('p');empty.className='kanban-empty';empty.textContent='Žiadne objednávky';cards.append(empty)}
  group.forEach(order=>{
   const locked=order.payment_type==='card'&&order.payment_status!=='paid';
   const card=document.createElement('article');card.className='kanban-card';card.draggable=!locked;
   card.setAttribute('aria-disabled',String(locked));
   const code=document.createElement('strong');code.textContent=order.order_code;
   const customer=document.createElement('small');customer.textContent=order.customer_name;
   const moneyLine=document.createElement('small');moneyLine.textContent=money(order.total)+' · '+paymentBadge(order);
   const actions=document.createElement('div');actions.className='kanban-actions';
   const select=document.createElement('select');select.disabled=locked;
   select.setAttribute('aria-label','Stav objednávky '+order.order_code);
   for(const state of keys){
    const option=document.createElement('option');option.value=state;option.textContent=names[state];
    option.selected=order.status===state;select.append(option);
   }
   select.addEventListener('change',()=>void changeStatus(order.id,select.value));
   const detail=document.createElement('button');detail.type='button';detail.textContent='Detail';
   detail.addEventListener('click',()=>openOrder(order.id));
   actions.append(select,detail);card.append(code,customer,moneyLine,actions);cards.append(card);
   if(!locked)card.addEventListener('dragstart',event=>{
    event.dataTransfer.setData('text/plain',order.id);event.dataTransfer.effectAllowed='move';
   });
  });
  column.addEventListener('dragover',event=>{
   event.preventDefault();column.classList.add('kanban-over');event.dataTransfer.dropEffect='move';
  });
  column.addEventListener('dragleave',()=>column.classList.remove('kanban-over'));
  column.addEventListener('drop',event=>{
   event.preventDefault();column.classList.remove('kanban-over');
   const id=event.dataTransfer.getData('text/plain');
   const order=orders.find(o=>o.id===id);
   if(!order||order.status===key)return;
   if(order.payment_type==='card'&&order.payment_status!=='paid'){
    toast('Najprv musí byť potvrdená platba.');return;
   }
   void changeStatus(id,key);
  });
  column.append(title,cards);board.append(column);
 });
}
async function showOrderHistory(id){
 let panel=document.getElementById('orderHistoryPanel');
 if(!panel){
  panel=document.createElement('section');panel.id='orderHistoryPanel';panel.className='order-history';
  document.getElementById('orderDetailContent').append(panel);
 }
 const heading=document.createElement('h3');heading.textContent='História objednávky';
 const status=document.createElement('p');status.textContent='Načítavame históriu…';
 panel.append(heading,status);
 try{
  const results=await Promise.all([
   sb.from('order_events').select('event_type,old_value,new_value,actor_id,actor_type,created_at')
    .eq('order_id',id).order('created_at',{ascending:true}).limit(100),
   sb.auth.getUser()
  ]);
  if(results[0].error)throw results[0].error;
  if(document.getElementById('orderDetailTitle').textContent!==
   orders.find(o=>o.id===id)?.order_code)return;
  status.remove();
  const list=document.createElement('ol');list.className='order-history-list';
  const current=results[1].data?.user?.id;
  for(const event of results[0].data||[]){
   const item=document.createElement('li'),label=document.createElement('strong');
   if(event.event_type==='created')label.textContent='Objednávka evidovaná';
   else if(event.event_type==='payment')label.textContent='Platba: '+(paymentNames[event.new_value]||event.new_value);
   else label.textContent='Stav: '+(statusNames[event.new_value]||event.new_value);
   const who=document.createElement('small');
   const actor=event.actor_type==='admin'?
    (event.actor_id===current?'Ty (administrátor)':'Administrátor '+String(event.actor_id||'').slice(0,8)):
    (event.event_type==='payment'?'Server / Stripe':'Systém');
   who.textContent=new Date(event.created_at).toLocaleString('sk-SK')+' · '+actor;
   item.append(label,who);list.append(item);
  }
  if(!list.children.length)status.textContent='Pri tejto objednávke zatiaľ nie je história.';
  else panel.append(list);
 }catch(error){status.textContent='Históriu nie je možné načítať.';console.warn(error.message)}
}
function renderExistingProductPhotos(p){
 const target=document.getElementById('productExistingPhotos');target.replaceChildren();
 (p.product_photos||[]).sort((a,b)=>a.sort_order-b.sort_order).forEach(item=>{
  const figure=document.createElement('figure'),img=document.createElement('img');
  img.src=item.image_url;img.alt=p.name;img.loading='lazy';
  const remove=document.createElement('button');remove.type='button';remove.textContent='Odstrániť fotografiu';
  remove.addEventListener('click',async()=>{
   if(!confirm('Odstrániť túto doplnkovú fotografiu?'))return;
   remove.disabled=true;
   try{
    const deletion=await sb.from('product_photos').delete().eq('id',item.id);
    if(deletion.error)throw deletion.error;
    if(item.storage_path?.startsWith('products/')){
     const storage=await sb.storage.from('product-images').remove([item.storage_path]);
     if(storage.error)console.warn('Súbor zostal v Storage:',storage.error.message);
    }
    figure.remove();p.product_photos=p.product_photos.filter(x=>x.id!==item.id);
    toast('Fotografia odstránená.');
   }catch(error){toast(error.message)}finally{remove.disabled=false}
  });
  figure.append(img,remove);target.append(figure);
 });
}
async function uploadProductExtras(productId){
 const files=[...document.getElementById('productGalleryPhotos').files];
 if(!files.length)return;
 if(files.length>6)throw Error('Naraz možno pridať najviac 6 fotografií.');
 for(const file of files){
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>5*1024*1024)
   throw Error('Povolené sú JPG, PNG a WebP do 5 MB.');
 }
 const bucket=sb.storage.from('product-images');
 for(const [index,file] of files.entries()){
  const extension={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
  const path='products/'+crypto.randomUUID()+'.'+extension;
  const uploaded=await bucket.upload(path,file,{contentType:file.type,upsert:false});
  if(uploaded.error)throw uploaded.error;
  const inserted=await sb.from('product_photos').insert({
   product_id:productId,image_url:bucket.getPublicUrl(path).data.publicUrl,
   storage_path:path,sort_order:index
  });
  if(inserted.error){await bucket.remove([path]);throw inserted.error}
 }
}
if(adminReady)renderKanban();
