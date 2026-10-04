# 1. Harta aplicației

MacroMate are trei piese care rulează în locuri diferite:
- **aplicația din telefon**: React, plus o bază de date a browserului;
- **API-ul**: un program .NET pe server;
- **Postgres**: baza de date comună, tot pe server.

Pe lângă ele, API-ul vorbește cu trei servicii din afară: Open Food Facts (produse după cod de bare), DeepSeek (AI-ul) și Resend (emailurile pentru parolă și schimbarea adresei).

```mermaid
flowchart LR
  subgraph Telefon
    UI[Ecranele React]
    DX[(Dexie)]
    SW[Service worker]
  end
  subgraph VPS
    CA[Caddy]
    API[API .NET]
    PG[(Postgres)]
    FS[Poze și chei pe disc]
  end
  SW -.->|fișierele aplicației| UI
  UI <--> DX
  DX <-->|sincronizare| CA
  CA --> API
  API --> PG
  API --> FS
  API --> OFF[Open Food Facts]
  API --> DS[DeepSeek]
  API --> RS[Resend]
```

| Piesa | Ce e | Unde e codul |
|---|---|---|
| Ecranele React | Paginile pe care le vezi: Azi, Planuri, Rețete, Alimente, Cumpărături, Progres, Profil | `web/src/routes/` |
| Dexie | O bibliotecă peste IndexedDB, adică peste baza de date pe care o are fiecare browser. Ține în telefon o copie a datelor tale și coada de modificări netrimise. | `web/src/db/` |
| Service worker | Un script pe care browserul îl ține instalat după prima vizită. Dă fișierele aplicației din cache, deci aplicația se deschide și fără internet. | generat din `web/vite.config.ts` |
| Caddy | Serverul web din fața API-ului. Pune singur certificatul HTTPS, dă fișierele aplicației și trimite tot ce începe cu `/api` la API. | `deploy/Caddyfile` |
| API .NET | Primește modificările, le verifică și le scrie în Postgres. Tot el vorbește cu DeepSeek, cu Open Food Facts și cu Resend. | `api/MacroMate.Api/` |
| Postgres | Baza de date comună a tuturor conturilor | tabelele: `api/MacroMate.Api/Data/` |

## Al cui e fiecare lucru

Datele stau pe trei niveluri:

| Nivel | Ce e în el | Cine îl vede |
|---|---|---|
| baza generală | alimentele | toate conturile |
| **bucătăria** | cămara, rețetele, planurile, listele de cumpărături | membrii bucătăriei |
| personal | jurnalul, planul zilei, greutatea, profilul | doar tu |

**Bucătăria** e grupul de conturi care împart cămara, rețetele, planurile și listele. Tu și prietena ta sunteți în aceeași bucătărie: intră în ea cu un link de invitație din Profil. Totul e explicat în capitolul despre bucătărie.

## Regula de bază: ecranele citesc doar din telefon

Niciun ecran nu cere date de la API când îl deschizi. Fiecare ecran citește din Dexie, care e în telefon.

Asta e o alegere făcută ca aplicația să meargă offline. Dacă ecranele ar cere datele de la server, fără internet ar fi goale.

```mermaid
flowchart LR
  E[Ecran] -->|citește| DX[(Dexie)]
  E -->|salvează| DX
  DX -->|coada| S[sync.ts]
  S -->|trimite și primește| API[API]
  S -->|pune ce a primit| DX
```

- **Citirea**: ecranul folosește `useLiveQuery` din Dexie. Când un tabel din telefon se schimbă, Dexie redesenează singur ecranul.
- **Scrierea**: ecranul cheamă `saveRow`. Funcția scrie rândul în telefon și pune o copie în coadă (`outbox`).
- **Sincronizarea**: `web/src/db/sync.ts` trimite coada la API și aduce ce s-a schimbat pe server. Rulează în fundal: la deschiderea aplicației, când revii în ea, când revine internetul, la fiecare minut și la scurt timp după fiecare salvare.

Câteva lucruri merg direct la API și au nevoie de internet:
- login-ul și „Contul tău” (nume, email, parolă, „Am uitat parola”);
- secțiunea Bucătăria din Profil și pagina de invitație;
- căutarea după codul de bare;
- DeepSeek: completarea unui aliment, rețeta generată, scanarea farfuriei.

## Două limbi

Aplicația merge în română și în engleză. Textele stau în `web/src/i18n/ro/` și `web/src/i18n/en/`. Limba vine din browser și se schimbă din Profil sau de pe login. Telefonul trimite limba la API în headerul `Accept-Language`, iar API-ul răspunde în ea, cu mesajele din `Resources/Messages.resx` și `Messages.en.resx`.

## Folderele

```
MacroMate/
├── api/
│   ├── MacroMate.Api/
│   │   ├── Program.cs              pornirea: servicii, login, limbi, limite, endpoint-uri
│   │   ├── Data/                   tabelele (clase C#) și migrările
│   │   ├── Features/
│   │   │   ├── Auth/               login, logout, „cine sunt”, contul (nume, email, parolă)
│   │   │   ├── Email/              trimiterea emailurilor (Resend sau consola)
│   │   │   ├── Kitchens/           bucătăria: invitații, intrare, plecare, arhivă
│   │   │   ├── Sync/               sincronizarea: citire, scriere, validare
│   │   │   ├── Foods/              căutarea după cod de bare (Open Food Facts)
│   │   │   ├── Ai/                 DeepSeek: alimente, rețete generate, scanarea farfuriei
│   │   │   ├── Photos/             urcarea și descărcarea pozelor
│   │   │   └── Security/           limitarea numărului de cereri
│   │   ├── Resources/              mesajele API-ului în română și engleză (.resx)
│   │   ├── Admin/                  comenzile create-user și seed-foods
│   │   └── Seed/foods.json         cele 75 de alimente de start, cu nume în engleză
│   └── MacroMate.Api.Tests/        testele API-ului, pe un Postgres real
├── web/
│   └── src/
│       ├── routes/                 un fișier pe ecran (TanStack Router), plus invite, forgot/reset-password, confirm-email
│       ├── components/app/         bucăți refolosite: alegerea alimentelor, scannerul, bucătăria, contul, scanarea farfuriei
│       ├── components/ui/          componentele shadcn
│       ├── db/                     Dexie, coada, sincronizarea, sesiunea, bucătăria
│       ├── i18n/                   textele în română și engleză
│       ├── lib/                    calculele (valori, note, ținte, cumpărături, căutare, formatare)
│       ├── hooks/                  citiri din Dexie gata de folosit în ecrane
│       └── api/                    clientul HTTP și tipurile generate din API
├── deploy/                         Docker Compose, Caddy, backup
├── dev.sh                          pornește Postgres, API-ul și aplicația dintr-o comandă
└── docs/                           specificația și ghidul ăsta
```

## Unde schimbi ce

| Vrei să… | Atingi |
|---|---|
| adaugi un câmp la aliment | `Data/Food.cs`, o migrare nouă, `Features/Sync/SyncRules.cs` (validarea), `pnpm --dir web gen:api`, apoi `web/src/lib/food-draft.ts` și `components/app/food-form.tsx` |
| schimbi criteriile notelor sau ce cere AI-ul | `Features/Ai/AiPrompts.cs` |
| adaugi o categorie | `Data/FoodCategories.cs` și `web/src/lib/categories.ts` |
| schimbi formula țintelor | `web/src/lib/targets.ts` și testul de lângă |
| schimbi cum se aleg alternativele | `alternativesFor` din `web/src/lib/nutrition.ts` |
| schimbi un text din aplicație | aceeași cheie în `web/src/i18n/ro/` și în `web/src/i18n/en/` |
| schimbi un mesaj al API-ului sau textul unui email | `api/MacroMate.Api/Resources/Messages.resx` și `Messages.en.resx` |
| schimbi limitele de cereri | `Features/Security/RateLimiting.cs`, sau setările `RateLimits__AuthPerMinute` și `RateLimits__AiPerTenMinutes` |
| schimbi regulile bucătăriei | `Features/Kitchens/KitchenService.cs` |
| schimbi culorile | variabilele din `web/src/index.css` |
| adaugi un ecran | un fișier nou în `web/src/routes/`; router-ul îl găsește singur |
| adaugi alimente de start | `api/MacroMate.Api/Seed/foods.json` |
