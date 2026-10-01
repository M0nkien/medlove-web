# MEDLOVE V6 – PRESNÝ POSTUP PREPOJENIA

## Skontrolovaný východiskový stav (1. 10. 2026)
- **Existujúci Supabase projekt** `Medlove` (`gdykbtgpjmvpuqnbzldk`) je aktívny.
- Databáza má tabuľky `admins`, `products` (4 záznamy), `orders`, `order_items`, `shop_settings`.
- Pravidlá RLS sú zapnuté. Migrácia V5 pre platby a Storage sa už aplikovala. **NESPÚŠŤAJ znova pôvodné SQL na vytváranie tabuliek.**
- V pripojenom účte GitHub `M0nkien` bol k poslednej kontrole viditeľný `study-hub`, nie ešte `medlove-web`.
- Render ani Stripe účty nie sú zatiaľ napojené na tento ChatGPT. Nasadenie a výmena tajných kľúčov preto vyžadujú prihlásenie v ich dashboardoch.

> Hodnoty skladových zásob 18/14/10/8 sú testovacie. Pred predajom potvrď reálny sklad, údaje podnikateľa a právo používať fotografie.

## 1. Rozbaľ projekt V6 a vytvor samostatný repozitár
1. Stiahni `medlove-v6.zip` a rozbaľ ho do priečinka `medlove-v6`.
2. Na https://github.com/new vytvor **súkromný** repozitár `medlove-web` na účte, ktorý bude majiteľ farmy vlastniť alebo k nemu bude mať administrátorský prístup. Pri tvorbe nevyberaj dodatočný README, .gitignore ani licenciu; tieto súbory sú pripravené v ZIPe.
3. Otvor rozbalený priečinok vo VS Code: File → Open Folder → `medlove-v6`.
4. V termináli VS Code spusti:

```bash
git init
git add .
git commit -m "Medlove V6: Supabase a Stripe checkout"
git branch -M main
git remote add origin https://github.com/TVÔJ-ÚČET/medlove-web.git
git push -u origin main
```

Nahraď `TVÔJ-ÚČET` skutočným GitHub menom (pri aktuálnom pripojení `M0nkien`, ak je to jeho repozitár). Ak Git hlási `remote origin already exists`, nezadávaj príkaz na pridanie znova; najprv zisti `git remote -v`. **Nenahrávaj skutočný `.env` ani tajné kľúče** – `.gitignore` ich vylučuje.

## 2. Nasadiť frontend na Netlify
1. https://app.netlify.com → **Add new project → Import an existing project → GitHub**.
2. Pripoj GitHub a vyber `medlove-web`.
3. Zadaj:
   - **Branch:** `main`
   - **Base directory:** prázdne (koreň repozitára)
   - **Build command:** prázdne
   - **Publish directory:** `public` (aj v koreňovom `netlify.toml`)
4. Klikni **Deploy** a zapíš si pridelenú presnú HTTPS adresu, napríklad `https://SKUTOCNE-MENO.netlify.app`. Príklad **nie je reálna adresa**.
5. Otvor adresu: musí sa zobraziť Medlove, produkty a skutočná fotografia. Zatiaľ sa nemusí dať dokončiť objednávka, pretože Render ešte nie je nastavený.

## 3. Over Supabase (NEZAKLADAJ nový projekt)
1. Otvor https://supabase.com/dashboard → projekt **Medlove**.
2. **Table Editor → products**: skontroluj štyri medy, cenu, dostupnosť a prípadne priraď reálne fotografie.
3. **Authentication → Users**: skontroluj, či existuje skutočný admin účet a jeho e-mail je potvrdený. Ak neexistuje, vytvor ho cez **Add user** so silným súkromným heslom.
4. **Table Editor → admins**: musí obsahovať `user_id` (UUID) z **Authentication → Users**. Ak sa nezhoduje, priraď ho cez SQL Editor:

```sql
insert into public.admins (user_id)
values ('NAHRAĎ-SKUTOČNÝM-UUID-Z-AUTH-USERS')
on conflict (user_id) do nothing;
```

5. **Storage → product-images**: over, že bucket existuje; admin doň môže nahrávať obrázky.
6. `public/config.js` už obsahuje **verejnú** Supabase URL a publishable key, ktoré patria k existujúcemu Medlove projektu. Zatiaľ ich nemeň.
7. **Project Settings / Settings → API Keys**: skopíruj `sb_secret_...` (ak existuje; podľa nastavení môže byť dostupný aj legacy `service_role`). **Nezapisuj ho do JS, GitHubu ani do chatu.** Bude sa používať iba v Render Environment.

## 4. Vytvor Node.js backend na Renderi
1. https://dashboard.render.com → **New → Web Service → Connect GitHub**.
2. Vyber *ten istý* repozitár `medlove-web`.
3. Vyplň:

| Pole Render | Hodnota |
|---|---|
| Name | `medlove-api` (alebo jedinečný dostupný názov) |
| Language / Runtime | `Node` |
| Branch | `main` |
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |

4. Vyber plán vhodný na **trvale dostupný backend**; pri platbách nepoužívaj uspávanú testovaciu službu.
5. V **Environment** pridaj premenné – nie do GitHubu:

| Key | Value |
|---|---|
| `SUPABASE_URL` | `https://gdykbtgpjmvpuqnbzldk.supabase.co` |
| `SUPABASE_SECRET_KEY` | tajný kľúč z *existujúceho* Supabase Medlove projektu |
| `FRONTEND_URL` | presná adresa Netlify z kroku 2, `https://...netlify.app` bez `/` na konci |
| `STRIPE_SECRET_KEY` | zatiaľ nechaj nenastavené; doplní sa až pri Stripe teste |
| `STRIPE_WEBHOOK_SECRET` | zatiaľ nechaj nenastavené; doplní sa až pri Stripe teste |

`PORT` zvyčajne nastavuje Render automaticky; Node kód používa `process.env.PORT` a predvolený port `10000`.

6. Spusti **Create Web Service / Deploy**.
7. Skopíruj HTTPS adresu servera, napríklad `https://SKUTOČNÁ-SLUŽBA.onrender.com`.
8. V prehliadači otvor `https://SKUTOČNÁ-SLUŽBA.onrender.com/api/health`. Musíš dostať JSON podobný:

```json
{"service":"medlove-api","version":"6.0.0","ok":true,"stripeConfigured":false}
```

Ak nie, pozri **Render → Logs** a skontroluj názvy Environment premenných.

## 5. Prepoj Netlify frontend s Renderom
1. Vo VS Code otvor `public/config.js`.
2. Nahraď **iba** adresu `apiBaseUrl` reálnou URL Render backendu:

```js
apiBaseUrl: 'https://SKUTOČNÁ-SLUŽBA.onrender.com'
```

3. Ulož, potom:

```bash
git add public/config.js
git commit -m "Connect frontend to Render backend"
git push
```

4. Netlify automaticky nasadí zmenu. Vyskúšaj košík a objednávku s **hotovosťou pri prevzatí**. Teraz musí fungovať serverové vytvorenie objednávky aj odpočítanie skladu.
5. V Supabase **Table Editor → orders** nájdi skúšobnú objednávku a over položky cez **order_items**. V admine musí byť dostupná.

**Pozor:** keď vytvoríš objednávku, reálne sa odpočíta zásoba. Testy si poznač a po dohode s majiteľom uprav sklad na pravdivé hodnoty.

## 6. Stripe Checkout – najprv iba testovací režim
1. Majiteľ farmy si otvorí https://dashboard.stripe.com a vytvorí účet na svoje podnikateľské údaje. Musí dokončiť požadované overenie a aktiváciu pred ostrým predajom.
2. V Stripe prepni na **test mode / sandbox** a skopíruj **Secret key** začínajúci `sk_test_...`.
3. V Render → **Environment** pridaj:

```text
STRIPE_SECRET_KEY=sk_test_SKUTOČNÝ_TESTOVACÍ_KĽÚČ
```

4. V Stripe **Workbench / Developers → Webhooks / Event destinations → Add destination** vytvor webhook s **HTTPS endpointom**:

```text
https://SKUTOČNÁ-SLUŽBA.onrender.com/api/stripe/webhook
```

5. Vyber udalosti `checkout.session.completed` a `checkout.session.expired`. Pri prípadnom rozšírení spôsobov platby doplň aj asynchrónne udalosti (kód V6 podporuje iba karty v synchronizovanom Stripe Checkout režime).
6. Z tohto **konkrétneho testovacieho webhook endpointu** skopíruj signing secret `whsec_...`.
7. V Render Environment nastav:

```text
STRIPE_WEBHOOK_SECRET=whsec_SKUTOČNÝ_TESTOVACÍ_WEBHOOK_SECRET
```

8. Zvoľ **Save, rebuild and deploy** (alebo nasadenie s novými Environment premennými).
9. Otvor `/api/health` – musí mať `stripeConfigured: true`.
10. V košíku vyber platbu kartou, použi **Stripe testovaciu kartu** zo Stripe dokumentácie, nie reálnu kartu. Skontroluj:
    - presmerovanie na Stripe Checkout;
    - objednávku `payment_status = pending`, kým Stripe nepotvrdí platbu;
    - po podpísanom webhoooku `payment_status = paid`;
    - pri vypršaní relácie `failed` + vrátenie rezervovaného skladu.
11. Pri platenej objednávke nevydávaj tovar, kým v databáze/administrácii neuvidíš `paid`.

### Prepnutie na ostré platby
Až po úspešných testoch a overení podnikateľského účtu:
- nahraď `STRIPE_SECRET_KEY` ostrým `sk_live_...`;
- v **live mode** Stripe vytvor **nový live webhook** na rovnakú Render HTTPS URL;
- nahraď `STRIPE_WEBHOOK_SECRET` podpisovým kľúčom **tohto live webhooku**;
- redeploy a vykonaj schválenú malú ostrú testovaciu platbu; overené vrátenie/refund otestuj podľa možností účtu.

**Nikdy nezamieňaj testovací `sk_test_...` a live `whsec_...` ani naopak.** Stripe `pk_...` kľúč netreba, pretože vytvárame serverové Checkout relácie a presmerovávame na Stripe.

## 7. Admin panel
Na adrese `https://TVOJ-NETLIFY.netlify.app/admin.html` sa prihlás **skutočným Supabase Auth účtom**. Demo heslo `med123` sem nepatrí.
- Dashboard: produkty, nové objednávky a stav skladu.
- Produkty: pridávanie, zmena ceny a skladového množstva, fotografií, viditeľnosti a poradia.
- Objednávky: detaily, položky, stav spracovania; kartové objednávky môžeš vybavovať až pri `paid`.
- Nastavenia: názov, kontakty, texty, podmienka odberu od 3 ks.

## 8. ChatGPT a prevádzka
GitHub aj Supabase už vie ChatGPT obsluhovať cez dostupné prepojenia. Render a Stripe sa pripájajú v ChatGPT **Settings → Plugins** iba ak sa majiteľ rozhodne pripojenie povoliť. Bez pripojenia vieš postupovať manuálne podľa tohto návodu a ja môžem pripravovať kód. Netlify sa nasadzuje automaticky z GitHubu; pri tejto verzii nie je potrebné priame prepojenie Netlify s ChatGPT.

## 9. Test pred verejným spustením
- [ ] Priradiť štyri výrezy medov k správnym druhom (teraz predbežné).
- [ ] Doplniť identifikačné a kontaktné údaje skutočného predávajúceho.
- [ ] Potvrdiť zásoby, ceny, presnú dopravu a platobné podmienky s majiteľom.
- [ ] Pripraviť skutočné obchodné podmienky, ochranu osobných údajov, reklamačný postup a povinné informácie pri predaji potravín; vo V6 sú odkazy na právne stránky zatiaľ len rezervované.
- [ ] Nastaviť potvrdenia objednávky zákazníkovi a majiteľovi (automatické e-maily nie sú vo V6 implementované).
- [ ] Otestovať hotovosť, testovaciu kartu, platbu po návrate na success.html a zrušenie/vypršanie Checkout relácie.
- [ ] Spraviť serverový backup, nie iba JSON export z admina.
- [ ] Prepnúť na ostrý Stripe, prípadne kúpiť a nastaviť vlastnú doménu.

**Dôležité:** Medlove V6 je pripravená na integráciu a nasadenie, no nie je tvrdením, že Netlify, Render a Stripe už boli reálne prepojené alebo ostré platby odskúšané.
