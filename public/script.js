// Medlove V6 — produkty a nastavenia sa načítavajú zo Supabase.
// Košík je lokálny. Objednávku, cenu a zásoby overuje iba backend na Renderi.
const cfg=window.MEDLOVE_CONFIG;
const sb=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey);
const $=id=>document.getElementById(id);
const money=v=>Number(v).toLocaleString('sk-SK',{style:'currency',currency:'EUR'});
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const localImages={'Kvetový med':'assets/kvetovy.webp','Agátový med':'assets/agatovy.webp','Pastovaný med':'assets/pastovany.webp','Medovicový med':'assets/medovicovy.webp'};
const defaults={shop_name:'Medlove',subtitle:'Včelia farma Slnečná',hero_title:'Poctivý med priamo od včelára.',hero_text:'Slovenský med z Likavky.',phone:'0908 356 858',address:'Likavka 290',facebook:'Včelia Farma Slnečná',delivery_area:'Ružomberok a blízke okolie',free_delivery_qty:3,about_title:'Príroda. Kvalita. Poctivosť.',about_text:'Rodinná včelia farma z Likavky.',footer_text:'Poctivý slovenský med z Likavky.',announcement:'🚚 Pri odbere od 3 ks dovoz do RK a blízkeho okolia zdarma.',announcement_active:true};
let products=[],settings={...defaults},cart=JSON.parse(localStorage.getItem('medlove_v5_cart')||'[]'),currentProductId=null;
let backendStatus={available:false,card:false};
function toast(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function photo(p){return p.image_url||localImages[p.name]||null}
function visual(p){const src=photo(p);return src?`<img src="${esc(src)}" alt="${esc(p.name)}" loading="lazy">`:'🍯'}
function telephone(){return 'tel:'+String(settings.phone||'').replace(/[^+0-9]/g,'')}
function applySettings(){
 document.title=`${settings.shop_name} • ${settings.subtitle||''}`;
 const fields={brandName:'shop_name',brandSubtitle:'subtitle',heroTitle:'hero_title',heroText:'hero_text',aboutTitle:'about_title',aboutText:'about_text',contactPhone:'phone',contactAddress:'address',contactFacebook:'facebook',footerBrand:'shop_name',footerText:'footer_text',announcementText:'announcement'};
 Object.entries(fields).forEach(([id,key])=>{if($(id))$(id).textContent=settings[key]||''});
 $('copyright').textContent=`© ${new Date().getFullYear()} ${settings.shop_name} – ${settings.subtitle}`;
 $('topNote').classList.toggle('hidden',!settings.announcement_active);
 $('deliveryText').textContent=`Dovoz zdarma pri ${settings.free_delivery_qty} a viac kusoch do oblasti ${settings.delivery_area}. Pri menšom odbere alebo inej lokalite nás kontaktuj telefonicky.`;
 document.querySelectorAll('a[href^="tel:"]').forEach(a=>a.href=telephone());
}
async function loadStore(){
 const [a,b]=await Promise.all([sb.from('products').select('*').eq('active',true).order('sort_order'),sb.from('shop_settings').select('*').eq('id',1).single()]);
 if(a.error){console.error(a.error);toast('Produkty sa nepodarilo načítať. Skontroluj pripojenie.')}else products=a.data||[];
 if(b.error)console.warn('Nastavenia obchodu:',b.error.message);else settings={...defaults,...b.data};
 applySettings();reconcileCart();renderProducts();renderCart();
}
function filtered(){let list=products.filter(p=>p.active);const q=$('productSearch').value.toLowerCase().trim();if(q)list=list.filter(p=>(p.name+' '+p.type+' '+(p.description||'')).toLowerCase().includes(q));const sort=$('sortSelect').value;if(sort==='price-asc')list.sort((a,b)=>a.price-b.price);else if(sort==='price-desc')list.sort((a,b)=>b.price-a.price);else if(sort==='name')list.sort((a,b)=>a.name.localeCompare(b.name,'sk'));else list.sort((a,b)=>(Number(b.featured)-Number(a.featured))+(a.sort_order-b.sort_order)*.01);return list;}
function stockBadge(p){return Number(p.stock)===0?'<span class="stock out">Vypredané</span>':Number(p.stock)<=5?`<span class="stock low">Posledné ${p.stock} ks</span>`:'<span class="stock">Skladom</span>'}
function renderProducts(){const list=filtered();$('emptyState').classList.toggle('hidden',list.length>0);$('productGrid').innerHTML=list.map(p=>`<article class="product-card ${p.featured?'featured':''}"><div class="product-image">${visual(p)}</div><div class="product-body"><div class="product-top"><span class="product-type">${esc(p.type||'Med')}</span>${stockBadge(p)}</div><h3>${esc(p.name)}</h3><p>${esc(p.description||'')}</p><div class="product-bottom"><div class="price"><b>${money(p.price)}</b><small>${esc(p.weight||'')}</small></div><div class="product-actions"><button class="mini-btn" onclick="openProduct('${p.id}')" aria-label="Detail produktu">↗</button><button class="add-btn" onclick="addToCart('${p.id}')" ${Number(p.stock)<=0?'disabled':''}>Pridať</button></div></div></div></article>`).join('')}
function reconcileCart(){cart=cart.filter(item=>products.some(p=>p.id===item.id&&p.active&&p.stock>0)).map(item=>{const p=products.find(p=>p.id===item.id);return{id:p.id,name:p.name,price:Number(p.price),image:photo(p),qty:Math.max(1,Math.min(Number(item.qty)||1,p.stock))}});saveCart(false)}
function saveCart(redraw=true){localStorage.setItem('medlove_v5_cart',JSON.stringify(cart));if(redraw)renderCart()}
function qty(){return cart.reduce((sum,item)=>sum+item.qty,0)}
function subtotal(){return cart.reduce((sum,item)=>sum+item.qty*item.price,0)}
function addToCart(id){const p=products.find(p=>p.id===id);if(!p)return;let item=cart.find(x=>x.id===id);if(item&&item.qty>=p.stock){toast('Viac kusov už nie je na sklade.');return}if(item)item.qty++;else cart.push({id:p.id,name:p.name,price:Number(p.price),image:photo(p),qty:1});saveCart();toast(p.name+' pridaný do košíka.');}
function changeQty(id,delta){const p=products.find(p=>p.id===id),item=cart.find(x=>x.id===id);if(!item)return;item.qty+=delta;if(item.qty<=0)cart=cart.filter(x=>x.id!==id);else if(p&&item.qty>p.stock){item.qty=p.stock;toast('Dosiahnutý dostupný sklad.')}saveCart()}
function removeItem(id){cart=cart.filter(x=>x.id!==id);saveCart()}
window.addToCart=addToCart;window.changeQty=changeQty;window.removeItem=removeItem;
function renderCart(){
 $('cartCount').textContent=qty();$('cartItems').innerHTML=cart.length?cart.map(i=>`<div class="cart-item"><div class="cart-thumb">${i.image?`<img src="${esc(i.image)}" alt="">`:'🍯'}</div><div><h4>${esc(i.name)}</h4><small>${money(i.price)} / ks</small><div class="qty"><button onclick="changeQty('${i.id}',-1)">−</button><b>${i.qty}</b><button onclick="changeQty('${i.id}',1)">+</button></div></div><button class="remove" onclick="removeItem('${i.id}')">Odstrániť</button></div>`).join(''):'<div class="empty-state"><span>🛒</span><h3>Košík je prázdny</h3><p>Vyber si svoj obľúbený med.</p></div>';
 const min=Math.max(1,Number(settings.free_delivery_qty)||3),missing=Math.max(0,min-qty());$('freeDeliveryProgress').style.width=Math.min(100,qty()/min*100)+'%';$('freeDeliveryText').textContent=missing?'Pridaj ešte '+missing+' ks pre bezplatný lokálny dovoz.':`Lokálny dovoz v oblasti ${settings.delivery_area} máš zdarma 🎉`;
 $('cartSubtotal').textContent=money(subtotal());$('cartTotal').textContent=money(subtotal());$('cartDelivery').textContent='podľa spôsobu prevzatia';$('checkoutTotal').textContent=money(subtotal());
}
function openDrawer(){$('cartDrawer').classList.add('open');$('overlay').classList.add('open');document.body.classList.add('no-scroll')}
function closeDrawer(){$('cartDrawer').classList.remove('open');$('overlay').classList.remove('open');document.body.classList.remove('no-scroll')}
function openProduct(id){const p=products.find(x=>x.id===id);if(!p)return;currentProductId=p.id;$('modalProductImage').innerHTML=visual(p);$('modalProductType').textContent=p.type||'Med';$('modalProductName').textContent=p.name;$('modalProductDescription').textContent=p.description||'';$('modalProductPrice').textContent=money(p.price);$('modalProductWeight').textContent=p.weight||'';$('modalProductStock').textContent=p.stock>0?`Skladom ${p.stock} ks`:'Vypredané';$('modalAddToCart').disabled=p.stock<=0;$('productModal').classList.remove('hidden');document.body.classList.add('no-scroll')}
window.openProduct=openProduct;
function closeModal(id){$(id).classList.add('hidden');document.body.classList.remove('no-scroll')}
$('modalAddToCart').onclick=()=>{if(currentProductId){addToCart(currentProductId);closeModal('productModal');openDrawer()}};
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$('openCart').onclick=openDrawer;$('closeCart').onclick=closeDrawer;$('overlay').onclick=closeDrawer;
$('checkoutBtn').onclick=async()=>{
 if(location.hostname.endsWith('.github.io')){location.assign('https://medlovekivon.netlify.app/');return}
 if(!cart.length){toast('Košík je prázdny.');return}
 closeDrawer();$('checkoutModal').classList.remove('hidden');document.body.classList.add('no-scroll');
 updateCheckoutInfo();await checkBackendStatus();updateCheckoutInfo();
};
async function checkBackendStatus(){
 backendStatus={available:false,card:false};
 if(!cfg.apiBaseUrl||cfg.apiBaseUrl.includes('REPLACE_WITH_RENDER_URL'))return backendStatus;
 try{
  const ctrl=new AbortController();const timer=setTimeout(()=>ctrl.abort(),12000);
  try{
   const r=await fetch(cfg.apiBaseUrl.replace(/\/$/,'')+'/api/health',{signal:ctrl.signal});
   if(r.ok){const d=await r.json();backendStatus={available:!!d.ok,card:!!d.stripeConfigured}}
  }finally{clearTimeout(timer)}
 }catch(err){console.warn('Backend sa nepodarilo overiť:',err.message)}
 return backendStatus;
}

function updateCheckoutInfo(){
 const local=$('orderDelivery').value==='local',eligible=qty()>=Math.max(1,Number(settings.free_delivery_qty)||3);
 const cardOption=$('orderPayment').querySelector('option[value="card"]');
 cardOption.disabled=!backendStatus.card;
 if(!backendStatus.card && $('orderPayment').value==='card')$('orderPayment').value='cash';
 $('orderAddress').required=local;$('orderEmail').required=$('orderPayment').value==='card';
 $('checkoutNotice').textContent=!backendStatus.available
 ? 'Objednávkový server nie je dostupný. Skontroluj adresu Render služby alebo počkaj na jej spustenie.'
 :local&&!eligible
 ? `Lokálny dovoz je dostupný od ${settings.free_delivery_qty} ks. Pridaj med alebo zvoľ osobný odber.`
 :!backendStatus.card
 ? 'Platba kartou ešte nie je aktivovaná. Aktuálne je dostupná hotovosť pri prevzatí.'
 :'Pri platbe kartou budeš presmerovaný na zabezpečenú stránku Stripe.';
}
$('orderDelivery').onchange=updateCheckoutInfo;$('orderPayment').onchange=updateCheckoutInfo;
$('checkoutForm').onsubmit=async e=>{
 e.preventDefault();
 if(location.hostname.endsWith('.github.io')){location.assign('https://medlovekivon.netlify.app/');return}const delivery=$('orderDelivery').value,payment=$('orderPayment').value;
 if(delivery==='local'&&qty()<Math.max(1,Number(settings.free_delivery_qty)||3)){toast('Lokálny dovoz zdarma platí od '+settings.free_delivery_qty+' ks.');return}
 if(payment==='card'&&!$('orderEmail').value.trim()){toast('Pri platbe kartou zadaj e-mail.');return}
 if(!backendStatus.available){toast('Objednávkový server nie je dostupný. Skontroluj Render.');return}
 if(payment==='card'&&!backendStatus.card){toast('Online platba ešte nie je aktivovaná.');return}
 const submit=$('checkoutForm').querySelector('button[type="submit"]');submit.disabled=true;submit.textContent='Spracováva sa...';
 try{
  const response=await fetch(cfg.apiBaseUrl.replace(/\/$/,'')+'/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customer_name:$('orderName').value.trim(),phone:$('orderPhone').value.trim(),email:$('orderEmail').value.trim(),delivery_type:delivery,payment_type:payment,delivery_address:$('orderAddress').value.trim(),note:$('orderNote').value.trim(),items:cart.map(x=>({product_id:x.id,qty:x.qty}))})});
  const result=await response.json();if(!response.ok)throw Error(result.error||'Objednávku sa nepodarilo vytvoriť.');
  if(payment==='card'&&!result.checkout_url)throw Error('Chýba platobná adresa. Kontaktuj predajcu.');
  cart=[];saveCart();closeModal('checkoutModal');e.target.reset();
  if(payment==='card'){location.assign(result.checkout_url);return}
  location.assign('objednavka-prijata.html?order='+encodeURIComponent(result.order_code));
 }catch(err){console.error(err);toast(err.message||'Objednávku sa nepodarilo odoslať.');}
 finally{submit.disabled=false;submit.textContent='Objednať s povinnosťou platby'}
};
$('productSearch').oninput=renderProducts;$('sortSelect').onchange=renderProducts;
$('mobileMenu').onclick=()=>{const open=$('mainNav').classList.toggle('open');$('mobileMenu').setAttribute('aria-expanded',String(open))};$('mainNav').querySelectorAll('a').forEach(a=>a.onclick=()=>{$('mainNav').classList.remove('open');$('mobileMenu').setAttribute('aria-expanded','false')});$('closeAnnouncement').onclick=()=>$('topNote').classList.add('hidden');
applySettings();renderCart();loadStore().then(()=>{if(location.hostname.endsWith('.github.io')){$('topNote').classList.remove('hidden');$('announcementText').textContent='Toto je ukážka Medlove na GitHub Pages. Objednávky vybavíš na hlavnom webe medlovekivon.netlify.app.';$('checkoutBtn').textContent='Objednať na hlavnom webe';}});
