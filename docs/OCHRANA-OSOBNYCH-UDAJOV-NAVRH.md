# NÁVRH – ochrana osobných údajov Medlove
**Interný pracovný dokument. NEZVEREJŇOVAŤ, kým prevádzkovateľ nedoplní svoje identifikačné a kontaktné údaje, reálne lehoty uchovávania a nepotvrdí použitých dodávateľov.**

## Prevádzkovateľ
**[DOPLNIŤ oficiálne obchodné meno/meno, sídlo alebo miesto podnikania a kontaktný e-mail na otázky o osobných údajoch.]**

## Účely a právne základy
- Vybavenie objednávky, dohodnutie odberu/dovozu a riešenie súvisiacich požiadaviek: údaje zákazníka a položky objednávky potrebné na plnenie zmluvy alebo prijatie opatrení pred jej uzatvorením.
- Evidencia účtovných a zákonných dokladov: údaje v rozsahu vyžadovanom príslušnými právnymi predpismi.
- Bezpečnosť služby a prevencia zneužitia: nevyhnutné technické údaje v rozsahu skutočného nastavenia servera.
- E-mailové potvrdenie objednávky je transakčná komunikácia, nie súhlas s marketingom. Žiadny marketingový newsletter neodosielame bez osobitného právneho základu.

## Údaje
Meno a priezvisko, telefón, voliteľný e-mail pri hotovostnej objednávke alebo povinný pri kartovej platbe, zvolený spôsob prevzatia, dodacia adresa pri lokálnom dovoze, poznámka, obsah/cena/stav objednávky a identifikátory Stripe platby. Platobné údaje z karty spracúva Stripe na svojej platobnej stránke; obchod neukladá číslo platobnej karty.

## Príjemcovia a dodávatelia
Supabase (databáza a autentifikácia), Render (objednávkové API), Netlify (webhosting), Stripe (kartové platby) a po aktivácii Resend (transakčné e-maily). **[POTVRDIŤ konkrétne právne subjekty poskytovateľov, prípadné prenosy do tretích krajín, zmluvné záruky a ďalších dodávateľov.]**

## Uchovávanie
**[DOPLNIŤ skutočné lehoty alebo objektívne kritériá uchovávania objednávok, účtovných dokladov, technických logov a e-mailových záznamov podľa platných právnych povinností.]**

## Práva dotknutých osôb
Právo na prístup, opravu, vymazanie, obmedzenie spracúvania, prenosnosť a namietanie za podmienok GDPR. Sťažnosť možno podať Úradu na ochranu osobných údajov SR. **[DOPLNIŤ praktický kontakt a vybavenie žiadostí.]**

## Miestne úložisko a súbory cookie
Košík sa dočasne uchováva v localStorage prehliadača zákazníka. **[PRESKÚMAŤ skutočné cookies Supabase Auth, Stripe, Netlify a ďalších načítaných služieb pred zverejnením konečného textu.]**

**Podklad:** https://eur-lex.europa.eu/eli/reg/2016/679/oj
