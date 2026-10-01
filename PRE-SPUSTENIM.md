# Medlove – kroky pred ostrým spustením (V6.2)

## Implementované v GitHube a Supabase
- Stripe Checkout, serverové overenie platieb, bezpečný webhook a oprava zmeškaného potvrdenia.
- Objednávky pri platbe v hotovosti, produkty, sklad a admin.
- Nová SQL migrácia `sql/002_medlove_email.sql` už vykonaná v Supabase.
- Serverový modul `server/email.js` pripravuje potvrdenia zákazníkovi (ak zadal e-mail) aj upozornenia pre majiteľa po vytvorení hotovostnej alebo úspešne zaplatenej kartovej objednávky. Resend idempotency key a databázová evidencia znižujú riziko duplicitného odoslania.
- Zákaznícka stránka `public/doprava-a-platba.html`; odkaz z pätičky.
- Tajné kľúče sú iba v Render Environment, nie v GitHube.

## Nastavenie e-mailov (vykoná vlastník účtov)
1. Založ alebo pripoj účet https://resend.com v mene prevádzkovateľa. V Resend → Domains over doménu, z ktorej sa má odosielať; nastav DNS záznamy požadované službou (SPF/DKIM).
2. V Resend vytvor API key `re_...`. Nikdy ho nevkladaj do GitHubu ani verejného `config.js`.
3. Render → medlove-web → Environment: nastav `RESEND_API_KEY`, `EMAIL_FROM` (napr. `Medlove <objednavky@OVERENA-DOMENA.sk>`), `ORDER_NOTIFICATION_EMAIL` (skutočný e-mail majiteľa), `EMAIL_NOTIFICATIONS_FROM` (UTC ISO dátum/čas, odkedy odosielať upozornenia, napr. `2026-10-02T12:00:00Z`). Pri novom spustení si vyber moment AŽ PO testovacích objednávkach.
4. Ulož a redeployni Render. `/api/health` má ukázať `version: 6.2.0` a `emailConfigured: true`.
5. Urob jednu novú skúšobnú hotovostnú objednávku s e-mailom a jednu kartovú v TEST Stripe režime; skontroluj Resend → Emails, obe poštové schránky a tabuľku `email_deliveries`.
6. Počas testovania neposielaj ostré e-maily skutočným zákazníkom. Pri ostrých testoch používaj schránky, ktoré vlastníš.

## Povinné údaje prevádzkovateľa a právna kontrola – nedoplnené
- Celé oficiálne obchodné meno / meno podnikateľa, IČO, DIČ/IČ DPH ak existuje, sídlo/miesto podnikania, PSČ, kontaktný e-mail, zápis v registri a adresu na reklamácie.
- Schválené a zverejnené obchodné podmienky vrátane poučenia o odstúpení a reklamačného postupu. Interný pracovný návrh: `docs/OBCHODNE-PODMIENKY-NAVRH.md`.
- Schválené a zverejnené zásady ochrany osobných údajov s reálnymi lehotami uchovávania a informáciami o sprostredkovateľoch. Interný návrh: `docs/OCHRANA-OSOBNYCH-UDAJOV-NAVRH.md`.
- Overiť potravinárske oprávnenia, skutočné etikety, krajinu pôvodu, povinné údaje o balenej potravine pri predaji na diaľku. Podľa článku 14 nariadenia (EÚ) 1169/2011 je potrebné sprístupniť relevantné povinné informácie pred objednávkou (okrem dátumu minimálnej trvanlivosti, ktorý musí byť dostupný pri dodaní).
- Potvrdiť štyri produktové fotografie/výrezy, hmotnosť, pôvod medov a skladové zásoby podľa skutočnosti.
- Dohodnúť presnú oblasť dovozu a reálny spôsob vybavenia a lehoty dodania.
- Overiť daňové, fakturačné a účtovné povinnosti podnikateľa a spôsob evidovania tržieb.

## Ostré Stripe a doména – vyžaduje vlastníka
- Overiť Stripe podnikateľský účet, bankový účet príjemcu, aktivovať live mode; v Render vymeniť spolu `STRIPE_SECRET_KEY=sk_live_...` a nový LIVE `STRIPE_WEBHOOK_SECRET=whsec_...`; LIVE endpoint musí odoberať `checkout.session.completed` a `checkout.session.expired`.
- Overiť LIVE webhook, refund a scenáre nedokončenej platby; skúšobná LIVE platba skutočne strháva peniaze.
- Kúpiť alebo potvrdiť vlastníctvo domény, pripojiť doménu v Netlify a nastaviť DNS/HTTPS. Pri zmene domény upraviť `FRONTEND_URL` v Render Environment, `public/config.js` má backend URL bez zmeny, ak zostáva Render adresa.
- Pred verejným ostrým predajom skontrolovať mobil, obrazovky po zaplatení, e-mailové doručenie, dostupnosť Render služby, zálohy a monitoring. Reálny e-shop sa nesmie považovať za právne dokončený len na základe implementovaného kódu.

## Nasadenie
GitHub repo: `M0nkien/medlove-web`, branch `main`. Netlify publish directory `public`, Render root directory `server`, build `npm install`, start `npm start`. Nepúšťaj starý `sql/001_medlove_v5.sql` znova.
