# Déploiement — Render (backend) + Vercel (frontend)

Ce repo contient :

- **Frontend statique** à la racine (`index.html`, `connexion.html`, `inscription.html`, `css/`, `js/`…)
- **Backend Express** dans `backend/` (`backend/src/server.js`)

Objectif : héberger l’API sur **Render** et le frontend sur **Vercel**, tout en gardant le frontend qui appelle **`/api/*`** sur le même domaine Vercel (proxy/rewrite).

---

## Backend sur Render

### Réglages Render (service Web)

- **Root directory**: `backend`
- **Build command**: `npm install`
- **Start command**: `npm start`
- **Node version**: `>= 18` (déjà indiqué dans `backend/package.json`)

### Variables d’environnement Render

Obligatoires en production :

- **NODE_ENV**: `production`
- **JWT_ACCESS_SECRET**: une chaîne longue (>= 32 chars)
- **JWT_REFRESH_SECRET**: une chaîne longue (>= 32 chars)

Recommandées :

- **ALLOWED_ORIGINS**: domaines autorisés pour CORS (séparés par virgule).
  - Exemple : `https://smart-wine.vercel.app,https://smart-academy1.onrender.com,http://localhost:5500`
- **COOKIE_SECURE**: `true` (Render en HTTPS)

Optionnelles (si tu ajoutes un disque persistant Render) :

- **DATABASE_PATH**: chemin vers la base SQLite
- **UPLOAD_DIR**: chemin vers les fichiers uploadés

Notes :

- Les cookies d’auth restent en `sameSite: "strict"`. Avec le rewrite Vercel, le navigateur voit les appels API comme **same-origin** (domaine Vercel), donc ça fonctionne sans passer en `None`.
- Si tu testes en local depuis un serveur static (ex. `localhost:5500`), ajoute ce domaine à `ALLOWED_ORIGINS`.

### Healthcheck

L’API expose :

- `GET /api/health` → `{ ok: true, ... }`

---

## Frontend sur Vercel

### Réglages Vercel

Le frontend est statique (pas de framework). Le rewrite est défini dans `vercel.json` à la racine.

#### Étape 1 — Déployer le backend Render

Récupère l’URL publique Render (ex. `https://mon-backend.onrender.com`).

#### Étape 2 — Configurer le proxy `/api/*`

Dans `vercel.json`, remplace le placeholder :

- URL Render actuelle : `https://smart-academy1.onrender.com` (déjà dans `vercel.json`)

Exemple :

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://mon-backend.onrender.com/api/$1"
    }
  ]
}
```

### Appels API côté frontend

Le client JS (`js/sac-api.js`) utilise par défaut une base **same-origin** (vide `""`) en production, ce qui fait que les appels partent vers :

- `fetch("/api/...")` (via `BASE` vide)

Et Vercel rewrite ensuite vers Render.

Tu peux aussi forcer une base API (utile en preview / debugging) :

- **Global**: définir `window.SAC_API_BASE = "https://..."` avant de charger `js/sac-api.js`
- **Meta tag**: ajouter dans une page HTML :
  - `<meta name="sac-api-base" content="https://...">`

---

## Test rapide après déploiement

1) Ouvre ton site Vercel.
2) Vérifie que ce endpoint répond (dans le navigateur ou via curl) :

- `GET https://<ton-site-vercel>/api/health`

Attendu : HTTP 200 et `{"ok":true,...}`

Si tu as un `403 CORS_BLOCKED` :

- ajoute le domaine Vercel dans `ALLOWED_ORIGINS` sur Render.

