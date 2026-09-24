# 🎓 Agent IA d'Orientation — Sénégal

Application web d'accompagnement et d'orientation scolaire et universitaire pour les élèves et étudiants sénégalais (filières, universités publiques, débouchés professionnels, bourses nationales et procédure Campusen), propulsée par un agent conversationnel IA sécurisé avec **RAG (pgvector)** et **Supabase**.

---

## 🛡️ Architecture & Exigences de Sécurité

1. **Isolation stricte des clés** :
   - Les clés sensibles (`SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`) sont **strictement confinées au serveur**. Aucune clé sensible n'est préfixée `NEXT_PUBLIC_`.
2. **Row Level Security (RLS)** :
   - RLS activée sur l'intégralité des tables (`profiles`, `universites`, `bourses`, `conversations`, `messages`, `knowledge_embeddings`).
   - Un utilisateur n'a accès en lecture/écriture qu'à ses propres données (`auth.uid() = user_id`).
3. **Protection contre les abus & injections** :
   - **Rate Limiting** serveur (20 requêtes/minute/IP) avec en-têtes HTTP de contrôle.
   - **Sanitisation et normalisation** des entrées utilisateur pour neutraliser les tentatives de contournement de prompt (*prompt injection / jailbreak*).
   - **Validation Zod de bout en bout** sur tous les flux de données (requêtes API, entrées formulaires, variables d'environnement).
4. **Authentification sans mot de passe** :
   - Supabase Auth par Magic Link / OTP email pour protéger les jeunes utilisateurs et mineurs (aucun mot de passe stocké).
   - Cookies de session sécurisés (`httpOnly`, `secure`, `sameSite=strict`).
5. **Fiabilité RAG sans hallucination** :
   - L'agent s'appuie exclusivement sur la base de connaissances officielle du Sénégal (UCAD, UGB, USSEIN, UIDT, UAM, bourses de l'État, Campusen).

---

## 📁 Structure du Projet

```text
app/
├── (auth)/
│   ├── login/page.tsx        # Connexion légère Magic Link
│   └── callback/route.ts     # Échange de code de session Supabase
├── chat/page.tsx             # Interface de chat sobre, mobile-first
├── api/chat/route.ts         # Route Handler serveur (IA + RAG + Sécurité)
├── globals.css               # Styles Tailwind CSS
├── layout.tsx                # Structure HTML5 & métadonnées SEO
└── page.tsx                  # Redirection racine → /chat
lib/
├── supabase/
│   ├── client.ts             # Client Supabase navigateur (@supabase/ssr)
│   └── server.ts             # Client Supabase serveur (cookies stricts & admin)
├── security/
│   ├── sanitize.ts           # Détection & assainissement anti-injection
│   └── rate-limit.ts         # Rate limiter en mémoire côté serveur
├── validation/
│   └── schemas.ts            # Schémas de validation Zod partagés
├── ai.ts                     # Configuration Vercel AI SDK & prompt national
├── rag.ts                    # Recherche sémantique / pgvector & fallback
└── env.ts                    # Validation des variables d'environnement
middleware.ts                 # Rafraîchissement session Supabase (Edge)
scripts/
└── seed.mjs                  # Ingestion données JSON → Supabase
data/
├── etablissements.json       # Établissements d'enseignement supérieur
├── filieres.json             # Filières et formations disponibles
└── concours.json             # Concours d'accès aux grandes écoles
supabase/
└── migrations/
    └── 20240101000000_initial_schema.sql # Schéma SQL, RLS, pgvector & seeds
```

---

## 🚀 Lancement en Local

### 1. Prérequis
- [Node.js](https://nodejs.org/) v18+ ou v20+
- Un compte ou une instance locale [Supabase](https://supabase.com)
- Une clé API [OpenAI](https://platform.openai.com) (optionnelle : un mode local simulé est inclus pour tester immédiatement)

### 2. Installation des dépendances
```bash
npm install
```

### 3. Configuration des variables d'environnement
Copiez le fichier `.env.example` en `.env.local` et renseignez vos clés :
```bash
cp .env.example .env.local
```

Renseignez dans `.env.local` :
```env
NEXT_PUBLIC_SUPABASE_URL=https://votre-projet.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre-cle-anon
SUPABASE_SERVICE_ROLE_KEY=votre-cle-service-role
OPENAI_API_KEY=votre-cle-openai
```

### 4. Application des migrations Supabase
Dans votre console Supabase SQL Editor ou via la CLI Supabase, exécutez le script SQL :
```bash
# Ou copiez le contenu du fichier dans l'éditeur SQL de Supabase :
supabase/migrations/20240101000000_initial_schema.sql
```
Ce script créera :
- L'extension `vector`
- Les tables avec **RLS activée**
- La fonction RPC `match_knowledge`
- Le jeu de données initial du Sénégal (universités publiques, bourses nationales, critères Campusen).

### 5. Démarrage de l'application
```bash
npm run dev
```
Ouvrez ensuite [http://localhost:3000](http://localhost:3000) dans votre navigateur.

---

## 🧪 Tests & Validation

- **Vérification TypeScript strict** :
  ```bash
  npx tsc --noEmit
  ```
- **Démarrage du serveur** :
  ```bash
  npm run dev
  # → http://localhost:3000
  ```
- **Seed des données sénégalaises** (après avoir configuré Supabase) :
  ```bash
  npm run seed
  ```

---

## 📋 Variables d'environnement requises

| Variable | Description | Obligatoire |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de votre projet Supabase | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clé anon public Supabase | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Clé service_role (serveur uniquement) | Pour le seed |
| `OPENAI_API_KEY` | Clé OpenAI pour GPT-4o-mini | Optionnel (mode simulé inclus) |

> **Note** : Sans `OPENAI_API_KEY`, l'application fonctionne en mode simulation locale avec des réponses préconstruites basées sur le RAG sénégalais.

---

## 🔒 Sécurité — Points clés

- ✅ Aucune clé sensible exposée côté client (jamais de `NEXT_PUBLIC_` pour les secrets)
- ✅ RLS activée sur toutes les tables Supabase
- ✅ Rate limiting serveur : 20 req/min/IP
- ✅ Sanitisation anti-prompt injection sur chaque message
- ✅ Validation Zod sur toutes les entrées (formulaires + API)
- ✅ Cookies de session `httpOnly`, `secure`, `sameSite=strict`
- ✅ Magic Link (pas de mot de passe stocké) — protection des mineurs
- ✅ Middleware de rafraîchissement de session sur toutes les routes
