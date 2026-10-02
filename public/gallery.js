// Verejná galéria je napojená len na publikované záznamy (Supabase RLS).
(async function(){
 const target=document.getElementById('farmGallery');
 const modal=document.getElementById('galleryLightbox');
 const image=document.getElementById('lightboxPhoto');
 const caption=document.getElementById('lightboxCaption');
 const client=window.supabase.createClient(
  window.MEDLOVE_CONFIG.supabaseUrl,window.MEDLOVE_CONFIG.supabasePublishableKey,
  {auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}}
 );
 const close=()=>{modal.classList.add('hidden');document.body.classList.remove('no-scroll')};
 document.getElementById('closeGalleryLightbox').addEventListener('click',close);
 modal.addEventListener('click',event=>{if(event.target===modal)close()});
 document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!modal.classList.contains('hidden'))close()});
 try{
  const result=await client.from('farm_gallery').select('id,storage_path,caption,category')
   .eq('published',true).order('sort_order',{ascending:true}).order('created_at',{ascending:false}).limit(30);
  if(result.error)throw result.error;
  if(!result.data||!result.data.length)return;
  target.replaceChildren();
  result.data.forEach(item=>{
   if(!/^gallery\/[a-zA-Z0-9._/-]+\.(jpg|png|webp)$/.test(item.storage_path))return;
   const url=client.storage.from('product-images').getPublicUrl(item.storage_path).data.publicUrl;
   const figure=document.createElement('figure');figure.className='farm-gallery-item';
   const button=document.createElement('button');button.type='button';button.className='gallery-photo-button';
   button.setAttribute('aria-label','Zväčšiť fotografiu: '+(item.caption||item.category));
   const photo=document.createElement('img');photo.src=url;photo.alt=item.caption||item.category;photo.loading='lazy';
   button.append(photo);
   const label=document.createElement('figcaption');
   const strong=document.createElement('strong');strong.textContent=item.category;
   const line=document.createElement('span');line.textContent=item.caption||'Včelia farma Slnečná';
   label.append(strong,line);figure.append(button,label);target.append(figure);
   button.addEventListener('click',()=>{
    image.src=url;image.alt=photo.alt;caption.textContent=item.caption||item.category;
    modal.classList.remove('hidden');document.body.classList.add('no-scroll');
    document.getElementById('closeGalleryLightbox').focus();
   });
  });
 }catch(error){console.warn('Fotogalériu sa nepodarilo načítať:',error.message)}
})();
