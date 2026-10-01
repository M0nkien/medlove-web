**Presný návod nasadenia:** pozri [`NASADENIE-KROK-ZA-KROKOM.md`](NASADENIE-KROK-ZA-KROKOM.md).

**V6 úpravy:** kontrola dostupnosti Render API pred dokončením objednávky; vypnutá platba kartou, ak Stripe ešte nie je aktívny; košík sa pri chýbajúcej Stripe URL nevymaže; aktualizovaný health check, dokumentácia a SEO metadáta.

# Medlove V6 – web + admin + Supabase + Render + Stripe Checkout

## Čo je už pripravené
- Autentická fotka štyroch medov v úvode + predbežné výrezy produktov v `public/assets/`.
- Verejný e-shop načítava aktuálne produkty a nastavenia priamo z existujúceho Supabase projektu Medlove.
- Admin používa Supabase Auth a existujúce `admins` + RLS, spravuje produkty, fotografie (Supabase Storage), sklad, objednávky a texty.
- Košík zostáva v `localStorage`, objednávku a cenu vytvára iba server cez databázovú transakciu.
- Render server vie vytvoriť objednávku s hotovosťou alebo Stripe Checkout a overuje podpísaný webhook, platbu a sumu.
- Databázová migrácia `sql/001_medlove_v5.sql` bola aplikovaná na existujúci projekt Medlove. **Nespúšťaj pôvodný zakladací SQL znova.**
- Produkty a ceny z existujúceho Supabase projektu zostali zachované. Skladové množstvá sú stále pracovné, potvrď ich s majiteľom.

## 1. GitHub
Vytvor samostatný repozitár Medlove, napr. `medlove-web`. Nahraj obsah tohto ZIP do koreňa. Súbor `server/.env.example` je iba šablóna; skutočný `.env` necommituj.

```
git init
git add .
git commit -m "Medlove V5 Supabase and Stripe checkout"
git branch -M main
git remote add origin https://github.com/TVOJ-UCET/medlove-web.git
git push -u origin main
```

## 2. Netlify
New project → Import existing project → GitHub → `medlove-web`.
- Build command: prázdny
- Publish directory: `public` (nastavené tiež v `netlify.toml`).
- Testovacia URL bude tvoja skutočná Netlify URL, nepoužívaj ilustračné názvy.

## 3. Supabase
Projekt Medlove už je vytvorený, tabuľky `products`, `orders`, `order_items`, `shop_settings`, `admins` a migrácia V5 sú pripravené. Admin používateľa overíš cez Authentication → Users a priradenie v `public.admins`. `public/config.js` už obsahuje iba *verejnú* adresu a publishable key; tajný kľúč nesmie byť vo frontende.

Obrázky sa dajú nahrávať v admin paneli do verejného bucketu `product-images`; nahrávať môže len autentifikovaný admin.

## 4. Render (nutné pre reálne objednávky)
Vytvor Render **Web Service** z rovnakého GitHub repozitára:
- Root Directory: `server`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Health check path: `/api/health`
- Nastav environment premenné podľa `server/.env.example`:
  `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `FRONTEND_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
- `SUPABASE_SECRET_KEY` získaj zo Supabase backend API keys (service_role/secret), iba v Render Environment. NIKDY nie vo verejných súboroch ani v GitHube.
- `FRONTEND_URL` nastav na presnú produkčnú/testovaciu URL Netlify vrátane `https://`, bez koncového `/`.
- Potom vo `public/config.js` nahraď `apiBaseUrl` skutočnou URL Render služby. Commitni a pushni súbor do GitHubu.
- CORS povoľuje presne `FRONTEND_URL`; ak zmeníš doménu, uprav ju aj v Renderi.

## 5. Stripe (najskôr TEST režim)
V Stripe si majiteľ farmy založí a overí svoj podnikateľský účet. V testovacom režime získaj `sk_test_...` pre Render Environment ako `STRIPE_SECRET_KEY`.

Stripe Dashboard → Developers / Workbench → Webhooks / Event destinations:
- Endpoint: `https://TVOJ-RENDER.onrender.com/api/stripe/webhook`
- Pridaj udalosti `checkout.session.completed` a `checkout.session.expired`.
- Signing secret `whsec_...` vlož do `STRIPE_WEBHOOK_SECRET` iba v Renderi.
- Prípadnú zmenu Stripe test → live musíš urobiť spolu s výmenou kľúča a webhook signing secret. Najprv otestuj v test režime.
- Checkout platbu nikdy neoznačujeme za zaplatenú len pri návrate na `success.html` – rozhoduje overený webhook.
- Ak Stripe nie je nakonfigurovaný, API vráti chybu pre online platbu; hotovosť môže fungovať, keď je Render + Supabase nastavený.

## 6. Kontrola pred ostrým predajom
1. V prehliadači otvor Netlify web; musí načítať 4 produkty zo Supabase.
2. Prihlás sa do admina vlastným Supabase kontom, vyskúšaj zmenu ceny a nahranie fotografie.
3. V Render otvor `/api/health`.
4. Otestuj hotovostnú objednávku; over DB `orders` + `order_items` a sklad.
5. Urob testovaciu Stripe Checkout objednávku a over `payment_status = paid` až po webhoooku.
6. Over prerušenú/expirovanú platbu a vrátenie zásob.
7. Pred spustením s majiteľom potvrď skutočné skladové zásoby, identifikáciu predávajúceho, súhlas s použitím fotky, údaje pre dopravu, obchodné podmienky, GDPR, reklamačný postup, informácie o výrobkoch a doručení, účtovníctvo a príslušné potravinárske požiadavky.

## Dôležité poznámky
- Foto zachytáva štyri poháre; priradenie výrezov k druhom je **predbežné podľa vzhľadu**, preto ho potvrď s výrobcom. Fotografie možno v admine nahradiť samostatnými.
- Platobná možnosť pri prevzatí je aktuálne hotovosť; bankový prevod nebol implementovaný (bez potvrdeného postupu platby).
- Pri lokálnom dovoze aplikácia vyžaduje aspoň nastavený počet kusov, doprava je potom zdarma. Pod tento limit ponúka osobný odber; nevymýšľame cenu dopravy.
- Objednávky platené kartou rezervujú sklad. Ak Stripe relácia vyprší, podpisaný webhook vráti sklad. Nastav a otestuj webhook pred spustením; pre produkciu je vhodné doplniť pravidelnú reconciliáciu neuzavretých platieb.
- API používa kontrolu origin a jednoduchý rate limiter; pred verejným spustením je vhodná ďalšia anti-spam ochrana a monitoring.
- Adminovi záloha JSON umožní export; skutočné obnovenie produkčnej databázy sa robí cez overený backup, nie tlačidlom „reset demo“.

## V6.1 – overenie platby Stripe (2026-10-02)
- Backend kontroluje výsledok funkcie `mark_medlove_order_paid` a pri neúspechu nevracia falošné potvrdenie webhooku.
- `GET /api/orders/:code/payment-status` overuje skutočný Stripe Checkout Session (ID, menu EUR, cenu, väzbu na objednávku) a bezpečne zosúladí `pending → paid`. Endpoint obsahuje rate limit a nikdy nepotvrdzuje platbu iba podľa návratu zákazníka.
- `public/success.html` volá serverové overenie a zobrazuje potvrdený alebo stále čakajúci stav.
- Po nasadení Renderu skontroluj `/api/health` (verzia `6.1.0`), Netlify deploy a staré objednávky otvorením `/success.html?order=KOD`. Neopakuj platbu ani ručne nenastavuj `paid` bez overenia Stripe.
- Webhook v Stripe musí naďalej používať `/api/stripe/webhook` a platný podpisový `whsec_...` kľúč uložený iba v Render Environment.
