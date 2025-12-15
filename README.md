# Onboarding i IPW - Proof of Concept

Dette projekt er en lille **proof-of-concept applikation** udviklet i forbindelse med bacheloropgaven  
**“Fra forvirring til fremdrift: Progression, feedback og overblik i onboarding”**  
på Professionsbachelor i Webudvikling (IBA, 2025).

Applikationen demonstrerer et **event-baseret onboardingmodul** med synlig progression, simpel feedback og administrativt overblik.

## Teknisk overblik

- Backend: Node.js + Express
- Database: SQLite (`onboarding.db`, oprettes automatisk)
- Frontend: Ren HTML/CSS/JavaScript i `public/`
- API-ruter i `routes/` (public + admin)

## Kom i gang

### Forudsætninger

- Node.js (v18+ anbefales)
- NPM

### Installation

```bash
npm install
```

### Start serveren

```bash
npm start
```

Serveren kører på:

```
http://localhost:3000
```

Ved første start oprettes databasen automatisk, og demo-data seedes via `db.js`.

## Login (demo-brugere)

Gå til:

```
http://localhost:3000
```

Du lander på login-siden.

**Admin:**

- Brugernavn: `admin`
- Adgangskode: `admin`
- Redirect: `admin.html`

**Slutbrugere:**

- `Brian` / `password123`
- `Lotte fra Kvalitet` / `password123`
- `Birthe fra HR` / `password123`

Slutbrugere redirectes til `index.html`.

## Projektstruktur

- **server.js** – Express-server, login, statiske filer
- **db.js** – Opretter SQLite-database og seed’er demo-data
- **routes/public.js** – API til bruger-UI
- **routes/admin.js** – API til admin-UI
- **public/**
  - `login.html`
  - `index.html`
  - `admin.html`
  - `app.js` (frontend-logik for bruger)
  - `admin.js` (frontend-logik for admin)
  - `style.css`
- **extra/** – Bilagsmateriale (SQL-eksempel, simplificeret js af eventhåndtering, PHP-eventhåndtering)

---
