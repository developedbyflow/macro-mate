# MacroMate

PWA de nutriție: alimente cu note pentru glicemie și slăbit, rețete cu variante, meal plan-uri pe o zi, jurnal de calorii, listă de cumpărături și generare de rețete cu AI. Merge pe telefon, offline, cu camera.

- Ce face și de ce: [docs/spec.md](docs/spec.md)
- Cum funcționează pe dinăuntru, pas cu pas: [docs/ghid/](docs/ghid/README.md)

## Ce e în proiect

| Folder | Ce e |
|---|---|
| `api/` | API-ul: ASP.NET Core (.NET 10), EF Core, PostgreSQL. Plus testele lui, în `MacroMate.Api.Tests/`. |
| `web/` | Aplicația din telefon: React + TypeScript + Vite, TanStack Router, Dexie, shadcn/ui, PWA. |
| `deploy/` | Ce rulează pe VPS: Docker Compose, Caddy, scriptul de backup. |
| `docs/` | Specificația și ghidul. |
| `compose.yaml` | Postgres pentru dezvoltare, pe portul 5491. |

## Pornire locală

Ai nevoie de Docker, .NET 10 SDK, Node 22 și pnpm.

Totul dintr-o comandă: Postgres, API-ul și aplicația, pe `http://localhost:5173`. `Ctrl+C` le oprește pe toate trei:

```bash
./dev.sh
```

Sau pe rând, fiecare în terminalul lui. Pornești Postgres:

```bash
docker compose up -d
```

Pornești API-ul pe `http://localhost:5180`. La prima pornire creează tabelele, două conturi de test și 75 de alimente:

```bash
dotnet run --project api/MacroMate.Api
```

Instalezi pachetele frontend-ului, o singură dată:

```bash
pnpm --dir web install
```

Pornești aplicația pe `http://localhost:5173`. Cererile spre `/api` merg la API:

```bash
pnpm --dir web dev
```

Conturile de test și parola lor sunt în `api/MacroMate.Api/appsettings.Development.json`, la `DevSeed`.

## Cheia DeepSeek

Fără cheie, aplicația merge, dar butoanele de AI arată „cheia nu e setată”. Pe laptop, cheia stă în user-secrets, în afara proiectului. Comanda te întreabă cheia; o lipești și apeși Enter:

```bash
read -rs "KEY?Cheia DeepSeek: " && dotnet user-secrets set DeepSeek:ApiKey "$KEY" --project api/MacroMate.Api; unset KEY
```

Pe server, cheia stă în `deploy/.env`.

## Teste

API-ul, cu Postgres-ul de dezvoltare pornit:

```bash
dotnet test api
```

Calculele din frontend:

```bash
pnpm --dir web test
```

## Tipurile TypeScript din API

După ce schimbi un model C#, regenerezi tipurile din `web/src/api/schema.d.ts`:

```bash
pnpm --dir web gen:api
```

## Deploy

Pas cu pas, în [docs/ghid/09-deploy.md](docs/ghid/09-deploy.md).
