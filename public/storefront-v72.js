'use strict';
let restockProductId=null;
function renderProductThumbs(product){
 const target=document.getElementById('modalThumbs');target.replaceChildren();
 const photos=[photo(product),...(product.product_photos||[]).sort((a,b)=>a.sort_order-b.sort_order).map(p=>p.image_url)]
  .filter((url,index,list)=>url&&list.indexOf(url)===index);
 if(photos.length<=1)return;
 photos.forEach((url,index)=>{
  const button=document.createElement('button');button.type='button';button.setAttribute('aria-label','Fotografia '+(index+1));
  const image=document.createElement('img');image.src=url;image.alt=product.name+' – fotografia '+(index+1);
  button.append(image);if(index===0)button.classList.add('active');
  button.addEventListener('click',()=>{
   const selected=document.createElement('img');selected.src=url;selected.alt=product.name;
   document.getElementById('modalProductImage').replaceChildren(selected);
   target.querySelectorAll('button').forEach(b=>b.classList.toggle('active',b===button));
  });
  target.append(button);
 });
}
function openRestock(id){
 const p=products.find(item=>item.id===id);
 if(!p||p.stock>0)return;
 if(!backendStatus.restock){toast('E-mailové upozornenia ešte nie sú aktivované.');return}
 restockProductId=id;
 document.getElementById('restockProductName').textContent=p.name;
 document.getElementById('restockModal').classList.remove('hidden');document.body.classList.add('no-scroll');
 document.getElementById('restockEmail').focus();
}
window.openRestock=openRestock;
document.getElementById('modalRestockBtn').addEventListener('click',()=>{
 if(currentProductId){closeModal('productModal');openRestock(currentProductId)}
});
document.getElementById('restockForm').addEventListener('submit',async event=>{
 event.preventDefault();const submit=event.target.querySelector('button[type="submit"]');submit.disabled=true;
 try{
  const response=await fetch(cfg.apiBaseUrl.replace(/\/$/,'')+'/api/restock/subscribe',{
   method:'POST',headers:{'Content-Type':'application/json'},
   body:JSON.stringify({product_id:restockProductId,email:document.getElementById('restockEmail').value.trim(),
    consent:document.getElementById('restockConsent').checked})
  });
  const data=await response.json();if(!response.ok)throw Error(data.error||'Prihlásenie zlyhalo.');
  closeModal('restockModal');event.target.reset();toast('Jednorazové upozornenie bolo prijaté.');
 }catch(error){toast(error.message||'Upozornenie sa nepodarilo aktivovať.')}
 finally{submit.disabled=false}
});
document.getElementById('mobileOpenCart').addEventListener('click',openDrawer);
document.querySelectorAll('[data-mobile-nav]').forEach(link=>link.addEventListener('click',()=>{
 document.querySelectorAll('[data-mobile-nav]').forEach(item=>item.classList.toggle('active',item===link));
}));
if('IntersectionObserver' in window){
 const links=[...document.querySelectorAll('#mainNav a[href^="#"]')];
 const observer=new IntersectionObserver(entries=>{
  entries.forEach(entry=>{
   if(!entry.isIntersecting)return;
   const hash='#'+entry.target.id;
   links.forEach(link=>link.getAttribute('href')===hash?link.setAttribute('aria-current','location'):link.removeAttribute('aria-current'));
   document.querySelectorAll('[data-mobile-nav]').forEach(link=>link.classList.toggle('active',link.getAttribute('href')===hash));
  });
 },{rootMargin:'-18% 0px -65% 0px'});
 ['produkty','farma','galeria','preco','kontakt'].forEach(id=>{
  const node=document.getElementById(id);if(node)observer.observe(node);
 });
}
void checkBackendStatus().then(renderProducts);
