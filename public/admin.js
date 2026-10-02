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
 const [a,b,d]=await Promise.all([sb.from('products').select('*').order('sort_order'),sb.from('orders').select('*,order_items(*)').order('created_at',{ascending:false}),sb.from('shop_settings').select('*').eq('id',1).single()]);
 if(a.error||b.error||d.error){const err=a.error||b.error||d.error;console.error(err);toast('Načítanie dát zlyhalo: '+err.message);return}
 products=a.data||[];orders=b.data||[];settings=d.data||{};$('adminBrandName').textContent=settings.shop_name||'Medlove';$('productCountSide').textContent=products.length;$('orderCountSide').textContent=orders.filter(o=>o.status==='new'&&(o.payment_type!=='card'||o.payment_status==='paid')).length;
 renderDashboard();renderProducts();renderOrders();renderStock();loadSettings();
}
function renderDashboard(){const available=orders.filter(o=>o.status==='new'&&(o.payment_type!=='card'||o.payment_status==='paid'));
 $('statProducts').textContent=products.length;$('statOrders').textContent=orders.length;$('statNew').textContent=available.length;$('statRevenue').textContent=money(orders.filter(o=>o.status==='done').reduce((s,o)=>s+Number(o.total),0));
 $('dashboardOrders').innerHTML=orders.slice(0,5).map(o=>`<tr><td><b>${esc(o.order_code)}</b></td><td>${esc(o.customer_name)}</td><td>${money(o.total)}</td><td>${o.payment_type==='card'&&o.payment_status!=='paid'?esc(paymentBadge(o)):statusPill(o.status)}</td></tr>`).join('')||'<tr><td colspan="4">Žiadne objednávky.</td></tr>';
 const low=products.filter(p=>p.stock<=5).sort((a,b)=>a.stock-b.stock);$('lowStockList').innerHTML=low.length?low.map(p=>`<div class="low-stock-item"><div><b>${esc(p.name)}</b><small>${esc(p.weight||'')}</small></div><span class="low-stock-value">${p.stock} ks</span></div>`).join(''):'<p>Zásoby sú v poriadku.</p>';
}
function renderProducts(){let list=[...products];const q=$('adminProductSearch').value.trim().toLowerCase(),filter=$('adminProductFilter').value;if(q)list=list.filter(p=>(p.name+' '+p.type).toLowerCase().includes(q));if(filter==='active')list=list.filter(p=>p.active);else if(filter==='inactive')list=list.filter(p=>!p.active);else if(filter==='low')list=list.filter(p=>p.stock<=5);$('productsTable').innerHTML=list.map(p=>`<tr><td><b>🍯 ${esc(p.name)}</b><br><small>${esc(p.type||'Med')}${p.featured?' • Obľúbené':''}</small></td><td>${money(p.price)}</td><td>${esc(p.weight||'')}</td><td>${p.stock<=5?`<b class="low-stock-value">${p.stock} ks</b>`:p.stock+' ks'}</td><td><span class="product-state ${p.active?'active':'inactive'}">${p.active?'Aktívny':'Skrytý'}</span></td><td class="actions"><button class="icon-btn" onclick="editProduct('${p.id}')" title="Upraviť">✏️</button><button class="icon-btn" onclick="toggleProduct('${p.id}')" title="Viditeľnosť">${p.active?'👁️':'🙈'}</button><button class="icon-btn" onclick="duplicateProduct('${p.id}')" title="Duplikovať">⧉</button><button class="icon-btn" onclick="deleteProduct('${p.id}')" title="Odstrániť">🗑️</button></td></tr>`).join('')||'<tr><td colspan="6">Žiadne produkty.</td></tr>'}
$('adminProductSearch').oninput=renderProducts;$('adminProductFilter').onchange=renderProducts;
function closeModal(id){$(id).classList.add('hidden');document.body.classList.remove('no-scroll')}
function newProduct(){$('productModalTitle').textContent='Pridať produkt';$('productForm').reset();$('productId').value='';$('productType').value='Med';$('productWeight').value='950 g';$('productOrder').value=products.length+1;$('productActive').checked=true;$('adminProductModal').classList.remove('hidden');document.body.classList.add('no-scroll')}
$('addProductBtn').onclick=newProduct;
function editProduct(id){const p=products.find(p=>p.id===id);if(!p)return;$('productModalTitle').textContent='Upraviť produkt';$('productId').value=p.id;$('productName').value=p.name;$('productType').value=p.type||'Med';$('productPrice').value=p.price;$('productStock').value=p.stock;$('productWeight').value=p.weight||'';$('productImage').value=p.image_url||'';$('productDescription').value=p.description||'';$('productOrder').value=p.sort_order||0;$('productFeatured').checked=!!p.featured;$('productActive').checked=!!p.active;$('productPhoto').value='';$('adminProductModal').classList.remove('hidden');document.body.classList.add('no-scroll')}
window.editProduct=editProduct;
$('productForm').onsubmit=async e=>{e.preventDefault();const save=e.target.querySelector('button[type="submit"]');save.disabled=true;try{
 let imageUrl=$('productImage').value.trim()||null;const file=$('productPhoto').files[0];if(imageUrl&&!/^https:\/\//i.test(imageUrl)&&!/^assets\/[a-zA-Z0-9._/-]+$/.test(imageUrl))throw Error('Obrázok musí mať HTTPS adresu alebo cestu assets/..');
 if(file){if(file.size>5*1024*1024)throw Error('Fotografia musí mať menej ako 5 MB.');if(!['image/jpeg','image/png','image/webp'].includes(file.type))throw Error('Povolené sú JPG, PNG a WebP.');const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'}[file.type],path=`products/${crypto.randomUUID()}.${ext}`;const {error:upErr}=await sb.storage.from('product-images').upload(path,file,{contentType:file.type,upsert:false});if(upErr)throw upErr;imageUrl=sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;}
 const entry={name:$('productName').value.trim(),type:$('productType').value.trim()||'Med',description:$('productDescription').value.trim(),price:Number($('productPrice').value),stock:Number($('productStock').value),weight:$('productWeight').value.trim(),image_url:imageUrl,active:$('productActive').checked,featured:$('productFeatured').checked,sort_order:Number($('productOrder').value)||0,updated_at:new Date().toISOString()};const id=$('productId').value;
 const r=id?await sb.from('products').update(entry).eq('id',id):await sb.from('products').insert(entry);if(r.error)throw r.error;closeModal('adminProductModal');await renderAll();toast('Produkt uložený.');
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
function openOrder(id){const o=orders.find(o=>o.id===id);if(!o)return;$('orderDetailTitle').textContent=o.order_code;const delivery={pickup:'Osobný odber',local:'Lokálny dovoz',other:'Dohoda'};$('orderDetailContent').innerHTML=`<div class="order-detail-grid"><div class="order-box"><h4>Zákazník</h4><p><b>${esc(o.customer_name)}</b></p><p>${esc(o.phone)}</p><p>${esc(o.email||'')}</p></div><div class="order-box"><h4>Prevzatie</h4><p>${delivery[o.delivery_type]||esc(o.delivery_type)}</p><p>${esc(o.delivery_address||'')}</p><p>Platba: ${esc(paymentBadge(o))}</p></div></div><div class="order-box" style="margin-top:12px"><h4>Poznámka</h4><p>${esc(o.note||'Bez poznámky')}</p></div><div style="margin-top:18px"><h4>Položky</h4>${(o.order_items||[]).map(i=>`<div class="order-line"><span>${i.quantity} × ${esc(i.product_name)}</span><b>${money(i.line_total)}</b></div>`).join('')}<div class="order-total"><span>Spolu</span><span>${money(o.total)}</span></div></div>`;$('orderDetailModal').classList.remove('hidden');document.body.classList.add('no-scroll')}
window.openOrder=openOrder;
function renderStock(){$('stockGrid').innerHTML=[...products].sort((a,b)=>a.stock-b.stock).map(p=>`<article class="stock-card"><div class="stock-card-head"><div><h3>${esc(p.name)}</h3><small>${esc(p.weight||'')}</small></div><b class="${p.stock<=5?'low-stock-value':''}">${p.stock} ks</b></div><div class="stock-control"><input id="stock-${p.id}" type="number" min="0" value="${p.stock}"><button class="btn btn-primary" onclick="saveStock('${p.id}')">Uložiť</button></div></article>`).join('')}
async function saveStock(id){const n=Math.floor(Number($('stock-'+id).value));if(!Number.isFinite(n)||n<0)return toast('Neplatný sklad.');const {error}=await sb.from('products').update({stock:n,updated_at:new Date().toISOString()}).eq('id',id);if(error)return toast(error.message);await renderAll();toast('Sklad bol upravený.')}
window.saveStock=saveStock;
function loadSettings(){const m={setShopName:'shop_name',setSubtitle:'subtitle',setHeroTitle:'hero_title',setHeroText:'hero_text',setPhone:'phone',setAddress:'address',setFacebook:'facebook',setDeliveryArea:'delivery_area',setAboutTitle:'about_title',setAboutText:'about_text',setFooterText:'footer_text',setFreeDeliveryQty:'free_delivery_qty',setAnnouncement:'announcement'};Object.entries(m).forEach(([el,col])=>$(el).value=settings[col]??'');$('setAnnouncementActive').checked=!!settings.announcement_active}
$('settingsForm').onsubmit=async e=>{e.preventDefault();const data={shop_name:$('setShopName').value.trim(),subtitle:$('setSubtitle').value.trim(),hero_title:$('setHeroTitle').value.trim(),hero_text:$('setHeroText').value.trim(),phone:$('setPhone').value.trim(),address:$('setAddress').value.trim(),facebook:$('setFacebook').value.trim(),delivery_area:$('setDeliveryArea').value.trim(),about_title:$('setAboutTitle').value.trim(),about_text:$('setAboutText').value.trim(),footer_text:$('setFooterText').value.trim(),free_delivery_qty:Math.max(1,Number($('setFreeDeliveryQty').value)||3),announcement:$('setAnnouncement').value.trim(),announcement_active:$('setAnnouncementActive').checked,updated_at:new Date().toISOString()};const {error}=await sb.from('shop_settings').update(data).eq('id',1);if(error)return toast(error.message);await renderAll();toast('Nastavenia uložené.')};
$('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({exported_at:new Date().toISOString(),products,orders,settings},null,2)],{type:'application/json'});const link=document.createElement('a');link.href=URL.createObjectURL(blob);link.download='medlove-export-'+new Date().toISOString().slice(0,10)+'.json';link.click();URL.revokeObjectURL(link.href)};
$('resetBtn').disabled=true;document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));restoreSession();
