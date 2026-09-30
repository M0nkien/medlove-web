const KEYS={products:"medlove_products",orders:"medlove_orders",settings:"medlove_settings"};
const EMAIL="admin@medlove.sk",PASSWORD="med123";

const DEFAULT_PRODUCTS=[
{id:1,name:"Kvetový med",type:"Med",price:10,stock:18,weight:"950 g",image:"🌸",description:"Jemná chuť a vôňa lúčnych kvetov. Poctivý med vhodný na každodenné použitie.",active:true,featured:true,order:1},
{id:2,name:"Agátový med",type:"Med",price:10,stock:14,weight:"950 g",image:"🌼",description:"Svetlý, jemný a veľmi lahodný med s príjemnou chuťou.",active:true,featured:true,order:2},
{id:3,name:"Pastovaný med",type:"Med",price:10,stock:10,weight:"950 g",image:"🍯",description:"Krémový a lahodný med s jemnou konzistenciou, ktorá sa výborne natiera.",active:true,featured:true,order:3},
{id:4,name:"Medovicový med",type:"Med",price:11,stock:8,weight:"950 g",image:"🌲",description:"Výrazná chuť lesnej medovice a tmavšia farba pre milovníkov plnšieho medu.",active:true,featured:true,order:4}
];

const DEFAULT_ORDERS=[
{id:"MED-1003",customer:"Ján Novák",phone:"0900 111 222",email:"jan@example.sk",delivery:"local",payment:"cash",address:"Ružomberok",note:"",subtotal:30,deliveryCost:0,total:30,qty:3,date:"29. 9. 2026 18:25",status:"new",items:[{id:1,name:"Kvetový med",price:10,qty:1},{id:2,name:"Agátový med",price:10,qty:1},{id:3,name:"Pastovaný med",price:10,qty:1}]},
{id:"MED-1002",customer:"Anna Malá",phone:"0905 333 444",email:"anna@example.sk",delivery:"pickup",payment:"cash",address:"",note:"Vyzdvihnem po 16:00",subtotal:22,deliveryCost:0,total:22,qty:2,date:"28. 9. 2026 12:10",status:"ready",items:[{id:4,name:"Medovicový med",price:11,qty:2}]}
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
 if(!localStorage.getItem(KEYS.orders))localStorage.setItem(KEYS.orders,JSON.stringify(DEFAULT_ORDERS));
 if(!localStorage.getItem(KEYS.settings))localStorage.setItem(KEYS.settings,JSON.stringify(DEFAULT_SETTINGS));
}
init();

const $=id=>document.getElementById(id);
const getProducts=()=>JSON.parse(localStorage.getItem(KEYS.products)||"[]");
const setProducts=v=>localStorage.setItem(KEYS.products,JSON.stringify(v));
const getOrders=()=>JSON.parse(localStorage.getItem(KEYS.orders)||"[]");
const setOrders=v=>localStorage.setItem(KEYS.orders,JSON.stringify(v));
const getSettings=()=>({...DEFAULT_SETTINGS,...JSON.parse(localStorage.getItem(KEYS.settings)||"{}")});
const setSettings=v=>localStorage.setItem(KEYS.settings,JSON.stringify(v));
const money=v=>Number(v).toLocaleString("sk-SK",{style:"currency",currency:"EUR"});
function escapeHtml(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");setTimeout(()=>t.classList.remove("show"),2200)}

function showApp(){$("loginScreen").classList.add("hidden");$("adminApp").classList.remove("hidden");renderAll()}
if(sessionStorage.getItem("medlove_admin")==="1")showApp();

$("loginForm").onsubmit=e=>{
 e.preventDefault();
 if($("adminEmail").value===EMAIL&&$("adminPassword").value===PASSWORD){sessionStorage.setItem("medlove_admin","1");showApp()}
 else toast("Nesprávny e-mail alebo heslo.");
};
$("logoutBtn").onclick=()=>{sessionStorage.removeItem("medlove_admin");location.reload()};

function switchPage(id){
 document.querySelectorAll(".admin-tab").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
 document.querySelectorAll(".admin-page").forEach(p=>p.classList.toggle("active",p.id===id));
 window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll(".admin-tab").forEach(b=>b.onclick=()=>switchPage(b.dataset.page));
document.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>switchPage(b.dataset.jump));

function statusPill(s){
 const names={new:"Nová",processing:"Spracováva sa",ready:"Pripravená",done:"Vybavená",cancelled:"Zrušená"};
 return `<span class="status-pill status-${s}">${names[s]||s}</span>`;
}

function renderAll(){
 const p=getProducts(),o=getOrders(),s=getSettings();
 $("adminBrandName").textContent=s.shopName;
 $("productCountSide").textContent=p.length;
 $("orderCountSide").textContent=o.filter(x=>x.status==="new").length;
 renderDashboard();renderProducts();renderOrders();renderStock();loadSettings();
}

function renderDashboard(){
 const p=getProducts(),o=getOrders();
 $("statProducts").textContent=p.length;
 $("statOrders").textContent=o.length;
 $("statNew").textContent=o.filter(x=>x.status==="new").length;
 $("statRevenue").textContent=money(o.filter(x=>x.status!=="cancelled").reduce((sum,x)=>sum+Number(x.total||0),0));
 $("dashboardOrders").innerHTML=o.slice(0,5).map(x=>`<tr><td><b>${x.id}</b></td><td>${escapeHtml(x.customer)}</td><td>${money(x.total)}</td><td>${statusPill(x.status)}</td></tr>`).join("")||`<tr><td colspan="4">Žiadne objednávky.</td></tr>`;
 const low=p.filter(x=>x.stock<=5).sort((a,b)=>a.stock-b.stock);
 $("lowStockList").innerHTML=low.length?low.map(x=>`<div class="low-stock-item"><div><b>${escapeHtml(x.name)}</b><small>${escapeHtml(x.weight||"")}</small></div><span class="low-stock-value">${x.stock} ks</span></div>`).join(""):`<p class="demo-note">Zásoby sú v poriadku.</p>`;
}

function renderProducts(){
 let list=getProducts();
 const q=$("adminProductSearch").value.trim().toLowerCase(),filter=$("adminProductFilter").value;
 if(q)list=list.filter(x=>`${x.name} ${x.type}`.toLowerCase().includes(q));
 if(filter==="active")list=list.filter(x=>x.active);
 if(filter==="inactive")list=list.filter(x=>!x.active);
 if(filter==="low")list=list.filter(x=>x.stock<=5);
 list.sort((a,b)=>a.order-b.order);
 $("productsTable").innerHTML=list.map(x=>`<tr>
 <td><b>${escapeHtml(x.image||"🍯")} ${escapeHtml(x.name)}</b><br><small>${escapeHtml(x.type||"Med")}${x.featured?" • Obľúbené":""}</small></td>
 <td>${money(x.price)}</td><td>${escapeHtml(x.weight||"")}</td>
 <td>${x.stock<=5?`<span class="low-stock-value">${x.stock} ks</span>`:`${x.stock} ks`}</td>
 <td><span class="product-state ${x.active?"active":"inactive"}">${x.active?"Aktívny":"Skrytý"}</span></td>
 <td class="actions"><button class="icon-btn" onclick="editProduct(${x.id})">✏️</button><button class="icon-btn" onclick="toggleProduct(${x.id})">${x.active?"👁️":"🙈"}</button><button class="icon-btn" onclick="duplicateProduct(${x.id})">⧉</button><button class="icon-btn" onclick="deleteProduct(${x.id})">🗑️</button></td>
 </tr>`).join("")||`<tr><td colspan="6">Žiadne produkty.</td></tr>`;
}
$("adminProductSearch").oninput=renderProducts;$("adminProductFilter").onchange=renderProducts;

function openNewProduct(){
 $("productModalTitle").textContent="Pridať produkt";$("productForm").reset();$("productId").value="";$("productType").value="Med";$("productWeight").value="950 g";$("productActive").checked=true;$("productFeatured").checked=false;$("productOrder").value=getProducts().length+1;$("adminProductModal").classList.remove("hidden");document.body.classList.add("no-scroll");
}
$("addProductBtn").onclick=openNewProduct;

function editProduct(id){
 const x=getProducts().find(p=>p.id===id);if(!x)return;
 $("productModalTitle").textContent="Upraviť produkt";$("productId").value=x.id;$("productName").value=x.name;$("productType").value=x.type||"Med";$("productPrice").value=x.price;$("productStock").value=x.stock;$("productWeight").value=x.weight||"";$("productImage").value=x.image||"";$("productDescription").value=x.description||"";$("productOrder").value=x.order||0;$("productFeatured").checked=!!x.featured;$("productActive").checked=!!x.active;$("adminProductModal").classList.remove("hidden");document.body.classList.add("no-scroll");
}
window.editProduct=editProduct;

$("productForm").onsubmit=e=>{
 e.preventDefault();const list=getProducts(),id=$("productId").value;
 const item={id:id?Number(id):Date.now(),name:$("productName").value.trim(),type:$("productType").value.trim()||"Med",price:Number($("productPrice").value),stock:Number($("productStock").value),weight:$("productWeight").value.trim(),image:$("productImage").value.trim()||"🍯",description:$("productDescription").value.trim(),order:Number($("productOrder").value)||0,featured:$("productFeatured").checked,active:$("productActive").checked};
 if(id){const i=list.findIndex(x=>x.id===Number(id));if(i>=0)list[i]=item}else list.push(item);
 setProducts(list);closeModal("adminProductModal");renderAll();toast("Produkt bol uložený.");
};

function toggleProduct(id){const p=getProducts(),x=p.find(a=>a.id===id);if(x)x.active=!x.active;setProducts(p);renderAll()}
function duplicateProduct(id){const p=getProducts(),x=p.find(a=>a.id===id);if(!x)return;p.push({...x,id:Date.now(),name:x.name+" – kópia",order:p.length+1});setProducts(p);renderAll();toast("Produkt bol duplikovaný.")}
function deleteProduct(id){if(!confirm("Naozaj odstrániť produkt?"))return;setProducts(getProducts().filter(x=>x.id!==id));renderAll();toast("Produkt bol odstránený.")}
window.toggleProduct=toggleProduct;window.duplicateProduct=duplicateProduct;window.deleteProduct=deleteProduct;

function renderOrders(){
 let list=getOrders();const q=$("orderSearch").value.trim().toLowerCase(),filter=$("orderFilter").value;
 if(q)list=list.filter(x=>`${x.id} ${x.customer} ${x.phone}`.toLowerCase().includes(q));
 if(filter!=="all")list=list.filter(x=>x.status===filter);
 const deliveryName={pickup:"Osobný odber",local:"Lokálny dovoz",other:"Dohoda"};
 $("ordersTable").innerHTML=list.map(x=>`<tr>
 <td><b>${x.id}</b></td><td>${escapeHtml(x.customer)}<br><small>${escapeHtml(x.phone||"")}</small></td><td>${money(x.total)}</td><td>${escapeHtml(x.date||"")}</td><td>${deliveryName[x.delivery]||x.delivery}</td>
 <td><select onchange="changeStatus('${x.id}',this.value)"><option value="new" ${x.status==="new"?"selected":""}>Nová</option><option value="processing" ${x.status==="processing"?"selected":""}>Spracováva sa</option><option value="ready" ${x.status==="ready"?"selected":""}>Pripravená</option><option value="done" ${x.status==="done"?"selected":""}>Vybavená</option><option value="cancelled" ${x.status==="cancelled"?"selected":""}>Zrušená</option></select></td>
 <td><button class="icon-btn" onclick="openOrder('${x.id}')">Detail</button></td></tr>`).join("")||`<tr><td colspan="7">Žiadne objednávky.</td></tr>`;
}
$("orderSearch").oninput=renderOrders;$("orderFilter").onchange=renderOrders;

function changeStatus(id,status){const o=getOrders(),x=o.find(a=>a.id===id);if(x)x.status=status;setOrders(o);renderAll();toast("Stav objednávky bol zmenený.")}
window.changeStatus=changeStatus;

function openOrder(id){
 const x=getOrders().find(a=>a.id===id);if(!x)return;
 const deliveryName={pickup:"Osobný odber",local:"Lokálny dovoz",other:"Dohoda"};
 $("orderDetailTitle").textContent=x.id;
 $("orderDetailContent").innerHTML=`<div class="order-detail-grid">
 <div class="order-box"><h4>Zákazník</h4><p><b>${escapeHtml(x.customer)}</b></p><p>${escapeHtml(x.phone||"")}</p><p>${escapeHtml(x.email||"")}</p></div>
 <div class="order-box"><h4>Prevzatie</h4><p>${deliveryName[x.delivery]||x.delivery}</p><p>${escapeHtml(x.address||"")}</p><p>Platba: ${x.payment==="transfer"?"Bankový prevod":"Hotovosť"}</p></div>
 </div>
 <div class="order-box" style="margin-top:12px"><h4>Poznámka</h4><p>${escapeHtml(x.note||"Bez poznámky")}</p></div>
 <div style="margin-top:18px"><h4>Položky</h4>${(x.items||[]).map(i=>`<div class="order-line"><span>${i.qty} × ${escapeHtml(i.name)}</span><b>${money(i.price*i.qty)}</b></div>`).join("")}<div class="order-total"><span>Spolu</span><span>${money(x.total)}</span></div></div>`;
 $("orderDetailModal").classList.remove("hidden");document.body.classList.add("no-scroll");
}
window.openOrder=openOrder;

function renderStock(){
 const p=getProducts().sort((a,b)=>a.stock-b.stock);
 $("stockGrid").innerHTML=p.map(x=>`<article class="stock-card"><div class="stock-card-head"><div><h3>${escapeHtml(x.name)}</h3><small>${escapeHtml(x.weight||"")}</small></div><b class="${x.stock<=5?"low-stock-value":""}">${x.stock} ks</b></div><div class="stock-control"><input id="stock-${x.id}" type="number" min="0" value="${x.stock}"><button class="btn btn-primary" onclick="saveStock(${x.id})">Uložiť</button></div></article>`).join("");
}
function saveStock(id){const p=getProducts(),x=p.find(a=>a.id===id);if(!x)return;x.stock=Math.max(0,Number(document.getElementById("stock-"+id).value)||0);setProducts(p);renderAll();toast("Sklad bol upravený.")}
window.saveStock=saveStock;

function loadSettings(){
 const s=getSettings();
 $("setShopName").value=s.shopName;$("setSubtitle").value=s.subtitle;$("setHeroTitle").value=s.heroTitle;$("setHeroText").value=s.heroText;$("setPhone").value=s.phone;$("setAddress").value=s.address;$("setFacebook").value=s.facebook;$("setDeliveryArea").value=s.deliveryArea;$("setAboutTitle").value=s.aboutTitle;$("setAboutText").value=s.aboutText;$("setFooterText").value=s.footerText;$("setFreeDeliveryQty").value=s.freeDeliveryQty;$("setAnnouncement").value=s.announcement;$("setAnnouncementActive").checked=!!s.announcementActive;
}
$("settingsForm").onsubmit=e=>{
 e.preventDefault();
 setSettings({shopName:$("setShopName").value.trim(),subtitle:$("setSubtitle").value.trim(),heroTitle:$("setHeroTitle").value.trim(),heroText:$("setHeroText").value.trim(),phone:$("setPhone").value.trim(),address:$("setAddress").value.trim(),facebook:$("setFacebook").value.trim(),deliveryArea:$("setDeliveryArea").value.trim(),aboutTitle:$("setAboutTitle").value.trim(),aboutText:$("setAboutText").value.trim(),footerText:$("setFooterText").value.trim(),freeDeliveryQty:Number($("setFreeDeliveryQty").value)||3,announcement:$("setAnnouncement").value.trim(),announcementActive:$("setAnnouncementActive").checked});
 renderAll();toast("Nastavenia boli uložené.");
};

$("exportBtn").onclick=()=>{
 const data={exportedAt:new Date().toISOString(),products:getProducts(),orders:getOrders(),settings:getSettings()};
 const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`medlove-zaloha-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);toast("Záloha bola pripravená.");
};
$("resetBtn").onclick=()=>{if(!confirm("Obnoviť pôvodné demo dáta?"))return;setProducts(DEFAULT_PRODUCTS);setOrders(DEFAULT_ORDERS);setSettings(DEFAULT_SETTINGS);renderAll();toast("Demo dáta obnovené.");};

document.querySelectorAll("[data-close]").forEach(b=>b.onclick=()=>closeModal(b.dataset.close));
function closeModal(id){$(id).classList.add("hidden");document.body.classList.remove("no-scroll")}
