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

## V6.2 – e-mailové notifikácie a príprava ostrého spustenia
- Nové súbory: `server/email.js`, `sql/002_medlove_email.sql` (už aplikované na Supabase), `public/doprava-a-platba.html`, `PRE-SPUSTENIM.md`, interné právne návrhy v `docs/`.
- Zmenené súbory: `server/server.js`, `server/package.json`, `server/.env.example`, `public/index.html` a `public/script.js`.
- Pri hotovostnej objednávke alebo potvrdenej platbe kartou systém pripraví potvrdenie zákazníkovi (ak má e-mail) a upozornenie majiteľovi cez Resend. Doručenie sa eviduje v databáze; výpadok e-mailu nemení úspešný stav objednávky. E-maily sú vypnuté, kým v Render Environment nebudú nastavené všetky 4 premenné vrátane času aktivácie.
- Nasadenie: GitHub main automaticky aktualizuje Netlify a podľa konfigurácie Render; inak Render → Manual Deploy → Deploy latest commit. Pre e-mail vyplň `RESEND_API_KEY`, `EMAIL_FROM`, `ORDER_NOTIFICATION_EMAIL` a `EMAIL_NOTIFICATIONS_FROM` podľa `PRE-SPUSTENIM.md` a urob nový test.
- PRED LIVE: over údaje predávajúceho, etikety, sklad, vlastnú doménu a live Stripe. Návrhy z `docs/` nie sú právne schválené ani verejne prelinkované; nepredstieraj pripravenosť na ostrý predaj.

## V6.3 – dokončenie zákazníckeho nákupu a SEO
- **Nové súbory**: `public/objednavka-prijata.html` (potvrdenie objednávky na hotovosť), `public/favicon.svg`, `public/robots.txt`, `public/sitemap.xml`.
- **Upravené súbory**: `public/index.html`, `public/script.js`, `public/admin.html`, `public/admin.js`, `public/style.css`, `README.md`.
- Hotovostné objednávky sa po úspešnom zápise zobrazia na samostatnej stránke s číslom objednávky a jasným upozornením, že hotovosť ešte nebola zaplatená.
- V admine je filter podľa platby a samostatný stĺpec stavu platby. Nezasahuje do Stripe ani serverových transakcií.
- SEO: canonical URL hlavného obchodu, Open Graph údaje, favicon, sitemap a robots. GitHub Pages zostáva iba ukážka.
- Mobilné ovládanie, klávesnicové zvýraznenie a dopĺňanie údajov v objednávke boli vylepšené.
- Právne texty sa **nezverejnili**: stále potrebujú skutočné údaje prevádzkovateľa a kontrolu. Nezverejňovať obchod na ostrý predaj, kým tieto podklady nie sú hotové.
- Nasadenie: GitHub main; Netlify publish `public`. Testuj osobitne hotovostnú objednávku, stav platieb v admin paneli a mobil.

## V6.4 – bezpečnosť a používateľské vylepšenia
- **Server:** `server/server.js` má hlavičky proti vloženiu stránky do rámca, obmedzenie nepotrebných oprávnení, `no-store` pre údaje objednávok a kontrolu cudzieho Origin na API stavu objednávky. Limit požiadaviek, kontrola ceny a overovanie Stripe ostali zachované.
- **Netlify:** bezpečnostné hlavičky, HSTS, `no-store` a `noindex` pre admin a potvrdzovacie stránky. Pokročilú Content-Security-Policy zatiaľ nezapínaj bez odstránenia zostávajúcich inline obslužných funkcií a ich testovania.
- **Obchod:** poškodený košík v prehliadači už nezablokuje načítanie webu; nové chybové hlásenie umožňuje načítať produkty znova; Escape zatvorí otvorený košík alebo modálne okno; upozornenie pri výpadku pri odoslaní objednávky znižuje riziko duplicitnej objednávky.
- **Admin:** po 30 minútach nečinnosti otvorenej administrácie sa relácia odhlási; prihlásenie má správne autocomplete. Toto nie je náhradou za MFA ani za nastavenie expirácie relácií na strane Supabase.
- **Dizajn:** minimálne rozmery mobilných ovládacích prvkov, podpora reduced motion, prístupnejšie oznamy a stav načítania.
- **Zmenené súbory:** `server/server.js`, `public/script.js`, `public/index.html`, `public/admin.js`, `public/admin.html`, `public/style.css`, `netlify.toml`, `README.md`.
- **Nasadenie:** GitHub `main` → Netlify; Render → Deploy latest commit, ak sa automaticky nenasadí. Overiť `/api/health` verziu `6.4.0`, admin odhlásenie, opätovné načítanie ponuky a kartovú platbu v TEST režime.
- **Zostávajúce bezpečnostné kroky:** Supabase MFA pre admina, rozumné nastavenie relácií, pravidelné databázové zálohy, kontrola závislostí a nasadenie prísnej CSP po refaktoringu inline handlerov.

## V6.5 – ďalšie bezpečnostné sprísnenie
- Obchod používa iba anonymný Supabase klient bez pretrvávajúcej Auth relácie.
- Admin používa sessionStorage namiesto localStorage a vyčistí starý lokálny token. Po nasadení sa administrátor musí znova prihlásiť; MFA a serverová expirácia zostávajú samostatné opatrenia.
- Objednávkové API odmieta cudzie CORS preflight požiadavky, požiadavky bez JSON Content-Type, nesprávne UUID produktov a duplicitné položky. Stripe raw webhook zostáva nezmenený.
- Netlify vynucuje základné bezpečné CSP direktívy base-uri, frame-ancestors, object-src, form-action. Plnú script-src aktivujeme až po bezpečnom odstránení inline handlerov.
- Migrácia sql/003_medlove_security.sql odoberá anonymovi tabuľkové práva na objednávky a obmedzuje priamy admin zápis na status a updated_at. Serverové Stripe operácie zostávajú pod service_role.
- Zmenené: public/admin.js, public/script.js, server/server.js, server/package.json, netlify.toml, README.md; nové sql/003_medlove_security.sql.
- Over po nasadení: opätovné prihlásenie admina, načítanie objednávok, zmenu stavu, hotovostnú objednávku a Stripe TEST platbu.

## Medlove V7 – Admin V2, upozornenia, tmavý režim a galéria
- **Centrum upozornení:** nová sekcia a počítadlo v admin hlavičke i menu, rýchle upozornenia na nové objednávky, kartové platby čakajúce na Stripe a zásoby do 5 ks. Údaje sa obnovujú počas aktívnej administrácie raz za minútu alebo tlačidlom Obnoviť; nejde o push správy. Každé upozornenie vedie na príslušnú objednávku alebo sklad.
- **Admin V2:** upravený dashboard, štyri rýchle akcie, náhľad upozornení, samostatná správa fotogalérie a lepší mobilný layout. Súčasné objednávky, práva RLS, Stripe a admin prihlásenie ostávajú.
- **Vzhľad:** nové `public/theme.js` zabezpečuje Automatický / Svetlý / Tmavý režim podľa nastavení zariadenia a voliteľnej trvalej voľby; platí na web, admin a informačné stránky.
- **Galéria:** `public/gallery.js`, sekcia `#galeria`, zväčšenie fotografií. Admin nahráva JPG/PNG/WebP do 5 MB do existujúceho bucketu `product-images/gallery/`, potvrdzuje práva, volí kategóriu, poradie a publikovanie; fotografie možno skryť alebo odstrániť. Verejná databázová RLS sprístupňuje len publikované fotografie; záznamy sú v `public.farm_gallery`.
- **Dôležité:** do galérie sme NENAHRAli žiadne cudzie obrázky ani vymyslené zábery farmy. Až do nahratia vlastných fotiek zobrazuje neutrálny text Fotografie pripravujeme. Obrázok poslaný v chate nie je overenou fotografiou Včelej farmy Slnečná.
- Migrácia `sql/004_medlove_gallery.sql` bola aplikovaná na Supabase projekt Medlove, existujúce objednávky a produkty zostali nedotknuté.
- Nasadenie: GitHub `main` → Netlify publish `public`. Nepotrebuje aktualizáciu Render backendu. Otestuj oba režimy, admin načítanie, upozornenia, nahratie reálnej fotografie, zverejnenie/skrytie a verejnú galériu.
- Úpravy: `public/index.html`, `public/admin.html`, `public/admin.js`, `public/style.css`, informačné HTML stránky a `README.md`; nové `public/gallery.js`, `public/theme.js`, `sql/004_medlove_gallery.sql`.
