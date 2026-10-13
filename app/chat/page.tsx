"use client";

import { useState, useRef, useEffect } from "react";
import Image from "next/image";
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
} from "lucide-react";
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
 * Découpe et extrait le JSON technique si l'assistant renvoie une structure enrichie
 */
function parseAssistantMessage(content: string): {
  reply: string;
  suggestions: string[];
  profil_update?: Partial<ConversationProfile>;
  etape?: number;
} {
  try {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const parsed = JSON.parse(trimmed);
      return {
        reply: parsed.reply || "",
        suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
        profil_update: parsed.dossier || parsed.profile || undefined,
        etape: parsed.etape || undefined,
      };
    }
  } catch {
    /* fallback texte brut */
  }

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

  return { reply: content, suggestions: [] };
}

/**
 * Composant de rendu Markdown avec typographie contrastée
 */
function BotMessageMarkdown({ content }: { content: string }) {
  const clean = formatText(content);
  return (
    <div className="bot-response-content select-text leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="font-serif font-bold text-xl text-[var(--text-main)] mt-4 mb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="font-serif font-bold text-lg text-[var(--text-main)] mt-3.5 mb-1.5">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="font-serif font-semibold text-base text-[var(--text-main)] mt-3 mb-1">
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
        id: "welcome",
        role: "assistant",
        content: JSON.stringify({
          reply:
            "Bonjour ! Bienvenue sur SenOrientation, ta plateforme d'orientation académique et universitaire. Pour commencer et faire connaissance, comment puis-je t'appeler ?",
          suggestions: [
            "Je préfère ne pas le dire",
          ],
          etape: 1,
        }),
      },
    ],
  });

  /* ─── Synchronisation du profil depuis les annotations ou le JSON ─── */
  useEffect(() => {
    if (messages.length === 0) return;
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistantMsg) return;

    // 1. Lecture depuis les annotations Vercel AI SDK (stream data)
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

  /* ─── Titre automatique selon la discussion ──────────────────────── */
  useEffect(() => {
    const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUserMsg) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId && c.title === "Nouvelle discussion"
          ? {
              ...c,
              title:
                lastUserMsg.content.slice(0, 30) +
                (lastUserMsg.content.length > 30 ? "…" : ""),
            }
          : c
      )
    );
  }, [messages, activeConvId]);

  /* ─── Clic sur un choix interactif ───────────────────────────────── */
  const handleSuggestionClick = (suggestionText: string) => {
    setSelectedSuggestion(suggestionText);
    append({
      role: "user",
      content: suggestionText,
    });
  };

  /* ─── Nouvelle discussion ────────────────────────────────────────── */
  const handleNewChat = () => {
    const newId = String(Date.now());
    const newConv: ConversationItem = {
      id: newId,
      title: "Nouvelle discussion",
      date: "Aujourd'hui",
    };
    setConversations([newConv, ...conversations]);
    setActiveConvId(newId);
    setProfile(INITIAL_PROFILE);
    setMessages([
      {
        id: `welcome-${newId}`,
        role: "assistant",
        content: JSON.stringify({
          reply:
            "Bonjour ! Je suis ton conseiller d'orientation SenOrientation. Où en es-tu actuellement dans tes études ?",
          suggestions: [
            "Collège (3e / BFEM)",
            "Lycée (Seconde ou 1ère)",
            "Terminale ou Nouveau bachelier",
            "Étudiant ou Réorientation",
          ],
          etape: 1,
        }),
      },
    ]);
    setSidebarOpen(false);
  };

  /* ─── Exporter le bilan en texte (.txt) ──────────────────────────── */
  const exportSummary = () => {
    const recap = `========================================================
FICHE OFFICIELLE D'ORIENTATION - SENORIENTATION
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

Document généré automatiquement sur SenOrientation
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
    const txt = `Bilan SenOrientation :
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
          PANNEAU LATÉRAL (SIDEBAR)
      ════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] bg-[var(--bg-sidebar)] border-r border-[var(--border-main)] shadow-sm transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 1. En-tête : Nouveau Logo (Boussole stellaire or sans bordures blanches) */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-main)] bg-[var(--bg-sidebar)]">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 shrink-0 rounded-xl overflow-hidden shadow-xs">
              <Image
                src="/logo.png"
                alt="Logo SenOrientation"
                fill
                sizes="40px"
                priority
                className="object-contain"
              />
            </div>
            <div className="flex flex-col">
              <span className="font-serif font-bold text-[18px] tracking-tight leading-tight">
                <span className="text-[var(--text-main)]">Sen</span>
                <span className="text-[var(--gold-primary)]">Orientation</span>
              </span>
              <span className="text-[10.5px] text-[var(--text-muted)] font-medium tracking-tight mt-0.5">
                Ton avenir, notre boussole
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="p-1.5 text-[var(--text-muted)] hover:text-[var(--gold-primary)] rounded-md hover:bg-[var(--bg-hover)] md:hidden transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* 2. Bouton Nouvelle discussion */}
        <div className="p-4 border-b border-[var(--border-main)]">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-between py-2.5 px-4 text-[14px] font-bold text-[var(--btn-primary-text)] bg-[var(--btn-primary-bg)] hover:brightness-110 active:scale-[0.99] rounded-xl shadow-[0_2px_12px_rgba(245,197,66,0.18)] transition-all duration-150 cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4" />
              <span>Nouvelle discussion</span>
            </div>
            <ChevronRight className="w-4 h-4 opacity-75 group-hover:translate-x-0.5 transition-transform" />
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
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 text-[13.5px] rounded-xl text-left transition-all cursor-pointer ${
                  isActive
                    ? "bg-[var(--gold-light)] text-[var(--gold-primary)] font-bold border-l-[3px] border-[var(--gold-primary)] shadow-2xs"
                    : "text-[var(--text-main)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-[var(--gold-primary)]" : "text-[var(--text-muted)]"
                    }`}
                  />
                  <span className="truncate">{conv.title}</span>
                </div>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--gold-primary)] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* 5. Pied de sidebar : Paramètres & Connexion */}
        <div className="p-3 border-t border-[var(--border-main)] bg-[var(--bg-sidebar)] space-y-1">
          <button
            onClick={() => {}}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Paramètres</span>
          </button>

          {userEmail ? (
            <div className="flex items-center justify-between px-3 py-2 text-[13px] text-[var(--text-main)] rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)]">
              <span className="truncate max-w-[170px]">{userEmail}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
                title="Se déconnecter"
                className="text-[var(--text-muted)] hover:text-red-500 p-1 rounded-md transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-[var(--gold-primary)]" />
              <span>Connexion élève</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE CENTRALE DU CHAT
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--bg-app)] relative">
        {/* Motif décoratif en filigrane discret (Boussole stellaire d'or du nouveau logo) */}
        <div
          className="pointer-events-none absolute bottom-16 right-0 w-84 h-84 opacity-[0.04] select-none z-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <circle cx="100" cy="100" r="62" stroke="currentColor" strokeWidth="4" strokeDasharray="32 16" className="text-[var(--gold-primary)]" />
            <path
              d="M100 18 L115 85 L182 100 L115 115 L100 182 L85 115 L18 100 L85 85 Z"
              fill="currentColor"
              className="text-[var(--gold-primary)]"
            />
          </svg>
        </div>

        {/* 1. Barre supérieure (Topbar) */}
        <header className="shrink-0 h-16 border-b border-[var(--border-main)] px-4 sm:px-8 flex items-center justify-between bg-[var(--bg-app)] z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="p-2 text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--bg-hover)] rounded-lg md:hidden shrink-0 transition-colors cursor-pointer"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            <div className="flex flex-col min-w-0">
              <h1 className="font-serif font-bold text-[18px] sm:text-[20px] text-[var(--text-main)] tracking-tight truncate leading-tight">
                {headerTitle}
              </h1>
              <p className="text-[12px] font-medium text-[var(--text-muted)] hidden sm:block truncate mt-0.5">
                Des conseils personnalisés pour construire ton avenir
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Badge d'étape */}
            <div className="hidden sm:inline-flex items-center gap-2 text-[12px] text-[var(--gold-primary)] bg-[var(--gold-light)] px-3 py-1 rounded-full border border-[var(--gold-border)] font-bold">
              <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-pulse" />
              <span>
                Étape {profile.etape}/5 : {ETAPE_LABELS[profile.etape]}
              </span>
            </div>

            {/* Bouton Nouveau */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-bold text-[var(--btn-primary-text)] bg-[var(--btn-primary-bg)] hover:brightness-110 rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Nouvelle discussion"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau</span>
            </button>

            {/* Basculeur Mode Sombre (Couleurs Logo) / Mode Clair (Couleurs Inverses) */}
            <button
              type="button"
              onClick={toggleTheme}
              className="p-2 text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--bg-hover)] rounded-xl border border-[var(--border-main)] transition-colors cursor-pointer"
              title={theme === "dark" ? "Passer en mode clair (couleurs inverses)" : "Passer en mode sombre (couleurs du logo)"}
              aria-label="Changer le mode de couleur"
            >
              {theme === "dark" ? (
                <Sun className="w-4 h-4 text-[#F5C542]" />
              ) : (
                <Moon className="w-4 h-4 text-[#0F172A]" />
              )}
            </button>

            {/* Icône Profil */}
            <div className="w-8 h-8 rounded-full bg-[var(--gold-light)] border border-[var(--gold-border)] flex items-center justify-center text-[var(--gold-primary)] font-bold text-[12px]">
              <User className="w-4 h-4" />
            </div>
          </div>
        </header>

        {/* 2. Zone de discussion défilante (Conteneur max 780px) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 md:py-8 bg-[var(--bg-app)] z-10">
          <div className="max-w-[780px] mx-auto space-y-6">

            {/* Fiche Bilan Finale si Étape 5 */}
            {profile.etape === 5 && (
              <div className="p-5 bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-2xl shadow-xs space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[var(--gold-primary)]" />
                    <h2 className="font-serif font-bold text-[17px] text-[var(--text-main)]">
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
                  <div key={msg.id} className="flex items-start gap-3.5 group pt-1 animate-fadeIn">
                    {/* Avatar officiel SO (Nouveau logo sans bordures blanches) */}
                    <div className="relative w-8 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xs flex items-center justify-center shrink-0 mt-0.5 overflow-hidden p-0.5">
                      <Image
                        src="/logo.png"
                        alt="Logo SenOrientation"
                        width={26}
                        height={26}
                        className="object-contain"
                      />
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Carte du message assistant */}
                      <div className="bg-[var(--bot-card-bg)] border border-[var(--bot-card-border)] rounded-2xl p-4 sm:p-5 shadow-[var(--bot-card-shadow)]">
                        <BotMessageMarkdown content={parsed.reply || msg.content} />
                      </div>

                      {/* Choix de réponses interactifs (Chips) */}
                      {parsed.suggestions && parsed.suggestions.length > 0 && (
                        <div className="mt-3.5 flex flex-wrap gap-2.5">
                          {parsed.suggestions.map((sug, sIdx) => {
                            const SuggestionIcon = getSuggestionIcon(sug);
                            const isSelected = selectedSuggestion === sug;

                            return (
                              <button
                                key={sIdx}
                                onClick={() => handleSuggestionClick(sug)}
                                disabled={isLoading}
                                className={`text-left text-[14px] font-semibold px-4 py-2.5 rounded-xl border flex items-center gap-2.5 transition-all duration-150 cursor-pointer shadow-2xs ${
                                  isSelected
                                    ? "bg-[var(--gold-primary)] text-[#0B0F19] border-[var(--gold-primary)] shadow-sm font-bold"
                                    : "bg-[var(--bg-chip)] text-[var(--text-main)] border-[var(--border-main)] hover:bg-[var(--bg-chip-hover)] hover:border-[var(--gold-primary)] hover:text-[var(--gold-primary)]"
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                <SuggestionIcon
                                  className={`w-4 h-4 shrink-0 ${
                                    isSelected ? "text-[#0B0F19]" : "text-[var(--gold-primary)]"
                                  }`}
                                />
                                <span>{sug}</span>
                              </button>
                            );
                          })}
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
                  <div className="max-w-[85%] sm:max-w-[75%] bg-[var(--user-bubble-bg)] text-[var(--user-bubble-text)] border border-[var(--border-main)] rounded-2xl rounded-tr-xs px-4 sm:px-5 py-3 text-[15px] font-semibold leading-relaxed shadow-xs">
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
                <div className="relative w-8 h-8 rounded-xl bg-[var(--bg-card)] border border-[var(--border-main)] shadow-xs flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                  <Image
                    src="/logo.png"
                    alt="Logo SenOrientation"
                    width={26}
                    height={26}
                    className="object-contain"
                  />
                </div>
                <div className="bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-2xl px-4 py-2.5 text-[13.5px] text-[var(--gold-primary)] flex items-center gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[var(--gold-primary)] animate-ping" />
                  <span className="font-semibold">SenOrientation analyse tes informations...</span>
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

        {/* 3. Barre de saisie flottante (780px max) */}
        <div className="shrink-0 p-3 sm:p-5 bg-[var(--bg-app)] border-t border-[var(--border-main)] z-10">
          <div className="max-w-[780px] mx-auto">
            <form
              onSubmit={(e) => {
                setSelectedSuggestion(null);
                handleSubmit(e);
              }}
              className="flex items-center gap-2 sm:gap-3 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-2xl px-3 sm:px-4 py-2 shadow-sm focus-within:border-[var(--gold-primary)] focus-within:ring-2 focus-within:ring-[var(--gold-primary)]/20 transition-all"
            >
              {/* Icône d'étoile / boussole à gauche */}
              <div className="text-[var(--gold-primary)] shrink-0 p-1">
                <Sparkles className="w-5 h-5" />
              </div>

              {/* Champ de texte */}
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Pose ta question ou choisis une réponse ci-dessus..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 text-[14.5px] font-medium text-[var(--text-main)] placeholder:text-[var(--text-dim)] focus:outline-none resize-none leading-relaxed py-1.5 max-h-32"
              />

              {/* Trombone / Pièce jointe optionnelle */}
              <button
                type="button"
                className="p-1.5 text-[var(--text-muted)] hover:text-[var(--gold-primary)] hover:bg-[var(--bg-hover)] rounded-lg transition-colors cursor-pointer shrink-0"
                title="Joindre un document"
              >
                <Paperclip className="w-4.5 h-4.5" />
              </button>

              {/* Bouton d'envoi circulaire */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs ${
                  input.trim() && !isLoading
                    ? "bg-[var(--gold-primary)] hover:brightness-110 active:scale-95 text-[#0C0D12]"
                    : "bg-[var(--border-main)] text-[var(--text-dim)] cursor-not-allowed"
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-2.5 text-center text-[11.5px] font-medium text-[var(--text-muted)]">
              Plateforme académique certifiée avec les filières nationales de{" "}
              <a
                href="https://campusen.sec.gouv.sn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--gold-primary)] hover:underline font-semibold"
              >
                campusen.sec.gouv.sn
              </a>
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
