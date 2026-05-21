# WeMoved Forum — Guide de démarrage

## Structure du projet

```
wemoved-project/
├── index.html
├── package.json
├── vite.config.js
├── .env.example
├── supabase-schema.sql        ← tables SQL à coller dans Supabase
└── src/
    ├── main.jsx               ← point d'entrée
    ├── App.jsx                ← état global, routing
    ├── components/
    │   ├── UI.jsx             ← Btn, Input, Section, Av, Dot…
    │   ├── GeoSelects.jsx     ← sélecteurs région/dept/ville
    │   ├── Logo.jsx           ← logo wemoved
    │   ├── Navbar.jsx         ← barre de navigation
    │   ├── VoteBlock.jsx      ← bloc de votes
    │   └── TopRankings.jsx    ← classement mensuel
    ├── pages/
    │   ├── Home.jsx           ← accueil / feed
    │   ├── Forum.jsx          ← forum discussions
    │   ├── Members.jsx        ← annuaire membres
    │   ├── Profile.jsx        ← profil utilisateur
    │   ├── Messages.jsx       ← messagerie privée
    │   └── Login.jsx          ← connexion / inscription
    ├── lib/
    │   ├── constants.js       ← données démo, couleurs, GEO
    │   └── supabase.js        ← client Supabase
    ├── hooks/
    │   ├── useAuth.jsx        ← authentification Supabase
    │   └── useCountdown.js    ← compte à rebours fin de mois
    └── styles/
        └── global.css         ← animations, scrollbar, classes CSS
```

---

## Étape 1 — Lancer en mode démo (sans Supabase)

```bash
# Dans le dossier du projet
npm install
npm run dev
```

Ouvre http://localhost:5173 — tout fonctionne avec les données locales.

---

## Étape 2 — Connecter Supabase

### 2a. Créer un projet Supabase
1. Va sur https://supabase.com → New Project
2. Note ton **Project URL** et ta **anon key** (Settings > API)

### 2b. Créer les tables
1. Dans Supabase : **SQL Editor** → **New query**
2. Colle le contenu de `supabase-schema.sql`
3. Clique **Run**

### 2c. Configurer les variables d'environnement
```bash
# Copie le fichier exemple
cp .env.example .env

# Édite .env et remplace les valeurs :
VITE_SUPABASE_URL=https://TON_ID.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGci...ta-clé-anon
```

### 2d. Relancer
```bash
npm run dev
```

---

## Étape 3 — Déployer sur Vercel ou Netlify

### Vercel
```bash
npm install -g vercel
vercel
# Ajoute les variables d'env dans le dashboard Vercel
```

### Netlify
```bash
npm run build
# Dépose le dossier dist/ sur Netlify Drop
# Ou connecte le repo GitHub et configure les env vars
```

---

## Variables d'environnement requises

| Variable | Description |
|----------|-------------|
| `VITE_SUPABASE_URL` | URL de ton projet Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clé publique anonyme Supabase |

---

## Dépendances installées

| Package | Rôle |
|---------|------|
| `react` + `react-dom` | Framework UI |
| `react-router-dom` | Navigation (optionnel, routing manuel intégré) |
| `@supabase/supabase-js` | Client Supabase (auth + base de données) |
| `vite` + `@vitejs/plugin-react` | Build tool |

---

## Fonctionnalités

- ✅ Forum avec catégories, épinglage, verrouillage, modération
- ✅ Profils avec votes mensuels (Top Mimi, Cool, Sexy, Loose)
- ✅ Messagerie privée
- ✅ Classement mensuel avec compte à rebours
- ✅ Recherche membres par pseudo, région, département, ville
- ✅ Système de rôles (Admin, Manager, Modérateur, Animateur, Membre)
- ✅ Bannissement / débannissement
- ✅ Auth Supabase (inscription, connexion, déconnexion)
- ✅ Tables SQL avec RLS prêtes à l'emploi
- ✅ Mode démo sans Supabase
