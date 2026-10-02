// Medlove V5 admin: Supabase Auth + RLS + Supabase Storage.
const c=window.MEDLOVE_CONFIG;
// The admin session is private to this browser session, not persistent localStorage.
try{
 const projectRef=new URL(c.supabaseUrl).hostname.split('.')[0];
 localStorage.removeItem('sb-'+projectRef+'-auth-token');
}catch(err){console.warn('Starú reláciu sa nepodarilo vyčistiť.')}
const sb=window.supabase.createClient(c.supabaseUrl,c.supabasePublishableKey,{
 auth:{
  storage:window.sessionStorage,
  storageKey:'medlove-admin-session',
  persistSession:true,
  autoRefreshToken:true,
  detectSessionInUrl:false
 }
});
const $=id=>document.getElementById(id);
const money=x=>Number(x).toLocaleString('sk-SK',{style:'currency',currency:'EUR'});
const esc=x=>String(x??'').replace(/[&<>"']/g,z=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[z]));
const statusNames={new:'Nová',processing:'Spracováva sa',ready:'Pripravená',done:'Vybavená',cancelled:'Zrušená'};
const paymentNames={pending:'Čaká na platbu',paid:'Zaplatené',unpaid:'Pri prevzatí',failed:'Platba zlyhala',refunded:'Vrátené'};
let products=[],orders=[],settings={},adminReady=false;
let lastAdminActivity=Date.now();
const ADMIN_IDLE_LIMIT_MS=30*60*1000;
async function lockInactiveAdmin(){
 if(!adminReady||Date.now()-lastAdminActivity<ADMIN_IDLE_LIMIT_MS)return;
 adminReady=false;
 await sb.auth.signOut();
 location.reload();
}
['pointerdown','keydown','touchstart'].forEach(type=>document.addEventListener(type,()=>{
 if(adminReady&&Date.now()-lastAdminActivity<ADMIN_IDLE_LIMIT_MS)lastAdminActivity=Date.now();
},{passive:true}));
document.addEventListener('visibilitychange',()=>{if(!document.hidden)void lockInactiveAdmin()});
setInterval(()=>void lockInactiveAdmin(),60000);
function toast(m){const t=$('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2800)}
function statusPill(x){return `<span class="status-pill status-${x}">${statusNames[x]||esc(x)}</span>`}
function paymentBadge(o){return o.payment_type==='card'?paymentNames[o.payment_status]||o.payment_status:'Hotovosť pri prevzatí'}
async function showApp(){lastAdminActivity=Date.now();adminReady=true;$('loginScreen').classList.add('hidden');$('adminApp').classList.remove('hidden');await renderAll()}
async function checkAdmin(){const r=await sb.rpc('is_admin');if(r.error)throw r.error;return r.data===true}
$('loginForm').onsubmit=async e=>{e.preventDefault();const submit=e.target.querySelector('button[type=submit]');submit.disabled=true;try{const {error}=await sb.auth.signInWithPassword({email:$('adminEmail').value.trim(),password:$('adminPassword').value});if(error)throw error;if(!await checkAdmin()){await sb.auth.signOut();throw Error('Používateľ nemá admin oprávnenia.')}await showApp()}catch(err){console.error(err);toast(err.message||'Prihlásenie zlyhalo.')}finally{submit.disabled=false}};
$('logoutBtn').onclick=async()=>{await sb.auth.signOut();location.reload()};
async function restoreSession(){const {data,error}=await sb.auth.getSession();if(!error&&data.session){try{if(await checkAdmin())await showApp();else await sb.auth.signOut()}catch(err){console.warn(err)}}}
function switchPage(id){document.querySelectorAll('.admin-tab').forEach(b=>b.classList.toggle('active',b.dataset.page===id));document.querySelectorAll('.admin-page').forEach(p=>p.classList.toggle('active',p.id===id));window.scrollTo({top:0,behavior:'smooth'})}
document.querySelectorAll('.admin-tab').forEach(b=>b.onclick=()=>switchPage(b.dataset.page));document.querySelectorAll('[data-jump]').forEach(b=>b.onclick=()=>switchPage(b.dataset.jump));
async function renderAll(){
 const [a,b,d]=await Promise.all([sb.from('products').select('*,product_photos(id,image_url,storage_path,sort_order)').order('sort_order'),sb.from('orders').select('*,order_items(*)').order('created_at',{ascending:false}),sb.from('shop_settings').select('*').eq('id',1).single()]);
 if(a.error||b.error||d.error){const err=a.error||b.error||d.error;console.error(err);toast('Načítanie dát zlyhalo: '+err.message);return}
 products=a.data||[];orders=b.data||[];settings=d.data||{};$('adminBrandName').textContent=settings.shop_name||'Medlove';$('productCountSide').textContent=products.length;$('orderCountSide').textContent=orders.filter(o=>o.status==='new'&&(o.payment_type!=='card'||o.payment_status==='paid')).length;
 renderDashboard();renderProducts();renderOrders();renderStock();if(typeof renderKanban==='function')renderKanban();loadSettings();renderNotifications();markNotificationsUpdated();await loadGalleryAdmin();
}
function renderDashboard(){const available=orders.filter(o=>o.status==='new'&&(o.payment_type!=='card'||o.payment_status==='paid'));
 $('statProducts').textContent=products.length;$('statOrders').textContent=orders.length;$('statNew').textContent=available.length;$('statRevenue').textContent=money(orders.filter(o=>o.status==='done').reduce((s,o)=>s+Number(o.total),0));
 $('dashboardOrders').innerHTML=orders.slice(0,5).map(o=>`<tr><td><b>${esc(o.order_code)}</b></td><td>${esc(o.customer_name)}</td><td>${money(o.total)}</td><td>${o.payment_type==='card'&&o.payment_status!=='paid'?esc(paymentBadge(o)):statusPill(o.status)}</td></tr>`).join('')||'<tr><td colspan="4">Žiadne objednávky.</td></tr>';
 const low=products.filter(p=>p.stock<=5).sort((a,b)=>a.stock-b.stock);$('lowStockList').innerHTML=low.length?low.map(p=>`<div class="low-stock-item"><div><b>${esc(p.name)}</b><small>${esc(p.weight||'')}</small></div><span class="low-stock-value">${p.stock} ks</span></div>`).join(''):'<p>Zásoby sú v poriadku.</p>';
}
function renderProducts(){let list=[...products];const q=$('adminProductSearch').value.trim().toLowerCase(),filter=$('adminProductFilter').value;if(q)list=list.filter(p=>(p.name+' '+p.type).toLowerCase().includes(q));if(filter==='active')list=list.filter(p=>p.active);else if(filter==='inactive')list=list.filter(p=>!p.active);else if(filter==='low')list=list.filter(p=>p.stock<=5);$('productsTable').innerHTML=list.map(p=>`<tr><td><b>🍯 ${esc(p.name)}</b><br><small>${esc(p.type||'Med')}${p.featured?' • Obľúbené':''}</small></td><td>${money(p.price)}</td><td>${esc(p.weight||'')}</td><td>${p.stock<=5?`<b class="low-stock-value">${p.stock} ks</b>`:p.stock+' ks'}</td><td><span class="product-state ${p.active?'active':'inactive'}">${p.active?'Aktívny':'Skrytý'}</span></td><td class="actions"><button class="icon-btn" onclick="editProduct('${p.id}')" title="Upraviť">✏️</button><button class="icon-btn" onclick="toggleProduct('${p.id}')" title="Viditeľnosť">${p.active?'👁️':'🙈'}</button><button class="icon-btn" onclick="duplicateProduct('${p.id}')" title="Duplikovať">⧉</button><button class="icon-btn" onclick="deleteProduct('${p.id}')" title="Odstrániť">🗑️</button></td></tr>`).join('')||'<tr><td colspan="6">Žiadne produkty.</td></tr>'}
$('adminProductSearch').oninput=renderProducts;$('adminProductFilter').onchange=renderProducts;
function closeModal(id){$(id).classList.add('hidden');document.body.classList.remove('no-scroll')}
function newProduct(){$('productModalTitle').textContent='Pridať produkt';$('productForm').reset();$('productId').value='';$('productType').value='Med';$('productWeight').value='950 g';$('productOrder').value=products.length+1;$('productActive').checked=true;$('productGalleryPhotos').value='';$('productExistingPhotos').replaceChildren();$('adminProductModal').classList.remove('hidden');document.body.classList.add('no-scroll')}
$('addProductBtn').onclick=newProduct;
function editProduct(id){const p=products.find(p=>p.id===id);if(!p)return;$('productModalTitle').textContent='Upraviť produkt';$('productId').value=p.id;$('productName').value=p.name;$('productType').value=p.type||'Med';$('productPrice').value=p.price;$('productStock').value=p.stock;$('productWeight').value=p.weight||'';$('productImage').value=p.image_url||'';$('productDescription').value=p.description||'';$('productOrder').value=p.sort_order||0;$('productFeatured').checked=!!p.featured;$('productActive').checked=!!p.active;$('productPhoto').value='';$('productGalleryPhotos').value='';renderExistingProductPhotos(p);$('adminProductModal').classList.remove('hidden');document.body.classList.add('no-scroll')}
window.editProduct=editProduct;
$('productForm').onsubmit=async e=>{e.preventDefault();const save=e.target.querySelector('button[type="submit"]');save.disabled=true;try{
 let imageUrl=$('productImage').value.trim()||null;const file=$('productPhoto').files[0];if(imageUrl&&!/^https:\/\//i.test(imageUrl)&&!/^assets\/[a-zA-Z0-9._/-]+$/.test(imageUrl))throw Error('Obrázok musí mať HTTPS adresu alebo cestu assets/..');
 if(file){if(file.size>5*1024*1024)throw Error('Fotografia musí mať menej ako 5 MB.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Povolené sú JPG, PNG a WebP.');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`products/${crypto.randomUUID()}.${ext}`;const {error:upErr}=await sb.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw upErr;imageUrl=sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;}
 const entry={name:$('productName').value.trim(),type:$('productType').value.trim()||'Med',description:$('productDescription').value.trim(),price:Number($('productPrice').value),stock:Number($('productStock').value),weight:$('productWeight').value.trim(),image_url:imageUrl,active:$('productActive').checked,featured:$('productFeatured').checked,sort_order:Number($('productOrder').value)||0,updated_at:new Date().toISOString()};const id=$('productId').value;
 const r=id?await sb.from('products').update(entry).eq('id',id).select('id').single():await sb.from('products').insert(entry).select('id').single();
  if(r.error)throw r.error;
  let extrasFailed=false;
  try{await uploadProductExtras(r.data.id)}catch(extraError){extrasFailed=true;console.error(extraError)}
  closeModal('adminProductModal');await renderAll();
  toast(extrasFailed?'Produkt uložený, ale niektoré doplnkové fotografie sa nepodarilo nahrať.':'Produkt uložený.');
 }catch(err){console.error(err);toast(err.message||'Uloženie produktu zlyhalo.')}finally{save.disabled=false}};
async function toggleProduct(id){const p=products.find(p=>p.id===id);if(!p)return;const {error}=await sb.from('products').update({active:!p.active,updated_at:new Date().toISOString()}).eq('id',id);if(error)return toast(error.message);await renderAll()}
async function duplicateProduct(id){const p=products.find(p=>p.id===id);if(!p)return;const {id:old,created_at,updated_at,...copy}=p;copy.name+=' – kópia';copy.sort_order=products.length+1;const {error}=await sb.from('products').insert(copy);if(error)return toast(error.message);await renderAll();toast('Produkt duplikovaný.')}
async function deleteProduct(id){if(!confirm('Naozaj chceš produkt odstrániť? História objednávok zostane zachovaná.'))return;const {error}=await sb.from('products').delete().eq('id',id);if(error)return toast(error.message);await renderAll();toast('Produkt odstránený.')}
window.toggleProduct=toggleProduct;window.duplicateProduct=duplicateProduct;window.deleteProduct=deleteProduct;
function renderOrders(){let list=[...orders],q=$('orderSearch').value.trim().toLowerCase(),filter=$('orderFilter').value;if(q)list=list.filter(o=>(o.order_code+' '+o.customer_name+' '+o.phone).toLowerCase().includes(q));if(filter!=='all')list=list.filter(o=>o.status===filter);const paymentFilter=$('paymentFilter').value;if(paymentFilter!=='all')list=list.filter(o=>o.payment_type==='cash'?(paymentFilter==='unpaid'):o.payment_status===paymentFilter);
 const delivery={pickup:'Osobný odber',local:'Lokálny dovoz',other:'Dohoda'};
 $('ordersTable').innerHTML=list.map(o=>{const pending=o.payment_type==='card'&&o.payment_status!=='paid';return `<tr><td><b>${esc(o.order_code)}</b></td><td>${esc(o.customer_name)}<br><small>${esc(o.phone||'')}</small></td><td>${money(o.total)}</td><td>${esc(new Date(o.created_at).toLocaleString('sk-SK'))}</td><td>${delivery[o.delivery_type]||esc(o.delivery_type)}</td><td>${esc(paymentBadge(o))}</td><td><select ${pending?'disabled':''} onchange="changeStatus('${o.id}',this.value)">${Object.entries(statusNames).map(([k,v])=>`<option value="${k}" ${o.status===k?'selected':''}>${v}</option>`).join('')}</select></td><td><button class="icon-btn" onclick="openOrder('${o.id}')">Detail</button></td></tr>`}).join('')||'<tr><td colspan="8">Žiadne objednávky.</td></tr>';
}
$('orderSearch').oninput=renderOrders;$('orderFilter').onchange=renderOrders;$('paymentFilter').onchange=renderOrders;
async function changeStatus(id,status){const o=orders.find(o=>o.id===id);if(!o)return;if(o.payment_type==='card'&&o.payment_status!=='paid'){toast('Najprv musí byť potvrdená platba.');renderOrders();return}if(status==='cancelled'){if(o.payment_status==='paid'){toast('Pri zaplatenej objednávke treba najprv riešiť vrátenie platby v Stripe.');renderOrders();return}const r=await sb.rpc('cancel_medlove_admin_order',{p_order_id:id});if(r.error||!r.data){toast(r.error?.message||'Objednávku nemožno zrušiť.');renderOrders();return}}else{const r=await sb.from('orders').update({status,updated_at:new Date().toISOString()}).eq('id',id);if(r.error){toast(r.error.message);renderOrders();return}}await renderAll();toast('Stav objednávky bol aktualizovaný.')}
window.changeStatus=changeStatus;
function openOrder(id){const o=orders.find(o=>o.id===id);if(!o)return;$('orderDetailTitle').textContent=o.order_code;const delivery={pickup:'Osobný odber',local:'Lokálny dovoz',other:'Dohoda'};$('orderDetailContent').innerHTML=`<div class="order-detail-grid"><div class="order-box"><h4>Zákazník</h4><p><b>${esc(o.customer_name)}</b></p><p>${esc(o.phone)}</p><p>${esc(o.email||'')}</p></div><div class="order-box"><h4>Prevzatie</h4><p>${delivery[o.delivery_type]||esc(o.delivery_type)}</p><p>${esc(o.delivery_address||'')}</p><p>Platba: ${esc(paymentBadge(o))}</p></div></div><div class="order-box" style="margin-top:12px"><h4>Poznámka</h4><p>${esc(o.note||'Bez poznámky')}</p></div><div style="margin-top:18px"><h4>Položky</h4>${(o.order_items||[]).map(i=>`<div class="order-line"><span>${i.quantity} × ${esc(i.product_name)}</span><b>${money(i.line_total)}</b></div>`).join('')}<div class="order-total"><span>Spolu</span><span>${money(o.total)}</span></div></div>`;$('orderDetailModal').classList.remove('hidden');document.body.classList.add('no-scroll');void showOrderHistory(id)}
window.openOrder=openOrder;
function renderStock(){$('stockGrid').innerHTML=[...products].sort((a,b)=>a.stock-b.stock).map(p=>`<article class="stock-card"><div class="stock-card-head"><div><h3>${esc(p.name)}</h3><small>${esc(p.weight||'')}</small></div><b class="${p.stock<=5?'low-stock-value':''}">${p.stock} ks</b></div><div class="stock-control"><input id="stock-${p.id}" type="number" min="0" value="${p.stock}"><button class="btn btn-primary" onclick="saveStock('${p.id}')">Uložiť</button></div></article>`).join('')}
async function saveStock(id){const n=Math.floor(Number($('stock-'+id).value));if(!Number.isFinite(n)||n<0)return toast('Neplatný sklad.');const {error}=await sb.from('products').update({stock:n,updated_at:new Date().toISOString()}).eq('id',id);if(error)return toast(error.message);await renderAll();toast('Sklad bol upravený.')}
window.saveStock=saveStock;
function loadSettings(){const m={setShopName:'shop_name',setSubtitle:'subtitle',setHeroTitle:'hero_title',setHeroText:'hero_text',setPhone:'phone',setAddress:'address',setFacebook:'facebook',setDeliveryArea:'delivery_area',setAboutTitle:'about_title',setAboutText:'about_text',setFooterText:'footer_text',setFreeDeliveryQty:'free_delivery_qty',setAnnouncement:'announcement'};Object.entries(m).forEach(([el,col])=>$(el).value=settings[col]??'');$('setAnnouncementActive').checked=!!settings.announcement_active}
$('settingsForm').onsubmit=async e=>{e.preventDefault();const data={shop_name:$('setShopName').value.trim(),subtitle:$('setSubtitle').value.trim(),hero_title:$('setHeroTitle').value.trim(),hero_text:$('setHeroText').value.trim(),phone:$('setPhone').value.trim(),address:$('setAddress').value.trim(),facebook:$('setFacebook').value.trim(),delivery_area:$('setDeliveryArea').value.trim(),about_title:$('setAboutTitle').value.trim(),about_text:$('setAboutText').value.trim(),footer_text:$('setFooterText').value.trim(),free_delivery_qty:Math.max(1,Number($('setFreeDeliveryQty').value)||3),announcement:$('setAnnouncement').value.trim(),announcement_active:$('setAnnouncementActive').checked,updated_at:new Date().toISOString()};const {error}=await sb.from('shop_settings').update(data).eq('id',1);if(error)return toast(error.message);await renderAll();toast('Nastavenia uložené.')};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),products,orders,settings},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='medlove-export-'+new Date().toISOString().slice(0,10)+'.json';link.click();URL.revokeObjectURL(link.href)};
$('resetBtn').disabled=true;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));restoreSession();

// V7: upozornenia sú odvodené zo skutočných objednávok a produktov.
// Počítadlo označuje udalosti vyžadujúce pozornosť, nie neprečítané správy.
function getAdminAlerts(){
 const alerts=[];
 orders.forEach(order=>{
  if(order.status==='new'&&(order.payment_type!=='card'||order.payment_status==='paid')){
   alerts.push({key:'new-'+order.id,icon:'📦',title:'Nová objednávka '+order.order_code,
    description:order.customer_name+' · '+money(order.total),page:'orders',order:order.order_code,
    timestamp:order.created_at,level:'new'});
  }else if(order.payment_type==='card'&&order.payment_status==='pending'&&order.status!=='cancelled'){
   alerts.push({key:'payment-'+order.id,icon:'💳',title:'Čakajúca platba '+order.order_code,
    description:'Objednávka je rezervovaná, kým Stripe nepotvrdí platbu.',page:'orders',order:order.order_code,
    timestamp:order.created_at,level:'pending'});
  }
 });
 products.filter(product=>product.active&&product.stock<=5).forEach(product=>{
  alerts.push({key:'stock-'+product.id,icon:'🍯',
   title:product.stock===0?'Vypredané: '+product.name:'Nízky sklad: '+product.name,
   description:product.stock+' ks na sklade',page:'stock',order:null,
   timestamp:product.updated_at||product.created_at,level:product.stock===0?'critical':'low'});
 });
 return alerts.sort((a,b)=>(b.timestamp||'').localeCompare(a.timestamp||''));
}
function alertElement(alert){
 const button=document.createElement('button');button.type='button';
 button.className='notification-item notification-'+alert.level;
 const icon=document.createElement('span');icon.className='notification-icon';icon.textContent=alert.icon;
 const body=document.createElement('span');body.className='notification-content';
 const title=document.createElement('strong');title.textContent=alert.title;
 const description=document.createElement('small');description.textContent=alert.description;
 body.append(title,description);
 const arrow=document.createElement('span');arrow.textContent='→';arrow.setAttribute('aria-hidden','true');
 button.append(icon,body,arrow);
 button.addEventListener('click',()=>{
  if(alert.order){$('orderSearch').value=alert.order;$('orderFilter').value='all';$('paymentFilter').value='all'}
  switchPage(alert.page);if(alert.page==='orders')renderOrders();
 });
 return button;
}
function renderNotifications(){
 const alerts=getAdminAlerts();
 const filter=$('notificationFilter').value;
 const filtered=filter==='all'?alerts:alerts.filter(alert=>filter==='stock'?['low','critical'].includes(alert.level):alert.level===filter);
 $('headerNotificationCount').textContent=alerts.length;
 $('notificationCountSide').textContent=alerts.length;
 $('headerNotifications').setAttribute('aria-label','Centrum upozornení: '+alerts.length+' položiek');
 for(const [target,limit] of [[$('notificationList'),50],[$('dashboardNotifications'),4]]){
  const shown=target===$('notificationList')?filtered:alerts;
  target.replaceChildren();
  if(!shown.length){
   const empty=document.createElement('p');empty.className='notification-empty';
   empty.textContent=alerts.length?'V zvolenej kategórii nie sú žiadne upozornenia.':'✓ Žiadne upozornenia. Objednávky a zásoby nevyžadujú pozornosť.';
   target.append(empty);continue;
  }
  shown.slice(0,limit).forEach(alert=>target.append(alertElement(alert)));
 }
}
$('headerNotifications').addEventListener('click',()=>switchPage('notifications'));
$('notificationFilter').addEventListener('change',renderNotifications);
function markNotificationsUpdated(){
 $('notificationsUpdated').textContent='Posledné obnovenie: '+new Date().toLocaleTimeString('sk-SK',{hour:'2-digit',minute:'2-digit'});
}
let alertsRefreshing=false;
async function refreshAdminAlerts(){
 if(alertsRefreshing||!adminReady||document.hidden)return;
 alertsRefreshing=true;
 try{
  const [a,b]=await Promise.all([
   sb.from('products').select('*').order('sort_order'),
   sb.from('orders').select('*,order_items(*)').order('created_at',{ascending:false})
  ]);
  if(a.error||b.error)throw a.error||b.error;
  products=a.data||[];orders=b.data||[];
  $('productCountSide').textContent=products.length;
  $('orderCountSide').textContent=orders.filter(o=>o.status==='new'&&(o.payment_type!=='card'||o.payment_status==='paid')).length;
  renderDashboard();renderNotifications();markNotificationsUpdated();if(typeof renderKanban==='function')renderKanban();
  if($('orders').classList.contains('active'))renderOrders();
  if($('stock').classList.contains('active'))renderStock();
 }catch(error){console.warn('Obnovenie upozornení zlyhalo:',error.message);toast('Upozornenia sa nepodarilo obnoviť.')}
 finally{alertsRefreshing=false}
}
$('refreshNotifications').addEventListener('click',refreshAdminAlerts);
setInterval(()=>{if(adminReady&&!document.hidden)void refreshAdminAlerts()},60000);

// Správa autentických fotografií – uploaduje iba prihlásený admin do existujúceho bucketu.
let farmPhotos=[];
const galleryBucket=sb.storage.from('product-images');
async function loadGalleryAdmin(){
 const result=await sb.from('farm_gallery').select('*')
   .order('sort_order',{ascending:true}).order('created_at',{ascending:false}).limit(100);
 if(result.error){console.warn('Galéria:',result.error.message);toast('Fotogalériu sa nepodarilo načítať.');return}
 farmPhotos=result.data||[];
 $('galleryPhotoCount').textContent=farmPhotos.length+' fotografií celkom';
 const filter=$('adminGalleryFilter').value;
 const visiblePhotos=farmPhotos.filter(photo=>filter==='all'||(filter==='published'&&photo.published)||(filter==='hidden'&&!photo.published));
 const grid=$('adminGalleryGrid');grid.replaceChildren();
 if(!visiblePhotos.length){
  const empty=document.createElement('p');empty.className='gallery-admin-empty';
  empty.textContent=farmPhotos.length?'V tomto filtri nie sú fotografie.':'Zatiaľ tu nie sú fotografie. Nahraj skutočné zábery farmy cez formulár vyššie.';
  grid.append(empty);return;
 }
 visiblePhotos.forEach(photo=>{
  const card=document.createElement('article');card.className='admin-gallery-card';
  const img=document.createElement('img');
  img.src=galleryBucket.getPublicUrl(photo.storage_path).data.publicUrl;
  img.alt=photo.caption||photo.category;img.loading='lazy';
  const body=document.createElement('div');body.className='admin-gallery-card-body';
  const title=document.createElement('strong');title.textContent=photo.caption||photo.category;
  const info=document.createElement('small');info.textContent=photo.category+' · '+(photo.published?'Zverejnené':'Skryté');
  const edit=document.createElement('form');edit.className='gallery-edit-form';edit.hidden=true;
  const editLabel=document.createElement('label');editLabel.textContent='Popis';
  const captionInput=document.createElement('input');captionInput.name='caption';captionInput.maxLength=200;captionInput.value=photo.caption||'';
  editLabel.append(captionInput);
  const categoryLabel=document.createElement('label');categoryLabel.textContent='Kategória';
  const categorySelect=document.createElement('select');categorySelect.name='category';
  ['Zo života farmy','Úle','Zber medu','Balenie'].forEach(category=>{
   const option=document.createElement('option');option.value=category;option.textContent=category;
   option.selected=photo.category===category;categorySelect.append(option);
  });
  categoryLabel.append(categorySelect);
  const orderLabel=document.createElement('label');orderLabel.textContent='Poradie';
  const orderInput=document.createElement('input');orderInput.type='number';orderInput.min='0';
  orderInput.step='1';orderInput.name='order';orderInput.value=String(photo.sort_order||0);orderLabel.append(orderInput);
  const saveEdit=document.createElement('button');saveEdit.type='submit';saveEdit.className='btn btn-primary';saveEdit.textContent='Uložiť úpravy';
  const cancelEdit=document.createElement('button');cancelEdit.type='button';cancelEdit.className='btn btn-secondary';cancelEdit.textContent='Zrušiť';
  cancelEdit.addEventListener('click',()=>{edit.hidden=true;editButton.setAttribute('aria-expanded','false')});
  edit.append(editLabel,categoryLabel,orderLabel,saveEdit,cancelEdit);
  edit.addEventListener('submit',async event=>{
   event.preventDefault();const nextOrder=Number(orderInput.value);
   if(!Number.isInteger(nextOrder)||nextOrder<0){toast('Poradie musí byť nezáporné celé číslo.');return}
   saveEdit.disabled=true;
   try{
    const result=await sb.from('farm_gallery').update({
     caption:captionInput.value.trim().slice(0,200),category:categorySelect.value,
     sort_order:nextOrder,updated_at:new Date().toISOString()
    }).eq('id',photo.id);
    if(result.error)throw result.error;
    await loadGalleryAdmin();toast('Údaje fotografie boli uložené.');
   }catch(error){toast(error.message||'Úpravu sa nepodarilo uložiť.')}
   finally{saveEdit.disabled=false}
  });
  const actions=document.createElement('div');actions.className='admin-gallery-actions';
  const editButton=document.createElement('button');editButton.type='button';editButton.className='btn btn-secondary';editButton.textContent='Upraviť';editButton.setAttribute('aria-expanded','false');
  editButton.addEventListener('click',()=>{edit.hidden=!edit.hidden;editButton.setAttribute('aria-expanded',String(!edit.hidden));if(!edit.hidden)captionInput.focus()});
  const toggle=document.createElement('button');toggle.type='button';toggle.className='btn btn-secondary';
  toggle.textContent=photo.published?'Skryť':'Zverejniť';
  toggle.addEventListener('click',async()=>{
   toggle.disabled=true;
   try{
    const result=await sb.from('farm_gallery').update({published:!photo.published,updated_at:new Date().toISOString()}).eq('id',photo.id);
    if(result.error)throw result.error;
    await loadGalleryAdmin();toast(photo.published?'Fotografia skrytá.':'Fotografia zverejnená.');
   }catch(error){toast(error.message)}finally{toggle.disabled=false}
  });
  const remove=document.createElement('button');remove.type='button';remove.className='btn btn-danger';
  remove.textContent='Odstrániť';
  remove.addEventListener('click',async()=>{
   if(!confirm('Odstrániť fotografiu z galérie?'))return;
   remove.disabled=true;
   try{
    const result=await sb.from('farm_gallery').delete().eq('id',photo.id);
    if(result.error)throw result.error;
    if(photo.storage_path.startsWith('gallery/')){
     const storage=await galleryBucket.remove([photo.storage_path]);
     if(storage.error)console.warn('Fotografia zostala v Storage:',storage.error.message);
    }
    await loadGalleryAdmin();toast('Fotografia odstránená z galérie.');
   }catch(error){toast(error.message)}finally{remove.disabled=false}
  });
  actions.append(editButton,toggle,remove);body.append(title,info,actions,edit);card.append(img,body);grid.append(card);
 });
}
$('adminGalleryFilter').addEventListener('change',()=>{
 const active=document.activeElement;
 // Local rendering uses already-loaded data, no additional database request.
 const filter=$('adminGalleryFilter').value;
 const cards=$('adminGalleryGrid');cards.replaceChildren();
 const filtered=farmPhotos.filter(photo=>filter==='all'||(filter==='published'&&photo.published)||(filter==='hidden'&&!photo.published));
 if(!filtered.length){const empty=document.createElement('p');empty.className='gallery-admin-empty';empty.textContent='V tomto filtri nie sú fotografie.';cards.append(empty);return}
 // Reuse the normal gallery renderer without changing records or upload state.
 void loadGalleryAdmin();
});
$('galleryForm').addEventListener('submit',async event=>{
 event.preventDefault();
 const submit=event.target.querySelector('button[type="submit"]');
 const file=$('galleryPhoto').files[0];
 if(!file||!$('galleryRights').checked){toast('Vyber fotografiu a potvrď právo na jej zverejnenie.');return}
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024||file.size===0){
  toast('Povolené sú JPG, PNG, WebP do 5 MB.');return;
 }
 const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type];
 const path='gallery/'+crypto.randomUUID()+'.'+ext;
 submit.disabled=true;
 try{
  const upload=await galleryBucket.upload(path,file,{contentType:file.type,upsert:false});
  if(upload.error)throw upload.error;
  const photo={
   storage_path:path,image_url:galleryBucket.getPublicUrl(path).data.publicUrl,
   caption:$('galleryCaption').value.trim().slice(0,200),
   category:$('galleryCategory').value,
   sort_order:Math.max(0,Number($('galleryOrder').value)||0),
   published:$('galleryPublished').checked
  };
  const saved=await sb.from('farm_gallery').insert(photo);
  if(saved.error){await galleryBucket.remove([path]);throw saved.error}
  event.target.reset();$('galleryPublished').checked=true;
  await loadGalleryAdmin();toast('Fotografia pridaná do galérie.');
 }catch(error){console.error(error);toast(error.message||'Nahratie zlyhalo.')}
 finally{submit.disabled=false}
});
