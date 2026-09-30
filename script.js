const KEYS={products:"medlove_products",orders:"medlove_orders",settings:"medlove_settings",cart:"medlove_cart"};

const DEFAULT_PRODUCTS=[
{id:1,name:"Kvetový med",type:"Med",price:10,stock:18,weight:"950 g",image:"🌸",description:"Jemná chuť a vôňa lúčnych kvetov. Poctivý med vhodný na každodenné použitie.",active:true,featured:true,order:1},
{id:2,name:"Agátový med",type:"Med",price:10,stock:14,weight:"950 g",image:"🌼",description:"Svetlý, jemný a veľmi lahodný med s príjemnou chuťou.",active:true,featured:true,order:2},
{id:3,name:"Pastovaný med",type:"Med",price:10,stock:10,weight:"950 g",image:"🍯",description:"Krémový a lahodný med s jemnou konzistenciou, ktorá sa výborne natiera.",active:true,featured:true,order:3},
{id:4,name:"Medovicový med",type:"Med",price:11,stock:8,weight:"950 g",image:"🌲",description:"Výrazná chuť lesnej medovice a tmavšia farba pre milovníkov plnšieho medu.",active:true,featured:true,order:4}
];

const DEFAULT_SETTINGS={
shopName:"Medlove",
subtitle:"Včelia farma Slnečná",
heroTitle:"Poctivý med priamo od včelára.",
heroText:"Čerstvý slovenský med z rodinnej včelej farmy s dôrazom na prírodu, kvalitu a poctivosť.",
phone:"0908 356 858",
address:"Likavka 290",
facebook:"Včelia Farma Slnečná",
deliveryArea:"Ružomberok a blízke okolie",
freeDeliveryQty:3,
announcement:"🚚 Pri odbere od 3 ks dovoz do Ružomberka a blízkeho okolia zdarma.",
announcementActive:true,
aboutTitle:"Príroda. Kvalita. Poctivosť.",
aboutText:"Medlove je rodinná včelia farma z Likavky. Našou prioritou je poctivá starostlivosť o včely, lokálny pôvod a kvalitný med, ktorý putuje priamo od včelára k zákazníkovi.",
footerText:"Poctivý slovenský med z Likavky priamo od včelára."
};

function init(){
  if(!localStorage.getItem(KEYS.products))localStorage.setItem(KEYS.products,JSON.stringify(DEFAULT_PRODUCTS));
  if(!localStorage.getItem(KEYS.orders))localStorage.setItem(KEYS.orders,"[]");
  if(!localStorage.getItem(KEYS.settings))localStorage.setItem(KEYS.settings,JSON.stringify(DEFAULT_SETTINGS));
}
init();

const $=id=>document.getElementById(id);
const getProducts=()=>JSON.parse(localStorage.getItem(KEYS.products)||"[]");
const getOrders=()=>JSON.parse(localStorage.getItem(KEYS.orders)||"[]");
const getSettings=()=>({...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(KEYS.settings)||"{}")});
const money=v=>Number(v).toLocaleString("sk-SK",{style:"currency",currency:"EUR"});
let cart=JSON.parse(localStorage.getItem(KEYS.cart)||"[]");
let currentProduct=null;

function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function escapeAttr(v){return escapeHtml(v).replace(/`/g,"&#96;")}
function visual(p){
  if(p.image && /^https?:\/\//i.test(p.image))return `<img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.name)}">`;
  return escapeHtml(p.image||"🍯");
}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}

function applySettings(){
  const s=getSettings();
  document.title=`${s.shopName} • ${s.subtitle}`;
  $("brandName").textContent=s.shopName;
  $("brandSubtitle").textContent=s.subtitle;
  $("heroTitle").textContent=s.heroTitle;
  $("heroText").textContent=s.heroText;
  $("aboutTitle").textContent=s.aboutTitle;
  $("aboutText").textContent=s.aboutText;
  $("contactPhone").textContent=s.phone;
  $("contactAddress").textContent=s.address;
  $("contactFacebook").textContent=s.facebook;
  $("footerBrand").textContent=s.shopName;
  $("footerText").textContent=s.footerText;
  $("deliveryText").textContent=`Platí pre ${s.deliveryArea}. Pri inom mieste sa s nami dohodni telefonicky.`;
  $("announcementText").textContent=s.announcement;
  $("topNote").classList.toggle("hidden",!s.announcementActive);
  $("copyright").textContent=`© ${new Date().getFullYear()} ${s.shopName} – ${s.subtitle}`;
}
applySettings();

function filteredProducts(){
  let list=getProducts().filter(p=>p.active);
  const q=$("productSearch").value.trim().toLowerCase();
  if(q)list=list.filter(p=>`${p.name} ${p.description} ${p.type}`.toLowerCase().includes(q));
  const sort=$("sortSelect").value;
  if(sort==="price-asc")list.sort((a,b)=>a.price-b.price);
  else if(sort==="price-desc")list.sort((a,b)=>b.price-a.price);
  else if(sort==="name")list.sort((a,b)=>a.name.localeCompare(b.name,"sk"));
  else list.sort((a,b)=>(b.featured-a.featured)||(a.order-b.order));
  return list;
}

function stockLabel(p){
  if(p.stock<=0)return `<span class="stock out">Vypredané</span>`;
  if(p.stock<=5)return `<span class="stock low">Posledné ${p.stock} ks</span>`;
  return `<span class="stock">Skladom</span>`;
}

function renderProducts(){
  const list=filteredProducts();
  $("emptyState").classList.toggle("hidden",list.length>0);
  $("productGrid").innerHTML=list.map(p=>`
    <article class="product-card ${p.featured?"featured":""}">
      <div class="product-image">${visual(p)}</div>
      <div class="product-body">
        <div class="product-top"><span class="product-type">${escapeHtml(p.type||"Med")}</span>${stockLabel(p)}</div>
        <h3>${escapeHtml(p.name)}</h3>
        <p>${escapeHtml(p.description||"")}</p>
        <div class="product-bottom">
          <div class="price"><b>${money(p.price)}</b><small>${escapeHtml(p.weight||"")}</small></div>
          <div class="product-actions">
            <button class="mini-btn" onclick="openProduct(${p.id})">↗</button>
            <button class="add-btn" onclick="addToCart(${p.id})" ${p.stock<=0?"disabled":""}>Pridať</button>
          </div>
        </div>
      </div>
    </article>`).join("");
}

function addToCart(id){
  const p=getProducts().find(x=>x.id===id);if(!p||p.stock<=0)return;
  let item=cart.find(x=>x.id===id);
  const qty=item?item.qty:0;
  if(qty>=p.stock){toast("Viac kusov momentálne nie je na sklade.");return}
  if(item)item.qty++;else cart.push({id:p.id,name:p.name,price:p.price,qty:1,image:p.image});
  saveCart();toast(`${p.name} pridaný do košíka`);
}
window.addToCart=addToCart;

function saveCart(){localStorage.setItem(KEYS.cart,JSON.stringify(cart));renderCart()}
function cartQty(){return cart.reduce((s,x)=>s+x.qty,0)}
function cartSubtotal(){return cart.reduce((s,x)=>s+x.qty*x.price,0)}

function changeQty(id,delta){
  const item=cart.find(x=>x.id===id);if(!item)return;
  const p=getProducts().find(x=>x.id===id);
  item.qty+=delta;
  if(item.qty<=0)cart=cart.filter(x=>x.id!==id);
  else if(p&&item.qty>p.stock){item.qty=p.stock;toast("Dosiahnutý dostupný sklad.");}
  saveCart();
}
function removeItem(id){cart=cart.filter(x=>x.id!==id);saveCart()}
window.changeQty=changeQty;window.removeItem=removeItem;

function deliveryCost(){
  if(!$("orderDelivery"))return 0;
  const mode=$("orderDelivery").value;
  const s=getSettings();
  if(mode==="pickup")return 0;
  if(mode==="local")return cartQty()>=Number(s.freeDeliveryQty)?0:4;
  return 0;
}

function renderCart(){
  const s=getSettings();
  $("cartCount").textContent=cartQty();
  $("cartItems").innerHTML=cart.length?cart.map(i=>`
    <div class="cart-item">
      <div class="cart-thumb">${i.image&&/^https?:\/\//i.test(i.image)?`<img src="${escapeAttr(i.image)}">`:escapeHtml(i.image||"🍯")}</div>
      <div>
        <h4>${escapeHtml(i.name)}</h4>
        <small>${money(i.price)} / ks</small>
        <div class="qty"><button onclick="changeQty(${i.id},-1)">−</button><b>${i.qty}</b><button onclick="changeQty(${i.id},1)">+</button></div>
      </div>
      <button class="remove" onclick="removeItem(${i.id})">Odstrániť</button>
    </div>`).join(""):`<div class="empty-state"><span>🛒</span><h3>Košík je prázdny</h3><p>Vyber si svoj obľúbený med.</p></div>`;

  const needed=Math.max(0,Number(s.freeDeliveryQty)-cartQty());
  const progress=Math.min(100,(cartQty()/Number(s.freeDeliveryQty))*100);
  $("freeDeliveryProgress").style.width=progress+"%";
  $("freeDeliveryText").textContent=cartQty()>=Number(s.freeDeliveryQty)?"Lokálny dovoz do "+s.deliveryArea+" máte zdarma 🎉":`Pridaj ešte ${needed} ks a lokálny dovoz bude zdarma.`;

  $("cartSubtotal").textContent=money(cartSubtotal());
  $("cartTotal").textContent=money(cartSubtotal());
  $("checkoutTotal").textContent=money(cartSubtotal()+deliveryCost());
}

function openDrawer(){$("cartDrawer").classList.add("open");$("overlay").classList.add("open");document.body.classList.add("no-scroll")}
function closeDrawer(){$("cartDrawer").classList.remove("open");$("overlay").classList.remove("open");document.body.classList.remove("no-scroll")}

function openProduct(id){
  const p=getProducts().find(x=>x.id===id);if(!p)return;
  currentProduct=p;
  $("modalProductImage").innerHTML=visual(p);
  $("modalProductType").textContent=p.type||"Med";
  $("modalProductName").textContent=p.name;
  $("modalProductDescription").textContent=p.description||"";
  $("modalProductPrice").textContent=money(p.price);
  $("modalProductWeight").textContent=p.weight||"";
  $("modalProductStock").textContent=p.stock>0?`Skladom ${p.stock} ks`:"Momentálne vypredané";
  $("modalAddToCart").disabled=p.stock<=0;
  $("productModal").classList.remove("hidden");
  document.body.classList.add("no-scroll");
}
window.openProduct=openProduct;

function closeModal(id){$(id).classList.add("hidden");document.body.classList.remove("no-scroll")}

$("modalAddToCart").onclick=()=>{if(currentProduct){addToCart(currentProduct.id);closeModal("productModal");openDrawer()}};
document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
$("openCart").onclick=openDrawer;$("closeCart").onclick=closeDrawer;$("overlay").onclick=closeDrawer;
$("checkoutBtn").onclick=()=>{if(!cart.length)return toast("Košík je prázdny.");closeDrawer();$("checkoutModal").classList.remove("hidden");document.body.classList.add("no-scroll");renderCart()};
$("orderDelivery").onchange=renderCart;

$("checkoutForm").onsubmit=e=>{
  e.preventDefault();if(!cart.length)return;
  const orders=getOrders();const delivery=deliveryCost();
  const order={
    id:"MED-"+Date.now().toString().slice(-7),
    customer:$("orderName").value.trim(),
    phone:$("orderPhone").value.trim(),
    email:$("orderEmail").value.trim(),
    delivery:$("orderDelivery").value,
    payment:$("orderPayment").value,
    address:$("orderAddress").value.trim(),
    note:$("orderNote").value.trim(),
    subtotal:cartSubtotal(),
    deliveryCost:delivery,
    total:cartSubtotal()+delivery,
    qty:cartQty(),
    date:new Date().toLocaleString("sk-SK"),
    status:"new",
    items:cart.map(x=>({...x}))
  };
  orders.unshift(order);localStorage.setItem(KEYS.orders,JSON.stringify(orders));
  const products=getProducts();
  cart.forEach(i=>{const p=products.find(x=>x.id===i.id);if(p)p.stock=Math.max(0,p.stock-i.qty)});
  localStorage.setItem(KEYS.products,JSON.stringify(products));
  cart=[];saveCart();renderProducts();e.target.reset();closeModal("checkoutModal");toast(`Objednávka ${order.id} bola vytvorená.`);
};

$("productSearch").oninput=renderProducts;$("sortSelect").onchange=renderProducts;
$("mobileMenu").onclick=()=>$("mainNav").classList.toggle("open");
$("mainNav").querySelectorAll("a").forEach(a=>a.onclick=()=>$("mainNav").classList.remove("open"));
$("closeAnnouncement").onclick=()=>$("topNote").classList.add("hidden");

renderProducts();renderCart();