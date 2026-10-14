"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Plus,
  MessageSquare,
  Copy,
  Check,
  RotateCw,
  LogOut,
  User,
  PanelLeftOpen,
  AlertCircle,
  Download,
  Sparkles,
  Paperclip,
  ChevronRight,
  GraduationCap,
  Briefcase,
  Users,
  Calculator,
  Megaphone,
  Box,
  HelpCircle,
  HeartPulse,
  Code,
  Scale,
  Leaf,
  Compass,
  Settings,
  History,
  CheckCheck,
  Sun,
  Moon,
  Languages,
  Smartphone,
  Trash2,
  X,
  Share2,
} from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { createClient } from "@/lib/supabase/client";
import {
  ConversationProfile,
  INITIAL_PROFILE,
  mergeProfileUpdate,
} from "@/lib/profile";

interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

const ETAPE_LABELS: Record<number, string> = {
  1: "Découverte du profil scolaire",
  2: "Exploration des centres d'intérêt",
  3: "Affinement des filières cibles",
  4: "Établissements & critères d'admission",
  5: "Validation & Bilan d'orientation",
};

/**
 * Associe une icône thématique élégante à un chip de suggestion
 */
function getSuggestionIcon(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("santé") || lower.includes("médecine") || lower.includes("soin") || lower.includes("bio")) {
    return HeartPulse;
  }
  if (lower.includes("informatique") || lower.includes("numérique") || lower.includes("techno") || lower.includes("code") || lower.includes("ia")) {
    return Code;
  }
  if (lower.includes("gestion") || lower.includes("finance") || lower.includes("compta") || lower.includes("banque")) {
    return Calculator;
  }
  if (lower.includes("droit") || lower.includes("justice") || lower.includes("politique") || lower.includes("avocat")) {
    return Scale;
  }
  if (lower.includes("commerce") || lower.includes("marketing") || lower.includes("vente") || lower.includes("management")) {
    return Briefcase;
  }
  if (lower.includes("communication") || lower.includes("journalisme") || lower.includes("média") || lower.includes("relation")) {
    return Megaphone;
  }
  if (lower.includes("langue") || lower.includes("traduction") || lower.includes("lettre")) {
    return Languages;
  }
  if (lower.includes("agronomie") || lower.includes("agriculture") || lower.includes("environnement") || lower.includes("eau")) {
    return Leaf;
  }
  if (lower.includes("ingénieur") || lower.includes("btp") || lower.includes("mécani") || lower.includes("industrie")) {
    return Box;
  }
  if (lower.includes("enseign") || lower.includes("social") || lower.includes("humain") || lower.includes("aide")) {
    return Users;
  }
  if (lower.includes("je ne sais pas") || lower.includes("indécis") || lower.includes("hésite")) {
    return HelpCircle;
  }
  return Compass;
}

/**
 * Nettoie le markdown en retirant les emojis pour un rendu académique
 */
function formatText(text: string): string {
  if (!text) return "";
  return text.replace(
    /[\u{1F300}-\u{1F9FF}\u{1FA00}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu,
    ""
  );
}

/**
 * Placeholder court et adaptatif pour mobile selon l'étape d'orientation
 */
function getPlaceholderForEtape(etape: number, prenom?: string | null): string {
  if (etape === 1 && (!prenom || prenom === "l'ami")) {
    return "Écris ton prénom…";
  }
  if (etape === 1) {
    return "Écris ton niveau ou ta série…";
  }
  if (etape === 2) {
    return "Écris tes centres d'intérêt…";
  }
  if (etape === 3) {
    return "Écris la filière ciblée…";
  }
  if (etape === 4) {
    return "Pose ta question sur une école…";
  }
  return "Écris ta réponse…";
}

/**
 * Texte d'aide sous les chips pour guider l'élève sur mobile
 */
function getSubChipHelpText(etape: number, prenom?: string | null): string {
  if (etape === 1 && (!prenom || prenom === "l'ami")) {
    return "Ou écris simplement ton prénom ci-dessous.";
  }
  return "Ou écris librement ta réponse ci-dessous.";
}

/**
 * Découpe et extrait le contenu proprement même pendant le streaming (élimine les signes bizarres JSON)
 */
function parseAssistantMessage(content: string): {
  reply: string;
  suggestions: string[];
  profil_update?: Partial<ConversationProfile>;
  etape?: number;
} {
  if (!content) return { reply: "", suggestions: [] };
  const trimmed = content.trim();

  // 1. JSON complet strict
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        reply: parsed.reply || "",
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        profil_update: parsed.dossier || parsed.profile || undefined,
        etape: parsed.etape || undefined,
      };
    } catch {
      /* fallback */
    }
  }

  // 2. Bloc de code markdown ```json ... ```
  const jsonMatch = content.match(/```json\s*(\{[\s\S]*?\})\s*```/);
  if (jsonMatch && jsonMatch[1]) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      const cleanReply = content.replace(/```json[\s\S]*?```/, "").trim();
      return {
        reply: cleanReply || parsed.reply || "",
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        profil_update: parsed.dossier || parsed.profile || undefined,
        etape: parsed.etape || undefined,
      };
    } catch {
      /* fallback */
    }
  }

  // 3. Décodage progressif pendant le streaming JSON (évite les accolades, guillemets et préfixes "reply":)
  if (trimmed.startsWith("{") || trimmed.includes('"reply"')) {
    const replyIndex = trimmed.indexOf('"reply"');
    if (replyIndex !== -1) {
      const afterKey = trimmed.slice(replyIndex + 7);
      const colonMatch = afterKey.match(/^\s*:\s*"/);
      if (colonMatch) {
        const textStart = colonMatch[0].length;
        let extracted = "";
        let escaped = false;

        for (let i = textStart; i < afterKey.length; i++) {
          const char = afterKey[i];
          if (escaped) {
            if (char === "n") extracted += "\n";
            else if (char === "t") extracted += "\t";
            else if (char === '"') extracted += '"';
            else if (char === "\\") extracted += "\\";
            else extracted += char;
            escaped = false;
          } else if (char === "\\") {
            escaped = true;
          } else if (char === '"') {
            // Fin de la chaîne reply atteinte
            break;
          } else {
            extracted += char;
          }
        }

        // Tenter d'extraire les suggestions si déjà présentes dans le flux
        let suggestions: string[] = [];
        const sugMatch = trimmed.match(/"suggestions"\s*:\s*\[([\s\S]*?)\]/);
        if (sugMatch && sugMatch[1]) {
          try {
            suggestions = JSON.parse(`[${sugMatch[1]}]`);
          } catch {}
        }

        return {
          reply: extracted,
          suggestions,
        };
      }
    }

    // Le message commence par { mais la clé "reply" n'est pas encore arrivée : cacher les signes bizarres
    return { reply: "", suggestions: [] };
  }

  // 4. Texte ordinaire
  return { reply: content, suggestions: [] };
}

/**
 * Nettoie tout résidu technique avant affichage Markdown
 */
function sanitizeCleanReply(text: string): string {
  if (!text) return "";
  let clean = formatText(text);
  // Retirer tout fragment résiduel de JSON accidentel
  clean = clean.replace(/^{"reply":\s*"?/g, "").replace(/"(?:,\s*"suggestions":[\s\S]*)?$/g, "");
  return clean;
}

/**
 * Composant de rendu Markdown avec typographie contrastée
 */
function BotMessageMarkdown({ content }: { content: string }) {
  const clean = sanitizeCleanReply(content);
  if (!clean.trim()) {
    return (
      <div className="flex items-center gap-1.5 py-1 text-[var(--gold-primary)] text-[13px] font-medium">
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] animate-pulse" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] animate-pulse [animation-delay:200ms]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--gold-primary)] animate-pulse [animation-delay:400ms]" />
      </div>
    );
  }
  return (
    <div className="bot-response-content select-text leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif font-bold text-xl text-[var(--text-main)] mt-4 mb-2 tracking-tight">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif font-bold text-lg text-[var(--text-main)] mt-3.5 mb-1.5 tracking-tight">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif font-semibold text-base text-[var(--text-main)] mt-3 mb-1 tracking-tight">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="mb-3 text-[var(--text-body)] font-medium leading-relaxed last:mb-0">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc pl-5 mb-3 space-y-1 text-[var(--text-body)] font-medium">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 mb-3 space-y-1 text-[var(--text-body)] font-medium">
              {children}
            </ol>
          ),
          li: ({ children }) => <li className="mb-1 leading-normal">{children}</li>,
          strong: ({ children }) => (
            <strong className="font-bold text-[var(--gold-primary)]">{children}</strong>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[var(--gold-primary)] hover:underline font-semibold"
            >
              {children}
            </a>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[var(--gold-primary)] pl-3 my-2 text-[var(--text-muted)] italic">
              {children}
            </blockquote>
          ),
        }}
      >
        {clean}
      </ReactMarkdown>
    </div>
  );
}

const STORAGE_CONVERSATIONS_KEY = "senorientation_chat_conversations_v4";
const STORAGE_ACTIVE_ID_KEY = "senorientation_chat_active_id_v4";
const getStorageConvKey = (id: string) => `senorientation_chat_conv_v4_${id}`;

const INITIAL_WELCOME_PAYLOAD = {
  reply:
    "Bonjour ! Bienvenue sur Jangora, ta plateforme d'orientation scolaire et universitaire. Pour commencer et faire connaissance, comment puis-je t'appeler ?",
  suggestions: [
    "Je préfère ne pas le dire",
  ],
  etape: 1,
};

const NEW_CHAT_WELCOME_PAYLOAD = {
  reply:
    "Bonjour ! Je suis ton conseiller d'orientation Jangora. Où en es-tu actuellement dans tes études ?",
  suggestions: [
    "Collège (3e / BFEM)",
    "Lycée (Seconde)",
    "Lycée (Première)",
    "Terminale",
    "Nouveau bachelier",
    "Étudiant (Supérieur)",
    "En réorientation",
  ],
  etape: 1,
};

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: "1", title: "Orientation Bac Sénégal", date: "Aujourd'hui" },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>("1");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [copiedRecap, setCopiedRecap] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isAppInstalled, setIsAppInstalled] = useState(false);
  const [showIosInstallModal, setShowIosInstallModal] = useState(false);

  // Profil d'orientation progressif
  const [profile, setProfile] = useState<ConversationProfile>(INITIAL_PROFILE);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Synchronisation du thème Sombre / Clair ─────────────────────── */
  useEffect(() => {
    try {
      const saved = localStorage.getItem("theme") as "dark" | "light" | null;
      const initialTheme = saved || "dark";
      setTheme(initialTheme);
      if (initialTheme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
    } catch {
      /* ignore */
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    try {
      localStorage.setItem("theme", nextTheme);
    } catch {}
    if (nextTheme === "dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  /* ─── PWA Install Listener ────────────────────────────────────────── */
  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    const handleAppInstalled = () => {
      setIsAppInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleAppInstalled);

    if (
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone
    ) {
      setIsAppInstalled(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  const promptInstallPwa = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      try {
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          setDeferredPrompt(null);
          setIsAppInstalled(true);
        }
      } catch {}
      return;
    }

    const isIos =
      /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    if (isIos) {
      setShowIosInstallModal(true);
      return;
    }

    if (isAppInstalled) {
      alert("Jangora est déjà installée sur cet appareil !");
    } else {
      setShowIosInstallModal(true);
    }
  };

  /* ─── useChat Vercel AI SDK ─────────────────────────────────────── */
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit,
    isLoading,
    error,
    setMessages,
    append,
    reload,
  } = useChat({
    api: "/api/chat",
    body: {
      conversationId: activeConvId,
      profile,
    },
    initialMessages: [
      {
        id: "welcome-1",
        role: "assistant",
        content: JSON.stringify(INITIAL_WELCOME_PAYLOAD),
      },
    ],
  });

  /* ─── 1. Restauration locale au démarrage (Évite l'effacement à l'actualisation) ─── */
  useEffect(() => {
    try {
      const storedConvs = localStorage.getItem(STORAGE_CONVERSATIONS_KEY);
      const storedActiveId = localStorage.getItem(STORAGE_ACTIVE_ID_KEY);

      if (storedConvs) {
        const parsedConvs: ConversationItem[] = JSON.parse(storedConvs);
        if (Array.isArray(parsedConvs) && parsedConvs.length > 0) {
          setConversations(parsedConvs);
          const activeId =
            storedActiveId && parsedConvs.some((c) => c.id === storedActiveId)
              ? storedActiveId
              : parsedConvs[0].id;
          setActiveConvId(activeId);

          const storedData = localStorage.getItem(getStorageConvKey(activeId));
          if (storedData) {
            const { messages: savedMsgs, profile: savedProf } = JSON.parse(storedData);
            if (Array.isArray(savedMsgs) && savedMsgs.length > 0) {
              setMessages(savedMsgs);
            }
            if (savedProf) {
              setProfile(savedProf);
            }
          }
        }
      } else {
        const initConv: ConversationItem = {
          id: "1",
          title: "Orientation Bac Sénégal",
          date: "Aujourd'hui",
        };
        localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify([initConv]));
        localStorage.setItem(STORAGE_ACTIVE_ID_KEY, "1");
        localStorage.setItem(
          getStorageConvKey("1"),
          JSON.stringify({
            messages: [
              {
                id: "welcome-1",
                role: "assistant",
                content: JSON.stringify(INITIAL_WELCOME_PAYLOAD),
              },
            ],
            profile: INITIAL_PROFILE,
          })
        );
      }
    } catch {
      /* ignore */
    } finally {
      setIsLoaded(true);
    }
  }, []);

  /* ─── 2. Sauvegarde automatique persistante ───────────────────────── */
  useEffect(() => {
    if (!isLoaded || messages.length === 0) return;
    try {
      localStorage.setItem(
        getStorageConvKey(activeConvId),
        JSON.stringify({ messages, profile })
      );
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, activeConvId);
    } catch {
      /* ignore */
    }
  }, [messages, profile, activeConvId, isLoaded]);

  /* ─── 3. Titre automatique selon la discussion ───────────────────── */
  useEffect(() => {
    if (!isLoaded) return;
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setConversations((prev) => {
      const updated = prev.map((c) =>
        c.id === activeConvId &&
        (c.title === "Nouvelle discussion" || c.title === "Orientation Bac Sénégal")
          ? {
              ...c,
              title:
                lastUserMsg.content.slice(0, 32) +
                (lastUserMsg.content.length > 32 ? "…" : ""),
            }
          : c
      );
      try {
        localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(updated));
      } catch {}
      return updated;
    });
  }, [messages, activeConvId, isLoaded]);

  /* ─── Synchronisation du profil depuis les annotations ou le JSON ─── */
  useEffect(() => {
    if (messages.length === 0) return;
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistantMsg) return;

    // 1. Lecture depuis les annotations Vercel AI SDK
    const annotations = (lastAssistantMsg as any).annotations;
    if (Array.isArray(annotations) && annotations.length > 0) {
      const lastAnnot = annotations[annotations.length - 1];
      if (lastAnnot && typeof lastAnnot === "object" && (lastAnnot.profile || lastAnnot.etape)) {
        setProfile((prev) => mergeProfileUpdate(prev, lastAnnot.profile, lastAnnot.etape));
        return;
      }
    }

    // 2. Lecture depuis le JSON du message
    const parsed = parseAssistantMessage(lastAssistantMsg.content);
    if (parsed.profil_update || typeof parsed.etape === "number") {
      setProfile((prev) => mergeProfileUpdate(prev, parsed.profil_update, parsed.etape));
    }
  }, [messages]);

  /* ─── Session utilisateur Supabase ───────────────────────────────── */
  useEffect(() => {
    try {
      const supabase = createClient();
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user?.email) setUserEmail(user.email);
      });
    } catch {
      /* non bloquant */
    }
  }, []);

  /* ─── Auto-scroll vers le bas ───────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ─── Redimensionnement automatique du textarea ─────────────────── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        140
      )}px`;
    }
  }, [input]);

  /* ─── Clic sur un choix interactif ───────────────────────────────── */
  const handleSuggestionClick = (suggestionText: string) => {
    setSelectedSuggestion(suggestionText);
    append({
      role: "user",
      content: suggestionText,
    });
  };

  /* ─── Changement de discussion (Persistance active) ───────────────── */
  const handleSelectConversation = (convId: string) => {
    if (convId === activeConvId) {
      setSidebarOpen(false);
      return;
    }

    // 1. Sauvegarder la conversation active courante
    try {
      localStorage.setItem(
        getStorageConvKey(activeConvId),
        JSON.stringify({ messages, profile })
      );
    } catch {}

    // 2. Charger la conversation sélectionnée
    try {
      const stored = localStorage.getItem(getStorageConvKey(convId));
      if (stored) {
        const { messages: savedMsgs, profile: savedProf } = JSON.parse(stored);
        setMessages(savedMsgs || []);
        setProfile(savedProf || INITIAL_PROFILE);
      } else {
        const welcome = {
          id: `welcome-${convId}`,
          role: "assistant" as const,
          content: JSON.stringify(NEW_CHAT_WELCOME_PAYLOAD),
        };
        setMessages([welcome]);
        setProfile(INITIAL_PROFILE);
      }
      setActiveConvId(convId);
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, convId);
    } catch {}
    setSidebarOpen(false);
  };

  /* ─── Nouvelle discussion (Non éphémère, immédiatement enregistrée) ─ */
  const handleNewChat = () => {
    // 1. Sauvegarder d'abord la discussion active actuelle
    try {
      localStorage.setItem(
        getStorageConvKey(activeConvId),
        JSON.stringify({ messages, profile })
      );
    } catch {}

    const newId = `conv_${Date.now()}`;
    const newConv: ConversationItem = {
      id: newId,
      title: "Nouvelle discussion",
      date: "Aujourd'hui",
    };
    const nextList = [newConv, ...conversations];
    setConversations(nextList);
    setActiveConvId(newId);
    setProfile(INITIAL_PROFILE);

    const welcomeMsg = {
      id: `welcome-${newId}`,
      role: "assistant" as const,
      content: JSON.stringify(NEW_CHAT_WELCOME_PAYLOAD),
    };
    setMessages([welcomeMsg]);

    // 2. Sauvegarde immédiate dans localStorage (NON ÉPHÉMÈRE !)
    try {
      localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(nextList));
      localStorage.setItem(STORAGE_ACTIVE_ID_KEY, newId);
      localStorage.setItem(
        getStorageConvKey(newId),
        JSON.stringify({ messages: [welcomeMsg], profile: INITIAL_PROFILE })
      );
    } catch {}

    setSidebarOpen(false);
  };

  /* ─── Suppression d'une discussion ───────────────────────────────── */
  const handleDeleteConversation = (convId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const remaining = conversations.filter((c) => c.id !== convId);
    setConversations(remaining);
    try {
      localStorage.setItem(STORAGE_CONVERSATIONS_KEY, JSON.stringify(remaining));
      localStorage.removeItem(getStorageConvKey(convId));
    } catch {}

    if (convId === activeConvId) {
      if (remaining.length > 0) {
        handleSelectConversation(remaining[0].id);
      } else {
        handleNewChat();
      }
    }
  };

  /* ─── Exporter le bilan en texte (.txt) ──────────────────────────── */
  const exportSummary = () => {
    const recap = `========================================================
FICHE OFFICIELLE D'ORIENTATION - JANGORA
Plateforme nationale d'orientation académique du Sénégal
========================================================

1. INFORMATIONS SUR L'ÉLÈVE
--------------------------------------------------------
- Prénom / Identité        : ${profile.prenom || "Non précisé"}
- Série de Bac             : ${profile.serie || "Non précisée"}
- Niveau scolaire          : ${profile.niveau || "Non précisé"}
- Moyenne déclarée         : ${profile.moyenne ? `${profile.moyenne}/20` : "Non précisée"}

2. CENTRES D'INTÉRÊT & COMPÉTENCES
--------------------------------------------------------
- Centres d'intérêt majeurs: ${profile.interets_principaux.join(", ") || "En cours d'exploration"}
- Matières de prédilection : ${profile.matieres_aimees.join(", ") || "Généralistes"}
- Points forts identifiés  : ${profile.points_forts.join(", ") || "À affiner"}

3. PROJET & CRITÈRES D'ÉTUDES
--------------------------------------------------------
- Filière visée            : ${profile.projet || "Non arrêtée"}
- Ville souhaitée          : ${profile.ville || "Sénégal (Dakar, Saint-Louis, Thiès...)"}
- Type d'établissement     : ${profile.budget || "Public Campusen (25 000 FCFA/an)"}
- Durée souhaitée          : ${profile.duree_souhaitee || "2 à 5 ans"}

Document généré automatiquement sur Jangora
Conforme aux arrêtés du Ministère de l'Enseignement Supérieur (MESRI).`;

    const blob = new Blob([recap], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bilan_orientation_${(profile.prenom || "eleve").toLowerCase()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  /* ─── Copier la synthèse dans le presse-papier ───────────────────── */
  const copyRecap = () => {
    const txt = `Bilan Jangora :
- Élève : ${profile.prenom || "Élève"}
- Série : ${profile.serie || "Non précisée"}
- Intérêts : ${profile.interets_principaux.join(", ")}
- Projet : ${profile.projet || "En cours"}`;
    navigator.clipboard.writeText(txt);
    setCopiedRecap(true);
    setTimeout(() => setCopiedRecap(false), 2000);
  };

  /* ─── Gestion de la touche Entrée pour soumettre ─────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      setSelectedSuggestion(null);
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  /* ─── Copier le message ──────────────────────────────────────────── */
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const currentConversation = conversations.find((c) => c.id === activeConvId);
  const headerTitle = currentConversation?.title || "Orientation Bac Sénégal";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--bg-app)] text-[var(--text-main)] font-sans antialiased">
      {/* ════════════════════════════════════════════
          PANNEAU LATÉRAL (TIROIR 326PX SUR MOBILE)
      ════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs md:hidden transition-opacity"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-[326px] max-w-[88vw] md:w-[280px] bg-[var(--bg-sidebar)] border-r border-[var(--border-main)] shadow-2xl md:shadow-sm transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 1. En-tête : Nouveau Logo (JANGORA avec GORA en doré #A8812F) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-main)] bg-[var(--bg-sidebar)]">
          <div className="flex items-center gap-3">
            <BrandLogo size={40} variant="auto" />
            <div className="flex flex-col">
              <span className="font-serif font-bold text-[19px] tracking-widest uppercase leading-tight">
                <span className="text-[var(--text-main)]">JAN</span>
                <span className="text-[#A8812F] dark:text-[#E9D5A1]">GORA</span>
              </span>
              <span className="text-[10.5px] text-[var(--text-muted)] font-medium tracking-tight mt-0.5">
                L&apos;orientation vers le savoir
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-xl md:hidden transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 stroke-[2]" />
          </button>
        </div>

        {/* 2. Bouton « Nouvelle discussion » pleine largeur (52px de haut) */}
        <div className="p-4 border-b border-[var(--border-main)]">
          <button
            onClick={handleNewChat}
            className="w-full h-[52px] flex items-center justify-between px-4 text-[14.5px] font-bold text-white bg-[#1B5E57] hover:brightness-105 active:scale-[0.99] dark:bg-[#E9D5A1] dark:text-[#0D2928] rounded-[14px] shadow-sm transition-all duration-150 cursor-pointer group"
          >
            <div className="flex items-center gap-3">
              <MessageSquare className="w-5 h-5 stroke-[2]" />
              <span>Nouvelle discussion</span>
            </div>
            <ChevronRight className="w-4.5 h-4.5 opacity-80 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* 3. Carte de Progression de l'orientation (5 étapes) */}
        <div className="p-4 border-b border-[var(--border-main)] bg-[var(--bg-sidebar)]">
          <div className="p-3.5 bg-[var(--gold-light)] rounded-xl border border-[var(--gold-border)] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-[var(--gold-primary)] border-t-transparent animate-spin-slow flex items-center justify-center shrink-0" />
                <span className="font-bold text-[13px] text-[var(--text-main)]">
                  Progression
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[var(--bg-card)] text-[var(--gold-primary)] border border-[var(--gold-border)] shadow-2xs">
                Étape {profile.etape}/5
              </span>
            </div>

            <p className="text-[12px] font-medium text-[var(--text-muted)]">
              {ETAPE_LABELS[profile.etape] || "Orientation en cours"}
            </p>

            {/* Barre segmentée en 5 paliers */}
            <div className="flex items-center gap-1.5 pt-0.5" aria-label="Progression par étapes">
              {[1, 2, 3, 4, 5].map((step) => {
                const isPassed = step <= profile.etape;
                return (
                  <div
                    key={step}
                    className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                      isPassed ? "bg-[var(--gold-primary)]" : "bg-[var(--border-main)] opacity-50"
                    }`}
                    title={`Étape ${step} : ${ETAPE_LABELS[step]}`}
                  />
                );
              })}
            </div>

            {/* Fiche résumé de l'élève */}
            <div className="pt-2 border-t border-[var(--gold-border)] text-[12px] text-[var(--text-main)] flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[var(--gold-primary)] shrink-0" />
              <span className="font-medium text-[var(--text-muted)]">Élève :</span>
              <strong className="text-[var(--text-main)] truncate">
                {profile.prenom && profile.prenom !== "l'ami"
                  ? profile.prenom
                  : "Ibrahima"}
              </strong>
            </div>
          </div>
        </div>

        {/* 4. Historique des discussions */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
            <History className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
            <span>Historique</span>
          </div>

          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            return (
              <div
                key={conv.id}
                onClick={() => handleSelectConversation(conv.id)}
                className={`group/conv w-full flex items-center justify-between px-3 py-2.5 text-[13.5px] rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-[var(--gold-light)] text-[var(--gold-primary)] font-bold border-l-[3px] border-[var(--gold-primary)] shadow-2xs"
                    : "text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1 pr-1">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"
                    }`}
                  />
                  <span className="truncate">{conv.title}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {conversations.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleDeleteConversation(conv.id, e)}
                      title="Supprimer la discussion"
                      className="p-1 rounded-md text-[var(--text-muted)] hover:text-red-500 hover:bg-black/10 dark:hover:bg-white/10 opacity-70 sm:opacity-0 group-hover/conv:opacity-100 transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {isActive && (
                    <ChevronRight className="w-3.5 h-3.5 text-[var(--gold-primary)] shrink-0" />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 5. Pied de sidebar : Installer l'app, Paramètres, Mode sombre switch, Connexion */}
        <div className="p-3 border-t border-[var(--border-main)] bg-[var(--bg-sidebar)] space-y-2">
          {/* Bouton Installer PWA */}
          <button
            type="button"
            onClick={promptInstallPwa}
            className="w-full flex items-center justify-between px-3 py-2.5 text-[13px] font-bold text-[#1B5E57] dark:text-[#E9D5A1] bg-[var(--gold-light)] hover:brightness-105 border border-[var(--gold-border)] rounded-xl transition-all cursor-pointer shadow-2xs"
            title="Installer l'application progressive sur votre smartphone"
          >
            <div className="flex items-center gap-2.5">
              <Smartphone className="w-4.5 h-4.5 text-[#1B5E57] dark:text-[#E9D5A1] stroke-[2]" />
              <span>{isAppInstalled ? "Application installée" : "Installer l'app mobile"}</span>
            </div>
            {!isAppInstalled && <Download className="w-4 h-4 text-[#1B5E57] dark:text-[#E9D5A1] stroke-[2]" />}
          </button>

          {/* Bouton Paramètres */}
          <button
            onClick={() => {}}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-muted)] hover:text-[#1B5E57] dark:hover:text-[#E9D5A1] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 stroke-[2]" />
            <span>Paramètres</span>
          </button>

          {/* Interrupteur « Mode sombre » avec role="switch" */}
          <div
            onClick={toggleTheme}
            role="switch"
            aria-checked={theme === "dark"}
            aria-label="Basculer le mode sombre"
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors cursor-pointer select-none"
          >
            <div className="flex items-center gap-2.5 text-[13px] text-[var(--text-muted)] font-medium">
              {theme === "dark" ? (
                <Moon className="w-4 h-4 text-[#E9D5A1] stroke-[2]" />
              ) : (
                <Sun className="w-4 h-4 text-[#1B5E57] stroke-[2]" />
              )}
              <span>Mode sombre</span>
            </div>
            <div
              className={`w-11 h-6 flex items-center rounded-full p-0.5 transition-colors duration-200 ${
                theme === "dark" ? "bg-[#1B5E57]" : "bg-[#DDE6DF]"
              }`}
            >
              <div
                className={`bg-white w-5 h-5 rounded-full shadow-md transform transition-transform duration-200 ${
                  theme === "dark" ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </div>
          </div>

          {/* Connexion / Déconnexion */}
          {userEmail ? (
            <div className="flex items-center justify-between px-3 py-2 text-[13px] text-[var(--text-main)] rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)]">
              <span className="truncate max-w-[190px]">{userEmail}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
                title="Se déconnecter"
                className="text-[var(--text-muted)] hover:text-red-500 p-1.5 rounded-md transition-colors"
              >
                <LogOut className="w-4 h-4 stroke-[2]" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-muted)] hover:text-[#1B5E57] dark:hover:text-[#E9D5A1] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-[#1B5E57] dark:text-[#E9D5A1] stroke-[2]" />
              <span>Connexion élève</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE CENTRALE DU CHAT
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)] relative">
        {/* Motif décoratif en filigrane discret (Jangora Baobab) */}
        <div
          className="pointer-events-none absolute bottom-16 right-0 w-80 h-80 opacity-[0.035] select-none z-0 flex items-center justify-center overflow-hidden"
          aria-hidden="true"
        >
          <img
            src="/jangora-symbol-gold.png"
            alt=""
            className="w-full h-full object-contain hidden dark:block"
          />
          <img
            src="/jangora-symbol-green.png"
            alt=""
            className="w-full h-full object-contain block dark:hidden"
          />
        </div>

        {/* 1. Barre supérieure (Topbar épurée : 3 éléments sur mobile) */}
        <header className="shrink-0 h-16 border-b border-[var(--border-main)] px-3 sm:px-8 flex items-center justify-between bg-[var(--bg-app)]/90 backdrop-blur-md z-10 sticky top-0">
          {/* 1. Bouton Menu gauche (44×44px sur mobile, 14px rounded) */}
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Ouvrir le menu"
            className="w-11 h-11 flex items-center justify-center text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-[14px] border border-[var(--border-main)] md:border-0 md:rounded-xl md:w-auto md:h-auto md:p-2 shrink-0 transition-colors cursor-pointer"
          >
            <PanelLeftOpen className="w-5 h-5 stroke-[2]" />
          </button>

          {/* 2. Titre + Sous-titre au centre sur mobile, aligné à gauche sur desktop */}
          <div className="flex flex-col items-center md:items-start min-w-0 flex-1 px-2 md:px-3 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 w-full max-w-[280px] md:max-w-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Conseiller en ligne" />
              <h1 className="font-serif font-bold text-[18px] sm:text-[19px] md:text-[20px] text-[var(--text-main)] tracking-tight truncate leading-tight">
                {headerTitle}
              </h1>
            </div>
            <p className="text-[12.5px] sm:text-[13px] font-medium text-[var(--text-muted)] truncate max-w-[240px] sm:max-w-none mt-0.5">
              <span className="md:hidden">Conseiller d&apos;orientation officiel</span>
              <span className="hidden md:inline">Des conseils personnalisés pour construire ton avenir</span>
            </p>
          </div>

          {/* 3. Côté droit : sur mobile (≤480px), SEULEMENT le bouton "+" 44×44px ! */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Bouton "+" mobile 44×44px */}
            <button
              onClick={handleNewChat}
              aria-label="Nouvelle discussion"
              className="w-11 h-11 flex items-center justify-center rounded-[14px] bg-[#1B5E57] text-white hover:brightness-105 active:scale-95 dark:bg-[#E9D5A1] dark:text-[#0D2928] shadow-xs md:hidden transition-all cursor-pointer shrink-0"
              title="Nouvelle discussion"
            >
              <Plus className="w-5 h-5 stroke-[2]" />
            </button>

            {/* Éléments conservés pour Desktop (md:flex) */}
            <button
              type="button"
              onClick={promptInstallPwa}
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-bold text-[var(--gold-primary)] bg-[var(--gold-light)] hover:brightness-105 active:scale-95 border border-[var(--gold-border)] rounded-xl shadow-2xs transition-all cursor-pointer"
              title="Installer Jangora sur votre ordinateur ou téléphone"
            >
              <Smartphone className="w-4 h-4 text-[var(--gold-primary)]" />
              <span>{isAppInstalled ? "App installée" : "Installer l'app"}</span>
            </button>

            <div className="hidden md:inline-flex items-center gap-2 text-[12px] text-[var(--gold-primary)] bg-[var(--gold-light)] px-3 py-1 rounded-full border border-[var(--gold-border)] font-bold">
              <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-pulse" />
              <span>
                Étape {profile.etape}/5 : {ETAPE_LABELS[profile.etape]}
              </span>
            </div>

            <button
              onClick={handleNewChat}
              className="hidden md:flex items-center gap-1 px-3 py-1.5 text-[12.5px] font-bold text-[var(--btn-primary-text)] bg-[var(--btn-primary-bg)] hover:brightness-110 active:scale-95 rounded-xl shadow-xs transition-colors cursor-pointer"
              title="Nouvelle discussion"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau</span>
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              className="hidden md:flex p-2 text-[var(--text-muted)] hover:text-[var(--brand-green)] dark:hover:text-[var(--brand-sand)] hover:bg-[var(--bg-hover)] rounded-xl border border-[var(--border-main)] transition-colors cursor-pointer"
              title={theme === "dark" ? "Passer en mode jour (lumineux)" : "Passer en mode nuit (profond)"}
              aria-label="Changer le mode de couleur"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-[#E9D5A1]" />
              ) : (
                <Moon className="w-4 h-4 text-[#155E59]" />
              )}
            </button>

            <div className="w-8 h-8 rounded-full bg-[var(--gold-light)] border border-[var(--gold-border)] hidden md:flex items-center justify-center text-[var(--gold-primary)] font-bold text-[12px]">
              <User className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* Carte de Progression Mobile compacte (Écrans ≤ 480px / md:hidden) */}
        <div className="block md:hidden px-3 pt-2.5 pb-1 shrink-0 z-10">
          <div className="bg-[#E6F0EC] dark:bg-[#133532] border border-[#C5D9D3]/70 dark:border-[#2B514B] rounded-[16px] px-3.5 py-2.5 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-[13px] text-[#1B5E57] dark:text-[#E9D5A1] shrink-0">
                Étape {profile.etape} sur 5
              </span>
              <span className="text-[12px] font-medium text-[#46615B] dark:text-[#C8D7D0] truncate text-right">
                {ETAPE_LABELS[profile.etape] || "Orientation en cours"}
              </span>
            </div>
            {/* 5 segments de 6px de haut */}
            <div className="flex items-center gap-1.5 pt-2" aria-label={`Progression : Étape ${profile.etape} sur 5`}>
              {[1, 2, 3, 4, 5].map((step) => {
                const isPassed = step <= profile.etape;
                return (
                  <div
                    key={step}
                    className={`h-[6px] flex-1 rounded-full transition-all duration-300 ${
                      isPassed
                        ? "bg-[#1B5E57] dark:bg-[#E9D5A1]"
                        : "bg-[#C5D9D3] dark:border dark:bg-[#2B514B]"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>

        {/* 2. Zone de discussion défilante (Conteneur max 780px) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 md:py-8 bg-[var(--bg-app)] z-10">
          <div className="max-w-[780px] mx-auto space-y-6">

            {/* Fiche Bilan Finale si Étape 5 */}
            {profile.etape === 5 && (
              <div className="p-5 bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-2xl shadow-xs space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[var(--gold-primary)]" />
                    <h2 className="font-serif font-bold text-[17px] text-[var(--text-main)] tracking-tight">
                      Fiche de Synthèse d&apos;Orientation (Étape 5/5)
                    </h2>
                  </div>
                  <span className="text-[12px] bg-[var(--bg-card)] text-[var(--gold-primary)] font-bold px-2.5 py-0.5 rounded-full border border-[var(--gold-border)]">
                    Dossier validé
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13.5px] bg-[var(--bg-card)] p-4 rounded-xl border border-[var(--border-main)] shadow-2xs">
                  {profile.prenom && profile.prenom !== "l'ami" && (
                    <div>
                      <span className="text-[var(--text-muted)] block text-[11.5px] font-medium">Élève</span>
                      <strong className="text-[var(--text-main)]">{profile.prenom}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11.5px] font-medium">Série de Bac</span>
                    <strong className="text-[var(--text-main)]">{profile.serie || "Non précisée"}</strong>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11.5px] font-medium">Moyenne estimée</span>
                    <strong className="text-[var(--text-main)]">
                      {profile.moyenne ? `${profile.moyenne}/20` : "Non précisée"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11.5px] font-medium">Matières de prédilection</span>
                    <span className="text-[var(--text-body)]">
                      {profile.matieres_aimees.length > 0
                        ? profile.matieres_aimees.join(", ")
                        : "Généralistes"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[var(--text-muted)] block text-[11.5px] font-medium">Filière / Projet ciblé</span>
                    <strong className="text-[var(--gold-primary)]">
                      {profile.projet || "En cours de validation finale"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11.5px] font-medium">Ville souhaitée</span>
                    <span className="text-[var(--text-body)]">{profile.ville || "Sénégal (Dakar, Thiès...)"}</span>
                  </div>
                  <div>
                    <span className="text-[var(--text-muted)] block text-[11.5px] font-medium">Frais universitaires</span>
                    <span className="text-[var(--text-body)]">
                      {profile.budget || "Public Campusen (25 000 FCFA/an)"}
                    </span>
                  </div>
                </div>

                {/* Boutons d'export */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={exportSummary}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-bold bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] rounded-xl shadow-xs hover:brightness-110 transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger la fiche (.txt)</span>
                  </button>

                  <button
                    onClick={copyRecap}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[var(--text-main)] bg-[var(--bg-card)] hover:bg-[var(--bg-hover)] border border-[var(--border-main)] rounded-xl shadow-2xs transition-colors cursor-pointer"
                  >
                    {copiedRecap ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-500" />
                        <span className="text-emerald-500 font-semibold">Copié dans le presse-papier</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[var(--text-muted)]" />
                        <span>Copier la synthèse</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Fil des messages de conversation */}
            {messages.map((msg, index) => {
              const isBot = msg.role === "assistant";
              const isLast = index === messages.length - 1;

              if (isBot) {
                const parsed = parseAssistantMessage(msg.content);

                return (
                  <div key={msg.id} className="flex items-start gap-3 group pt-1 animate-fadeIn">
                    {/* Avatar officiel rond de 36px (Palette Baobab Jangora) */}
                    <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 mt-0.5 bg-[var(--bg-card)] border border-[var(--border-main)] flex items-center justify-center p-0.5 shadow-xs">
                      <BrandLogo size={32} variant="auto" />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Carte du message assistant : bulle blanche 16px / interligne 1.55, coin haut gauche peu arrondi 6px, autres 20px */}
                      <div className="bg-white dark:bg-[#143735] text-[15px] sm:text-[16px] leading-[1.55] border border-[#DDE6DF] dark:border-[#2B514B] rounded-[20px] rounded-tl-[6px] p-4 sm:p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
                        <BotMessageMarkdown content={parsed.reply || msg.content} />
                      </div>

                      {/* Choix de réponses interactifs (Chips 48px avec bordure verte claire + texte d'aide) */}
                      {parsed.suggestions && parsed.suggestions.length > 0 && (
                        <div className="mt-3 flex flex-col items-start gap-2">
                          <div className="flex flex-wrap gap-2">
                            {parsed.suggestions.map((sug, sIdx) => {
                              const SuggestionIcon = getSuggestionIcon(sug);
                              const isSelected = selectedSuggestion === sug;

                              return (
                                <button
                                  key={sIdx}
                                  onClick={() => handleSuggestionClick(sug)}
                                  disabled={isLoading}
                                  className={`h-12 min-h-[48px] text-left text-[14px] font-medium px-4 rounded-[14px] border-[1.5px] flex items-center gap-2.5 transition-all duration-150 cursor-pointer shadow-2xs ${
                                    isSelected
                                      ? "bg-[#1B5E57] text-white border-[#1B5E57] dark:bg-[#E9D5A1] dark:text-[#0D2928] dark:border-[#E9D5A1] shadow-xs font-semibold"
                                      : "bg-white dark:bg-[#143735] text-[var(--text-main)] border-[#C8DED5] dark:border-[#2B514B] hover:border-[#1B5E57] dark:hover:border-[#E9D5A1]"
                                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                                >
                                  <SuggestionIcon
                                    className={`w-4 h-4 shrink-0 stroke-[2] ${
                                      isSelected
                                        ? "text-white dark:text-[#0D2928]"
                                        : "text-[#1B5E57] dark:text-[#E9D5A1]"
                                    }`}
                                  />
                                  <span>{sug}</span>
                                </button>
                              );
                            })}
                          </div>
                          {/* Aide sous le chip */}
                          <p className="text-[12px] text-[var(--text-muted)] italic pl-1 flex items-center gap-1.5 pt-0.5">
                            <span>{getSubChipHelpText(profile.etape, profile.prenom)}</span>
                          </p>
                        </div>
                      )}

                      {/* Actions copier / régénérer au survol */}
                      <div className="mt-2 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(parsed.reply || msg.content, msg.id)}
                          className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--gold-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors cursor-pointer"
                          title="Copier la réponse"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-500" />
                              <span className="text-emerald-500">Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>

                        {isLast && (
                          <button
                            onClick={() => reload()}
                            disabled={isLoading}
                            className="flex items-center gap-1.5 text-[12px] text-[var(--text-muted)] hover:text-[var(--gold-primary)] px-2 py-1 rounded-md hover:bg-[var(--bg-hover)] transition-colors disabled:opacity-40 cursor-pointer"
                            title="Régénérer"
                          >
                            <RotateCw className="w-3.5 h-3.5" />
                            <span>Régénérer</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              }

              /* ─── Message Utilisateur ─── */
              return (
                <div key={msg.id} className="flex flex-col items-end pt-1 animate-fadeIn">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-[var(--user-bubble-bg)] text-[var(--user-bubble-text)] border border-[var(--border-main)] rounded-2xl rounded-tr-xs px-4 sm:px-5 py-3 text-[14.5px] font-medium leading-relaxed shadow-xs">
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-[var(--user-bubble-meta)] mt-1 mr-1">
                    <span>{new Date(msg.createdAt || Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-[var(--gold-primary)]" />
                  </div>
                </div>
              );
            })}

            {/* Indicateur de réflexion */}
            {isLoading && (
              <div className="flex items-center gap-3.5 pt-1 animate-fadeIn">
                <div className="shrink-0">
                  <BrandLogo size={28} variant="auto" />
                </div>
                <div className="bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-2xl px-4 py-2.5 text-[13.5px] text-[var(--gold-primary)] flex items-center gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-ping" />
                  <span className="font-semibold">Jangora analyse tes informations...</span>
                </div>
              </div>
            )}

            {/* Alerte d'erreur */}
            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[13.5px] flex items-start gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-red-500 shrink-0 mt-0.5" />
                <p>
                  Une erreur temporaire est survenue lors de l&apos;envoi. Merci de vérifier votre connexion et de réessayer.
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 3. Barre de saisie pilule blanche 56px avec safe-area pour mobile */}
        <div className="shrink-0 px-3 pt-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] sm:p-5 bg-[var(--bg-app)]/95 backdrop-blur-md border-t border-[var(--border-main)] z-10">
          <div className="max-w-[780px] mx-auto">
            <form
              onSubmit={(e) => {
                setSelectedSuggestion(null);
                handleSubmit(e);
              }}
              className="flex items-center gap-1.5 sm:gap-2 bg-white dark:bg-[#143735] border-[1.5px] border-[#D9D5C8] dark:border-[#2B514B] rounded-[28px] h-14 min-h-[56px] px-2 shadow-xs focus-within:border-[#1B5E57] dark:focus-within:border-[#E9D5A1] transition-all"
            >
              {/* Bouton trombone / pièce jointe (44px tactile, visible sur mobile !) */}
              <button
                type="button"
                aria-label="Joindre un document"
                className="w-11 h-11 flex items-center justify-center text-[var(--text-muted)] hover:text-[#1B5E57] dark:hover:text-[#E9D5A1] hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors cursor-pointer shrink-0"
                title="Joindre un document"
              >
                <Paperclip className="w-5 h-5 stroke-[2]" />
              </button>

              {/* Champ texte avec police 16px (évite le zoom sur iOS) */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={getPlaceholderForEtape(profile.etape, profile.prenom)}
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 text-[16px] font-medium text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none resize-none leading-normal py-2 max-h-28"
              />

              {/* Bouton d'envoi rond 44px en vert #1B5E57 (ou doré en nuit) */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className={`w-11 h-11 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs ${
                  input.trim() && !isLoading
                    ? "bg-[#1B5E57] text-white hover:brightness-105 active:scale-95 dark:bg-[#E9D5A1] dark:text-[#0D2928]"
                    : "bg-[#DDE6DF] text-[#7E938E] dark:bg-[#2B514B] dark:text-[#55645F] cursor-not-allowed"
                }`}
              >
                <Send className="w-4.5 h-4.5 stroke-[2]" />
              </button>
            </form>

            {/* Pied de page sur UNE SEULE ligne, 12px, contraste suffisant */}
            <p className="mt-2 text-center text-[12px] font-medium text-[var(--text-muted)] truncate px-2">
              Filières officielles ·{" "}
              <a
                href="https://campusen.sec.gouv.sn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#1B5E57] dark:text-[#E9D5A1] hover:underline font-semibold"
              >
                campusen.sec.gouv.sn
              </a>
            </p>
          </div>
        </div>
      </main>

      {/* ════════════════════════════════════════════
          MODAL D'INSTALLATION PWA (iOS & NAVIGATEURS)
      ════════════════════════════════════════════ */}
      {showIosInstallModal && (
        <div
          onClick={() => setShowIosInstallModal(false)}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-3 sm:p-4 animate-fadeIn"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] bg-[var(--bg-card)] border border-[var(--gold-border)] rounded-3xl p-5 shadow-2xl space-y-4 animate-slideUp"
          >
            <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[var(--gold-light)] border border-[var(--gold-border)]">
                  <Smartphone className="w-5 h-5 text-[var(--gold-primary)]" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-[16px] text-[var(--text-main)]">
                    Installer Jangora
                  </h3>
                  <p className="text-[11.5px] text-[var(--text-muted)]">
                    Application mobile rapide & hors-ligne
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowIosInstallModal(false)}
                className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-[13px] text-[var(--text-body)]">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)]">
                <div className="w-6 h-6 rounded-full bg-[var(--gold-light)] text-[var(--gold-primary)] font-bold text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  Appuyez sur l&apos;icône <strong>Partager</strong>{" "}
                  <Share2 className="inline w-3.5 h-3.5 text-[var(--gold-primary)] mx-1" />{" "}
                  dans la barre de votre navigateur (Safari ou Chrome).
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)]">
                <div className="w-6 h-6 rounded-full bg-[var(--gold-light)] text-[var(--gold-primary)] font-bold text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  Faites défiler la liste vers le bas et touchez{" "}
                  <strong>Sur l&apos;écran d&apos;accueil</strong>.
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-[var(--bg-app)] border border-[var(--border-main)]">
                <div className="w-6 h-6 rounded-full bg-[var(--gold-light)] text-[var(--gold-primary)] font-bold text-[12px] flex items-center justify-center shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  Touchez <strong>Ajouter</strong> en haut à droite. Jangora apparaîtra comme une vraie application sur votre écran !
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowIosInstallModal(false)}
              className="w-full py-2.5 text-[13.5px] font-bold text-[var(--btn-primary-text)] bg-[var(--btn-primary-bg)] hover:brightness-110 active:scale-98 rounded-xl transition-all cursor-pointer shadow-xs"
            >
              C&apos;est compris !
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
