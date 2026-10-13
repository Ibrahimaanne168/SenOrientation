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

interface ParsedAssistantMessage {
  reply: string;
  suggestions: string[];
  profil_update?: Partial<ConversationProfile>;
  dossier?: Partial<ConversationProfile>;
  indices?: Array<{ texte: string; statut: string }>;
  hypotheses?: Array<{ domaine: string; confiance: string }> | string[];
  pistes?: Array<{
    nom: string;
    etablissements: string[];
    duree: string;
    debouches: string;
    indice_retenu?: string;
    pourquoi?: string;
  }>;
  etablissements?: string[];
  etape?: number;
}

const ETAPE_LABELS: Record<number, string> = {
  1: "Accueil et présentation",
  2: "Série et découverte",
  3: "Pistes d'orientation",
  4: "Approfondissement",
  5: "Plan d'action & Bilan",
};

/**
 * Associe intelligemment une icône représentative à une suggestion d'orientation
 */
function getSuggestionIcon(text: string) {
  const lower = text.toLowerCase();
  if (lower.includes("autre domaine") || lower.includes("autre univers")) return Sparkles;
  if (
    lower.includes("langue") ||
    lower.includes("traduction") ||
    lower.includes("interprétation") ||
    lower.includes("arabe")
  )
    return Languages;
  if (lower.includes("compta") || lower.includes("finance") || lower.includes("banque") || lower.includes("assurance"))
    return Calculator;
  if (lower.includes("marketing") || lower.includes("vente") || lower.includes("communication") || lower.includes("journalisme") || lower.includes("médias"))
    return Megaphone;
  if (
    lower.includes("création") ||
    lower.includes("entreprise") ||
    lower.includes("management") ||
    lower.includes("gestion") ||
    lower.includes("agroalimentaire") ||
    lower.includes("mécanique") ||
    lower.includes("usinage")
  )
    return Box;
  if (
    lower.includes("collège") ||
    lower.includes("bfem") ||
    lower.includes("lycée") ||
    lower.includes("seconde") ||
    lower.includes("1ère") ||
    lower.includes("lettres") ||
    lower.includes("enseignement") ||
    lower.includes("école")
  )
    return GraduationCap;
  if (
    lower.includes("terminale") ||
    lower.includes("bachelier") ||
    lower.includes("bac")
  )
    return Briefcase;
  if (
    lower.includes("étudiant") ||
    lower.includes("réorientation") ||
    lower.includes("licence") ||
    lower.includes("administration") ||
    lower.includes("ressources humaines") ||
    lower.includes("rh") ||
    lower.includes("social")
  )
    return Users;
  if (
    lower.includes("ne sais pas") ||
    lower.includes("hésite") ||
    lower.includes("indécis") ||
    lower.includes("aide")
  )
    return HelpCircle;
  if (lower.includes("santé") || lower.includes("médecine") || lower.includes("pharmacie") || lower.includes("chimie"))
    return HeartPulse;
  if (
    lower.includes("informatique") ||
    lower.includes("tech") ||
    lower.includes("développement") ||
    lower.includes("code") ||
    lower.includes("data") ||
    lower.includes("ia") ||
    lower.includes("électronique") ||
    lower.includes("électrotechnique") ||
    lower.includes("automatisme")
  )
    return Code;
  if (lower.includes("droit") || lower.includes("juridique") || lower.includes("sciences po") || lower.includes("politique") || lower.includes("justice"))
    return Scale;
  if (lower.includes("agro") || lower.includes("environnement") || lower.includes("nature") || lower.includes("végétal"))
    return Leaf;
  return Compass;
}

/**
 * Parseur robuste pour les réponses de l'assistant au format JSON strict
 */
function parseAssistantMessage(content: string): ParsedAssistantMessage {
  if (!content) return { reply: "", suggestions: [] };

  const clean = content.trim();

  // Nettoyage des éventuels wrappers markdown ```json ... ```
  const unwrapped = clean
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  // 1. Essai de JSON.parse direct (quand le message est complet)
  try {
    const obj = JSON.parse(unwrapped);
    if (obj && typeof obj === "object" && typeof obj.reply === "string") {
      return {
        reply: obj.reply,
        suggestions: Array.isArray(obj.suggestions) ? obj.suggestions : [],
        profil_update: obj.dossier || obj.profil_update,
        dossier: obj.dossier,
        indices: Array.isArray(obj.indices) ? obj.indices : [],
        hypotheses: Array.isArray(obj.hypotheses) ? obj.hypotheses : [],
        pistes: Array.isArray(obj.pistes) ? obj.pistes : [],
        etablissements: Array.isArray(obj.etablissements) ? obj.etablissements : [],
        etape: typeof obj.etape === "number" ? obj.etape : undefined,
      };
    }
  } catch {
    // Message en cours de streaming
  }

  // 2. Extraction par regex pendant le streaming progressif
  const replyMatch = unwrapped.match(/"reply"\s*:\s*"((?:[^"\\]|\\.)*)"?/);
  if (replyMatch && replyMatch[1]) {
    try {
      const replyText = JSON.parse(`"${replyMatch[1]}"`);
      const sugMatch = unwrapped.match(/"suggestions"\s*:\s*\[([\s\S]*?)\]/);
      let suggestions: string[] = [];
      if (sugMatch && sugMatch[1]) {
        try {
          suggestions = JSON.parse(`[${sugMatch[1]}]`);
        } catch {
          // Streaming partiel
        }
      }

      const etapeMatch = unwrapped.match(/"etape"\s*:\s*([1-5])/);
      const etape = etapeMatch ? parseInt(etapeMatch[1], 10) : undefined;

      return {
        reply: replyText,
        suggestions,
        etape,
      };
    } catch {
      // Fallback
    }
  }

  // 3. Fallback texte brut
  return {
    reply: clean,
    suggestions: [],
  };
}

/* ─── Rendu Markdown Académique ─── */
function BotMessageMarkdown({ content }: { content: string }) {
  return (
    <div className="bot-response-content font-sans text-[15px] leading-relaxed text-[#172B46]">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#10469B] underline hover:text-[#0B2859] transition-colors"
            >
              {children}
            </a>
          ),
          p: ({ children }) => (
            <p className="mb-2.5 last:mb-0 leading-[1.65] text-[#172B46]">
              {children}
            </p>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
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
            "Bonjour ! Bienvenue sur SenOrientation, ta plateforme d'orientation académique et universitaire. Pour commencer et faire connaissance, comment tu t'appelles ?",
          suggestions: [
            "Collège (3e / BFEM)",
            "Lycée (Seconde ou 1ère)",
            "Terminale ou Nouveau bachelier",
            "Étudiant ou Réorientation",
          ],
          etape: 1,
        }),
        createdAt: new Date(),
      },
    ],
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[Chat error]", err);
    },
  });

  /* ─── Synchronisation automatique du profil depuis les messages ─── */
  useEffect(() => {
    const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistantMsg) return;

    // 1. Lecture depuis les annotations dataStream
    if (lastAssistantMsg.annotations && Array.isArray(lastAssistantMsg.annotations)) {
      for (const ann of lastAssistantMsg.annotations) {
        if (ann && typeof ann === "object" && "profile" in ann) {
          const p = (ann as Record<string, unknown>).profile as ConversationProfile | undefined;
          if (p && typeof p.etape === "number") {
            setProfile(p);
            return;
          }
        }
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

  /* ─── Bouton Nouvelle discussion ─────────────────────────────────── */
  const handleNewChat = () => {
    const newId = Date.now().toString();
    setProfile(INITIAL_PROFILE);
    setSelectedSuggestion(null);
    setConversations((prev) => [
      { id: newId, title: "Orientation Bac Sénégal", date: "À l'instant" },
      ...prev,
    ]);
    setActiveConvId(newId);
    setMessages([
      {
        id: `welcome-${newId}`,
        role: "assistant",
        content: JSON.stringify({
          reply:
            "Bonjour ! Bienvenue sur SenOrientation. Pour commencer et faire connaissance, comment tu t'appelles ?",
          suggestions: [
            "Collège (3e / BFEM)",
            "Lycée (Seconde ou 1ère)",
            "Terminale ou Nouveau bachelier",
            "Étudiant ou Réorientation",
          ],
          etape: 1,
        }),
        createdAt: new Date(),
      },
    ]);
    setSidebarOpen(false);
  };

  /* ─── Clic sur un chip de suggestion ─────────────────────────────── */
  const handleSuggestionClick = (question: string) => {
    if (isLoading) return;
    setSelectedSuggestion(question);

    if (question === "Nouvelle discussion") {
      handleNewChat();
      return;
    }
    if (question === "Exporter mon récapitulatif") {
      exportSummary();
      return;
    }

    append({
      role: "user",
      content: question,
    });
  };

  /* ─── Export de la fiche récapitulative (Étape 5) ─────────────────── */
  const generateRecapText = () => {
    const dateStr = new Date().toLocaleDateString("fr-FR");
    return `============================================================
SENORIENTATION — DOSSIER D'ORIENTATION ACADÉMIQUE (SÉNÉGAL)
Date : ${dateStr}
Portail national : campusen.sec.gouv.sn
============================================================

1. PROFIL DE L'APPRENANT
- Prénom / Identifiant : ${profile.prenom && profile.prenom !== "l'ami" ? profile.prenom : "Non précisé"}
- Série de Bac : ${profile.serie || "Non précisée"}
- Niveau : ${profile.niveau || "Terminale / Nouveau bachelier"}
- Moyenne générale estimée : ${profile.moyenne ? `${profile.moyenne}/20` : "Non précisée"}
- Matières de prédilection : ${profile.matieres_aimees.length > 0 ? profile.matieres_aimees.join(", ") : "Généralistes"}
- Points forts : ${profile.points_forts.length > 0 ? profile.points_forts.join(", ") : "Non précisés"}
- Projet / Métier visé : ${profile.projet || "En cours d'approfondissement"}
- Ville souhaitée : ${profile.ville || "Sénégal (Dakar, Thiès, Saint-Louis, Bambey, Ziguinchor)"}
- Préférence financière : ${profile.budget || "Enseignement supérieur public (25 000 FCFA/an)"}

2. DÉMARCHES ACADÉMIQUES RECOMMANDÉES
- Campusen : Dépôt impératif lors de l'ouverture nationale de la plateforme.
- Frais universitaires publics : 25 000 FCFA/an fixés par l'État du Sénégal.
- Bourses nationales (DGES) : Demi-bourse (20 000 FCFA/mois) ou bourse entière (40 000 FCFA/mois).
- Écoles d'excellence sur concours : Dépôts de dossiers entre mai et juillet (ESP, EPT, ENEA, ENSETP, ESMT).
- Délais de paiement : 7 à 10 jours ouvrés via opérateurs agréés sous peine d'annulation automatique.
============================================================`;
  };

  const exportSummary = () => {
    const text = generateRecapText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const namePart =
      profile.prenom && profile.prenom !== "l'ami"
        ? profile.prenom.replace(/\s+/g, "_")
        : profile.serie || "Senegal";
    link.download = `Fiche_Orientation_SenOrientation_${namePart}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyRecap = () => {
    const text = generateRecapText();
    navigator.clipboard.writeText(text);
    setCopiedRecap(true);
    setTimeout(() => setCopiedRecap(false), 2000);
  };

  /* ─── Soumission par Entrée ──────────────────────────────────────── */
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
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#172B46] font-sans antialiased">
      {/* ════════════════════════════════════════════
          PANNEAU LATÉRAL (SIDEBAR INSTITUTIONNELLE)
      ════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-xs md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex flex-col w-[280px] bg-white border-r border-[#E0E7F0] shadow-sm transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* 1. En-tête : Logo officiel agrandi de 30% + Identité académique */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E0E7F0] bg-white">
          <div className="flex items-center gap-3">
            <div className="relative w-10 h-10 shrink-0">
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
                <span className="text-[#0B2859]">Sen</span>
                <span className="text-[#75421F]">Orientation</span>
              </span>
              <span className="text-[10.5px] text-[#64748B] font-medium tracking-tight mt-0.5">
                Ton avenir, notre boussole
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="p-1.5 text-[#64748B] hover:text-[#0B2859] rounded-md hover:bg-[#EDF4FD] md:hidden transition-colors"
          >
            <PanelLeftOpen className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* 2. Bouton Nouvelle discussion : Bleu institutionnel avec ombre et flèche */}
        <div className="p-4 border-b border-[#E0E7F0]">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-between py-2.5 px-4 text-[14px] font-medium text-white bg-[#10469B] hover:bg-[#0B2859] rounded-xl shadow-[0_2px_8px_rgba(16,70,155,0.22)] hover:shadow-[0_4px_12px_rgba(16,70,155,0.3)] active:scale-[0.99] transition-all duration-150 cursor-pointer group"
          >
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-4 h-4 text-white" />
              <span>Nouvelle discussion</span>
            </div>
            <ChevronRight className="w-4 h-4 text-white/80 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        {/* 3. Carte de Progression de l'orientation : Segmentée en 5 étapes */}
        <div className="p-4 border-b border-[#E0E7F0] bg-white">
          <div className="p-3.5 bg-[#EDF4FD]/70 rounded-xl border border-[#D3E3F8] space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full border-2 border-[#10469B] border-t-transparent animate-spin-slow flex items-center justify-center shrink-0" />
                <span className="font-semibold text-[13px] text-[#0B2859]">
                  Progression
                </span>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white text-[#10469B] border border-[#BFD7F8] shadow-2xs">
                Étape {profile.etape}/5
              </span>
            </div>

            <p className="text-[12px] font-medium text-[#64748B]">
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
                      isPassed ? "bg-[#10469B]" : "bg-[#DDE5EF]"
                    }`}
                    title={`Étape ${step} : ${ETAPE_LABELS[step]}`}
                  />
                );
              })}
            </div>

            {/* Fiche résumé de l'élève */}
            <div className="pt-2 border-t border-[#D3E3F8]/80 text-[12px] text-[#172B46] flex items-center gap-2">
              <User className="w-3.5 h-3.5 text-[#10469B] shrink-0" />
              <span className="font-medium text-[#64748B]">Élève :</span>
              <strong className="text-[#0B2859] truncate">
                {profile.prenom && profile.prenom !== "l'ami"
                  ? profile.prenom
                  : "Ibrahima"}
              </strong>
            </div>
          </div>
        </div>

        {/* 4. Historique des discussions avec indicateur actif latéral */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          <div className="flex items-center gap-2 px-2.5 py-1.5 text-[12px] font-semibold text-[#64748B] uppercase tracking-wider">
            <History className="w-3.5 h-3.5 text-[#75421F]" />
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
                className={`w-full flex items-center justify-between px-3 py-2.5 text-[13.5px] rounded-xl text-left transition-all ${
                  isActive
                    ? "bg-[#EDF4FD] text-[#10469B] font-semibold border-l-[3px] border-[#10469B] shadow-2xs"
                    : "text-[#172B46] hover:bg-[#F8FAFC] hover:text-[#0B2859]"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MessageSquare
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? "text-[#10469B]" : "text-[#64748B]"
                    }`}
                  />
                  <span className="truncate">{conv.title}</span>
                </div>
                {isActive && (
                  <ChevronRight className="w-3.5 h-3.5 text-[#10469B] shrink-0" />
                )}
              </button>
            );
          })}
        </div>

        {/* 5. Pied de sidebar : Paramètres & Connexion */}
        <div className="p-3 border-t border-[#E0E7F0] bg-white space-y-1">
          <button
            onClick={() => {}}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#64748B] hover:text-[#0B2859] hover:bg-[#EDF4FD] rounded-lg transition-colors cursor-pointer"
          >
            <Settings className="w-4 h-4 text-[#64748B]" />
            <span>Paramètres</span>
          </button>

          {userEmail ? (
            <div className="flex items-center justify-between px-3 py-2 text-[13px] text-[#172B46] rounded-lg bg-[#F8FAFC]">
              <span className="truncate max-w-[170px]">{userEmail}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
                title="Se déconnecter"
                className="text-[#64748B] hover:text-red-600 p-1 rounded-md transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-[#64748B] hover:text-[#0B2859] hover:bg-[#EDF4FD] rounded-lg transition-colors"
            >
              <User className="w-4 h-4 text-[#75421F]" />
              <span>Connexion élève</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE CENTRALE DU CHAT (FOND BLANC ÉPURÉ)
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white relative">
        {/* Motif décoratif en filigrane discret (Boussole académique en bas à droite) */}
        <div
          className="pointer-events-none absolute bottom-16 right-0 w-80 h-80 opacity-[0.045] select-none z-0"
          aria-hidden="true"
        >
          <svg viewBox="0 0 200 200" fill="none" className="w-full h-full">
            <circle cx="100" cy="100" r="95" stroke="#0B2859" strokeWidth="1.5" strokeDasharray="4 4" />
            <circle cx="100" cy="100" r="80" stroke="#75421F" strokeWidth="1.2" />
            <circle cx="100" cy="100" r="65" stroke="#0B2859" strokeWidth="0.8" />
            <path d="M100 15 L108 85 L185 100 L108 115 L100 185 L92 115 L15 100 L92 85 Z" stroke="#0B2859" strokeWidth="1.5" fill="none" />
            <path d="M100 20 L106 94 L170 100 L106 106 L100 180 L94 106 L30 100 L94 94 Z" fill="#75421F" opacity="0.15" />
          </svg>
        </div>

        {/* 1. Barre supérieure (Topbar) */}
        <header className="shrink-0 h-16 border-b border-[#E0E7F0] px-4 sm:px-8 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="p-2 text-[#64748B] hover:text-[#0B2859] hover:bg-[#EDF4FD] rounded-lg md:hidden shrink-0 transition-colors"
            >
              <PanelLeftOpen className="w-5 h-5" />
            </button>

            <div className="flex flex-col min-w-0">
              <h1 className="font-serif font-semibold text-[17px] sm:text-[19px] text-[#0B2859] tracking-tight truncate leading-tight">
                {headerTitle}
              </h1>
              <p className="text-[12px] text-[#64748B] hidden sm:block truncate mt-0.5">
                Des conseils personnalisés pour construire ton avenir
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Badge d'étape */}
            <div className="hidden sm:inline-flex items-center gap-2 text-[12px] text-[#10469B] bg-[#EDF4FD] px-3 py-1 rounded-full border border-[#D3E3F8] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#10469B]" />
              <span>
                Étape {profile.etape}/5 : {ETAPE_LABELS[profile.etape]}
              </span>
            </div>

            {/* Bouton Nouveau avec accent Brun Académique */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12.5px] font-medium text-white bg-[#75421F] hover:bg-[#5E3418] rounded-lg shadow-xs transition-colors cursor-pointer"
              title="Nouvelle discussion"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouveau</span>
            </button>

            {/* Icône Boussole / Profil */}
            <div className="flex items-center gap-1 text-[#64748B]">
              <button
                type="button"
                className="p-1.5 hover:text-[#0B2859] hover:bg-[#EDF4FD] rounded-lg transition-colors"
                title="Orientation"
              >
                <Sun className="w-4 h-4" />
              </button>
              <div className="w-7 h-7 rounded-full bg-[#EDF4FD] border border-[#D3E3F8] flex items-center justify-center text-[#10469B] font-semibold text-[12px]">
                <User className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>
        </header>

        {/* 2. Zone de discussion défilante (Conteneur max 780px) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6 md:py-8 bg-white z-10">
          <div className="max-w-[780px] mx-auto space-y-6">

            {/* Fiche Bilan Finale si Étape 5 */}
            {profile.etape === 5 && (
              <div className="p-5 bg-[#EDF4FD]/60 border border-[#D3E3F8] rounded-2xl shadow-xs space-y-4 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-5 h-5 text-[#10469B]" />
                    <h2 className="font-serif font-bold text-[17px] text-[#0B2859]">
                      Fiche de Synthèse d&apos;Orientation (Étape 5/5)
                    </h2>
                  </div>
                  <span className="text-[12px] bg-white text-[#10469B] font-semibold px-2.5 py-0.5 rounded-full border border-[#BFD7F8]">
                    Dossier validé
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13.5px] bg-white p-4 rounded-xl border border-[#E0E7F0] shadow-2xs">
                  {profile.prenom && profile.prenom !== "l'ami" && (
                    <div>
                      <span className="text-[#64748B] block text-[11.5px] font-medium">Élève</span>
                      <strong className="text-[#0B2859]">{profile.prenom}</strong>
                    </div>
                  )}
                  <div>
                    <span className="text-[#64748B] block text-[11.5px] font-medium">Série de Bac</span>
                    <strong className="text-[#0B2859]">{profile.serie || "Non précisée"}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px] font-medium">Moyenne estimée</span>
                    <strong className="text-[#0B2859]">
                      {profile.moyenne ? `${profile.moyenne}/20` : "Non précisée"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px] font-medium">Matières de prédilection</span>
                    <span className="text-[#172B46]">
                      {profile.matieres_aimees.length > 0
                        ? profile.matieres_aimees.join(", ")
                        : "Généralistes"}
                    </span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-[#64748B] block text-[11.5px] font-medium">Filière / Projet ciblé</span>
                    <strong className="text-[#75421F]">
                      {profile.projet || "En cours de validation finale"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px] font-medium">Ville souhaitée</span>
                    <span className="text-[#172B46]">{profile.ville || "Sénégal (Dakar, Thiès...)"}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px] font-medium">Frais universitaires</span>
                    <span className="text-[#172B46]">
                      {profile.budget || "Public Campusen (25 000 FCFA/an)"}
                    </span>
                  </div>
                </div>

                {/* Boutons d'export */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    onClick={exportSummary}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium bg-[#10469B] hover:bg-[#0B2859] text-white rounded-xl shadow-xs transition-colors cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>Télécharger la fiche (.txt)</span>
                  </button>

                  <button
                    onClick={copyRecap}
                    className="flex items-center gap-2 px-4 py-2 text-[13px] font-medium text-[#172B46] bg-white hover:bg-[#F8FAFC] border border-[#E0E7F0] rounded-xl shadow-2xs transition-colors cursor-pointer"
                  >
                    {copiedRecap ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-600" />
                        <span className="text-emerald-700">Copié dans le presse-papier</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 text-[#64748B]" />
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
                    {/* Avatar officiel SO */}
                    <div className="relative w-8 h-8 rounded-full bg-white border border-[#D3E3F8] shadow-xs flex items-center justify-center shrink-0 mt-0.5 overflow-hidden p-0.5">
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
                      <div className="bg-white border border-[#E0E7F0] rounded-2xl p-4 sm:p-5 shadow-[0_2px_12px_rgba(11,40,89,0.04)]">
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
                                    ? "bg-[#10469B] text-white border-[#10469B] shadow-xs"
                                    : "bg-white text-[#0F172A] border-[#CBD5E1] hover:bg-[#EDF4FD] hover:border-[#BFD7F8] hover:text-[#10469B]"
                                } disabled:opacity-60 disabled:cursor-not-allowed`}
                              >
                                <SuggestionIcon
                                  className={`w-4 h-4 shrink-0 ${
                                    isSelected ? "text-white" : "text-[#75421F]"
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
                          className="flex items-center gap-1.5 text-[12px] text-[#64748B] hover:text-[#0B2859] px-2 py-1 rounded-md hover:bg-[#EDF4FD] transition-colors"
                          title="Copier la réponse"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-700">Copié</span>
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
                            className="flex items-center gap-1.5 text-[12px] text-[#64748B] hover:text-[#0B2859] px-2 py-1 rounded-md hover:bg-[#EDF4FD] transition-colors disabled:opacity-40"
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

              /* ─── Message Utilisateur (Bleu institutionnel #10469B) ─── */
              return (
                <div key={msg.id} className="flex flex-col items-end pt-1 animate-fadeIn">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-[#10469B] text-white rounded-2xl rounded-tr-xs px-4 sm:px-5 py-3 text-[15px] font-semibold leading-relaxed shadow-xs">
                    {msg.content}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-medium text-[#475569] mt-1 mr-1">
                    <span>{new Date(msg.createdAt || Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <CheckCheck className="w-3.5 h-3.5 text-[#10469B]" />
                  </div>
                </div>
              );
            })}

            {/* Indicateur de réflexion */}
            {isLoading && (
              <div className="flex items-center gap-3.5 pt-1 animate-fadeIn">
                <div className="relative w-8 h-8 rounded-full bg-white border border-[#D3E3F8] shadow-xs flex items-center justify-center shrink-0 overflow-hidden p-0.5">
                  <Image
                    src="/logo.png"
                    alt="Logo SenOrientation"
                    width={26}
                    height={26}
                    className="object-contain"
                  />
                </div>
                <div className="bg-[#EDF4FD] border border-[#D3E3F8] rounded-2xl px-4 py-2.5 text-[13.5px] text-[#10469B] flex items-center gap-2.5 shadow-2xs">
                  <span className="w-2 h-2 rounded-full bg-[#10469B] animate-ping" />
                  <span className="font-medium">SenOrientation analyse tes informations...</span>
                </div>
              </div>
            )}

            {/* Alerte d'erreur */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-800 text-[13.5px] flex items-start gap-2.5">
                <AlertCircle className="w-4.5 h-4.5 text-red-600 shrink-0 mt-0.5" />
                <p>
                  Une erreur temporaire est survenue lors de l&apos;envoi. Merci de vérifier votre connexion et de réessayer.
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* 3. Barre de saisie flottante et premium (780px max) */}
        <div className="shrink-0 p-3 sm:p-5 bg-white border-t border-[#E0E7F0] z-10">
          <div className="max-w-[780px] mx-auto">
            <form
              onSubmit={(e) => {
                setSelectedSuggestion(null);
                handleSubmit(e);
              }}
              className="flex items-center gap-2 sm:gap-3 bg-white border border-[#E0E7F0] rounded-2xl px-3 sm:px-4 py-2 shadow-[0_4px_20px_rgba(11,40,89,0.06)] focus-within:border-[#10469B] focus-within:ring-2 focus-within:ring-[#10469B]/15 transition-all"
            >
              {/* Icône d'étincelle / boussole à gauche */}
              <div className="text-[#10469B] shrink-0 p-1">
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
                className="flex-1 bg-transparent border-0 text-[14.5px] text-[#172B46] placeholder:text-[#94A3B8] focus:outline-none resize-none leading-relaxed py-1.5 max-h-32"
              />

              {/* Trombone / Pièce jointe optionnelle */}
              <button
                type="button"
                className="p-1.5 text-[#64748B] hover:text-[#0B2859] hover:bg-[#EDF4FD] rounded-lg transition-colors cursor-pointer shrink-0"
                title="Joindre un document"
              >
                <Paperclip className="w-4.5 h-4.5" />
              </button>

              {/* Bouton d'envoi circulaire en Bleu institutionnel #10469B */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-all cursor-pointer shadow-xs ${
                  input.trim() && !isLoading
                    ? "bg-[#10469B] hover:bg-[#0B2859] active:scale-95 text-white"
                    : "bg-[#E0E7F0] text-[#94A3B8] cursor-not-allowed"
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-2.5 text-center text-[11.5px] text-[#64748B]">
              Plateforme académique certifiée avec les filières nationales de{" "}
              <a
                href="https://campusen.sec.gouv.sn"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#10469B] hover:underline font-medium"
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
