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
  FileText,
  CheckCircle2,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ConversationProfile, INITIAL_PROFILE } from "@/lib/profile";

interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

interface ParsedAssistantMessage {
  reply: string;
  suggestions: string[];
  profile?: ConversationProfile;
}

const ETAPE_LABELS: Record<number, string> = {
  1: "Série & Intérêts",
  2: "Matières & Moyenne",
  3: "Projet & Mobilité",
  4: "Budget & Bourses",
  5: "Plan Final Prêt",
};

/**
 * Parseur robuste pour les messages de l'assistant au format JSON { reply, suggestions, profile }
 * Gère le texte en cours de streaming et nettoie les balises markdown si présentes
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
        profile: obj.profile,
      };
    }
  } catch {
    // Message en cours de streaming
  }

  // 2. Extraction par expression régulière pendant le streaming progressif
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
          // Suggestions incomplètes en cours de streaming
        }
      }
      return {
        reply: replyText,
        suggestions,
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

/* ─── Rendu Markdown des réponses ─── */
function BotMessageMarkdown({ content }: { content: string }) {
  return (
    <div className="bot-response-content">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer">
              {children}
            </a>
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

  // Objet profil progressif par conversation (étapes 1 à 5)
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
            "Salut ! Je suis **SenOrientation**, ton guide pour construire ton orientation scolaire et universitaire au Sénégal.\n\nPour débuter ton accompagnement étape par étape, **quelle est ta série de Bac** (ou ton domaine d'intérêt) ?",
          suggestions: [
            "Bac S1 / S2 (Scientifique)",
            "Bac L1 / L2 (Littéraire)",
            "Bac G / STEG (Gestion)",
            "Bac Technique (T1/T2)",
          ],
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
    if (parsed.profile && typeof parsed.profile.etape === "number") {
      setProfile(parsed.profile);
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

  /* ─── Bouton "Nouvelle discussion" : réinitialise le profil et le chat ─ */
  const handleNewChat = () => {
    const newId = Date.now().toString();
    setProfile(INITIAL_PROFILE);
    setConversations((prev) => [
      { id: newId, title: "Nouvelle discussion", date: "À l'instant" },
      ...prev,
    ]);
    setActiveConvId(newId);
    setMessages([
      {
        id: `welcome-${newId}`,
        role: "assistant",
        content: JSON.stringify({
          reply:
            "Salut ! Je suis **SenOrientation**, ton guide officiel au Sénégal.\n\nPour débuter ta nouvelle démarche d'orientation, **quelle est ta série de Bac** ?",
          suggestions: [
            "Bac S1 / S2 (Scientifique)",
            "Bac L1 / L2 (Littéraire)",
            "Bac G / STEG (Gestion)",
            "Bac Technique (T1/T2)",
          ],
        }),
        createdAt: new Date(),
      },
    ]);
    setSidebarOpen(false);
  };

  /* ─── Clic sur un chip de suggestion ─────────────────────────────── */
  const handleSuggestionClick = (question: string) => {
    if (isLoading) return;

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

  /* ─── Génération et export du récapitulatif final (Étape 5) ──────── */
  const generateRecapText = () => {
    const dateStr = new Date().toLocaleDateString("fr-FR");
    return `============================================================
SENORIENTATION - FICHE D'ORIENTATION OFFICIELLE (SÉNÉGAL)
Date : ${dateStr}
Plateforme nationale : campusen.sec.gouv.sn
============================================================

1. PROFIL DE L'ÉLÈVE
- Série de Baccalauréat : ${profile.serie || "Non précisée"}
- Moyenne générale : ${profile.moyenne ? `${profile.moyenne}/20` : "Non précisée"}
- Matières favorites : ${profile.matieres_aimees.length > 0 ? profile.matieres_aimees.join(", ") : "Non précisées"}
- Points forts : ${profile.points_forts.length > 0 ? profile.points_forts.join(", ") : "Non précisés"}
- Métier / Projet visé : ${profile.projet || "En cours de validation"}
- Ville / Mobilité : ${profile.ville || "Sénégal (Toutes régions)"}
- Préférence financière : ${profile.budget || "Universités publiques (Campusen) & Bourses DGES"}

2. SYNTHÈSE DES RECOMMANDATIONS OFFICIELLES
- Secteur Public (Campusen) : Droits d'inscription de 25 000 FCFA/an. Inscription obligatoire sur campusen.sec.gouv.sn dès parution des résultats du Bac.
- Bourses DGES : Éligibilité aux bourses de l'État (Demi-bourse 20 000 FCFA/mois, Bourse entière 40 000 FCFA/mois en Licence).
- Secteur Privé : Établissements accrédités ANAQ-Sup et CAMES (dossier direct ou subventions).

3. PROCHAINES DÉMARCHES CRUCIALES
- Créer ton compte Campusen avec ton numéro de table et ta date de naissance.
- Classer tes 18 choix de filières par ordre de préférence absolue.
- Valider et payer dans les 7 à 10 jours suivant l'attribution sous peine de forclusion.
============================================================`;
  };

  const exportSummary = () => {
    const text = generateRecapText();
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Recapitulatif_Orientation_${profile.serie || "Senegal"}.txt`;
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
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  /* ─── Copier la réponse ──────────────────────────────────────────── */
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const currentConversation = conversations.find((c) => c.id === activeConvId);
  const headerTitle = currentConversation?.title || "Discussion d'orientation";

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-[#1F2937]">

      {/* ════════════════════════════════════════════
          PANNEAU LATÉRAL (SIDEBAR)
      ════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-2xs md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-white border-r border-[#E5E7EB] transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* En-tête de la sidebar avec Logo officiel */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Logo SenOrientation"
              width={26}
              height={26}
              className="object-contain shrink-0"
            />
            <span className="font-semibold text-[15px] tracking-tight text-[#1F2937]">
              SenOrientation
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="p-1 text-[#6B7280] hover:text-[#1F2937] md:hidden"
          >
            <PanelLeftOpen className="w-4 h-4 rotate-180" />
          </button>
        </div>

        {/* Bouton Nouvelle discussion */}
        <div className="p-3 border-b border-[#E5E7EB]">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[14px] font-medium text-white bg-[#0B3D91] hover:bg-[#082E6E] rounded-lg transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle discussion</span>
          </button>
        </div>

        {/* Indicateur de profil de l'élève dans la sidebar */}
        <div className="p-3 bg-[#F9FAFB] border-b border-[#E5E7EB] text-[12.5px] space-y-1.5">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-[#1F2937]">Progression Profil</span>
            <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#EBF3FE] text-[#0B3D91]">
              Étape {profile.etape}/5
            </span>
          </div>
          <p className="text-[11.5px] text-[#6B7280]">
            {ETAPE_LABELS[profile.etape] || "En cours"}
          </p>
          {profile.serie && (
            <div className="pt-1 text-[11.5px] text-[#4B5563]">
              <span className="font-medium">Série :</span> {profile.serie}
            </div>
          )}
        </div>

        {/* Historique des discussions */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <p className="px-2 py-1 text-[12px] font-medium text-[#6B7280]">
            Historique
          </p>
          {conversations.map((conv) => {
            const isActive = conv.id === activeConvId;
            return (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConvId(conv.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] rounded-lg text-left transition-colors ${
                  isActive
                    ? "bg-[#F1F3F5] text-[#0B3D91] font-semibold"
                    : "text-[#374151] hover:bg-[#F9FAFB] hover:text-[#111827]"
                }`}
              >
                <MessageSquare
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-[#0B3D91]" : "text-[#6B7280]"
                  }`}
                />
                <span className="truncate">{conv.title}</span>
              </button>
            );
          })}
        </div>

        {/* Pied de sidebar */}
        <div className="p-3 border-t border-[#E5E7EB]">
          {userEmail ? (
            <div className="flex items-center justify-between px-2 py-1 text-[13px] text-[#4B5563]">
              <span className="truncate">{userEmail}</span>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
                title="Se déconnecter"
                className="text-[#6B7280] hover:text-red-600 p-1"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-2.5 py-1.5 text-[14px] text-[#4B5563] hover:text-[#1F2937] transition-colors"
            >
              <User className="w-4 h-4 text-[#6B7280]" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE CENTRALE (CONTENEUR 760px MAX)
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">

        {/* En-tête : Titre + Progression + Bouton Nouvelle discussion */}
        <header className="shrink-0 h-13 border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="p-1.5 text-[#6B7280] hover:text-[#1F2937] md:hidden shrink-0"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            <h1 className="text-[14.5px] font-medium text-[#1F2937] truncate">
              {headerTitle}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            {/* Badge d'étape progressif */}
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[12px] text-[#0B3D91] bg-[#EBF3FE] px-2.5 py-1 rounded-md border border-[#BFDBFE] font-medium">
              <span className="w-2 h-2 rounded-full bg-[#0B3D91]" />
              Étape {profile.etape}/5 : {ETAPE_LABELS[profile.etape]}
            </span>

            {/* Bouton Nouvelle discussion rapide */}
            <button
              onClick={handleNewChat}
              className="flex items-center gap-1 px-2.5 py-1 text-[12.5px] font-medium text-[#4B5563] hover:text-[#0B3D91] hover:bg-[#F3F4F6] rounded-md border border-[#E5E7EB] transition-colors cursor-pointer"
              title="Réinitialiser le profil et commencer une nouvelle discussion"
            >
              <Plus className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Nouveau</span>
            </button>
          </div>
        </header>

        {/* Zone des messages (760px max) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 md:py-8 bg-white">
          <div className="max-w-[760px] mx-auto space-y-6">

            {/* CARTE RÉCAPITULATIF FINAL EXPORTABLE QUAND ÉTAPE = 5 */}
            {profile.etape === 5 && (
              <div className="p-4 sm:p-5 bg-[#F8FAFC] border-2 border-[#93C5FD] rounded-xl shadow-xs space-y-3.5 animate-fadeIn">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#0B3D91]" />
                    <h2 className="text-[15px] font-semibold text-[#1F2937]">
                      Fiche d&apos;Orientation Personnalisée (Étape 5/5)
                    </h2>
                  </div>
                  <span className="text-[12px] bg-emerald-100 text-emerald-800 font-medium px-2 py-0.5 rounded-full">
                    Profil Complet
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-[13px] bg-white p-3 rounded-lg border border-[#E2E8F0]">
                  <div>
                    <span className="text-[#64748B] block text-[11.5px]">Série de Baccalauréat</span>
                    <strong className="text-[#0F172A]">{profile.serie || "Non précisée"}</strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px]">Moyenne estimée</span>
                    <strong className="text-[#0F172A]">
                      {profile.moyenne ? `${profile.moyenne}/20` : "Non précisée"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px]">Matières favorites</span>
                    <span className="text-[#0F172A]">
                      {profile.matieres_aimees.length > 0
                        ? profile.matieres_aimees.join(", ")
                        : "Générales"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px]">Métier / Domaine visé</span>
                    <strong className="text-[#0B3D91]">
                      {profile.projet || "En cours de sélection"}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px]">Mobilité &amp; Ville</span>
                    <span className="text-[#0F172A]">{profile.ville || "Sénégal"}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[11.5px]">Cadre de formation</span>
                    <span className="text-[#0F172A]">
                      {profile.budget || "Campusen (Public) & Privé accrédité"}
                    </span>
                  </div>
                </div>

                {/* Boutons d'export */}
                <div className="flex flex-wrap items-center gap-2.5 pt-1">
                  <button
                    onClick={exportSummary}
                    className="flex items-center gap-1.5 px-3.5 py-1.5 text-[13px] font-medium bg-[#0B3D91] hover:bg-[#082E6E] text-white rounded-lg transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Télécharger le récapitulatif (.txt)</span>
                  </button>

                  <button
                    onClick={copyRecap}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[#334155] bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedRecap ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Fiche copiée !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier la fiche</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Fil des messages */}
            {messages.map((msg) => {
              const isBot = msg.role === "assistant";

              if (isBot) {
                const parsed = parseAssistantMessage(msg.content);

                return (
                  <div key={msg.id} className="flex items-start gap-3.5 group pt-1">
                    {/* Avatar du bot */}
                    <div className="w-7 h-7 rounded-full bg-[#0B3D91] text-white flex items-center justify-center font-semibold text-[11px] shrink-0 mt-0.5 select-none">
                      S
                    </div>

                    <div className="flex-1 min-w-0">
                      {/* Réponse textuelle rendue en Markdown */}
                      <BotMessageMarkdown content={parsed.reply || msg.content} />

                      {/* Suggestions affichées comme chips cliquables sous le message */}
                      {parsed.suggestions && parsed.suggestions.length > 0 && !isLoading && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {parsed.suggestions.map((sug, sIdx) => (
                            <button
                              key={sIdx}
                              onClick={() => handleSuggestionClick(sug)}
                              className="text-left text-[13px] font-medium text-[#1F2937] bg-[#F3F4F6] hover:bg-[#E5E7EB] hover:text-[#0B3D91] border border-[#D1D5DB] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
                            >
                              {sug}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* Boutons copier / régénérer au survol */}
                      <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(parsed.reply || msg.content, msg.id)}
                          className="flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#1F2937] px-2 py-0.5 rounded hover:bg-gray-100 transition-colors"
                          title="Copier la réponse"
                        >
                          {copiedId === msg.id ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-600" />
                              <span>Copié</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Copier</span>
                            </>
                          )}
                        </button>

                        <button
                          onClick={() => reload()}
                          disabled={isLoading}
                          className="flex items-center gap-1 text-[12px] text-[#6B7280] hover:text-[#1F2937] px-2 py-0.5 rounded hover:bg-gray-100 transition-colors"
                          title="Régénérer la réponse"
                        >
                          <RotateCw className="w-3 h-3" />
                          <span>Régénérer</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              /* Utilisateur */
              return (
                <div key={msg.id} className="flex justify-end pt-1">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-[#0B3D91] text-white rounded-[16px] px-4 py-2.5 text-[15px] leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Indicateur de chargement */}
            {isLoading && (
              <div className="flex items-center gap-3 pt-1">
                <div className="w-7 h-7 rounded-full bg-[#0B3D91] text-white flex items-center justify-center font-semibold text-[11px] shrink-0">
                  S
                </div>
                <div className="text-[14px] text-[#6B7280] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0B3D91] animate-pulse" />
                  <span>Actualisation du profil &amp; des filières officielles...</span>
                </div>
              </div>
            )}

            {/* Erreur de connexion */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-[13.5px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>
                  Une erreur est survenue lors de l&apos;envoi. Merci de vérifier votre connexion et de réessayer.
                </p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ════════════════════════════════════════════
            ZONE DE SAISIE ET PIED DE PAGE (760px MAX)
        ════════════════════════════════════════════ */}
        <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-[#E5E7EB]">
          <div className="max-w-[760px] mx-auto">
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 bg-white border border-[#E5E7EB] rounded-[14px] p-2 focus-within:border-[#0B3D91] transition-colors"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Pose ta question ou choisis une suggestion ci-dessus..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none resize-none leading-relaxed py-1 px-1.5 max-h-32"
              />

              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  input.trim() && !isLoading
                    ? "bg-[#0B3D91] hover:bg-[#082E6E] text-white cursor-pointer"
                    : "bg-[#E5E7EB] text-[#9CA3AF] cursor-not-allowed"
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-2 text-center text-[12px] text-[#6B7280]">
              Données officielles Campusen &amp; universités du Sénégal — Progression en 5 étapes
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
