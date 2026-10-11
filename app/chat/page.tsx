"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "ai/react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Send,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  User,
  LogOut,
  AlertCircle,
  Copy,
  Check,
  RotateCw,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ─── 4 Suggestions en petites bulles arrondies cliquables (chips) ─────── */
const SUGGESTIONS = [
  "Filières après Bac S2",
  "Comment fonctionne Campusen ?",
  "Conditions pour la bourse",
  "Débouchés d'ingénieur à l'ESP",
];

interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

/* ─── Rendu Markdown sans bulle (16px, interligne 1.6, h3 en 16px/600) ─── */
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
    { id: "1", title: "Orientation Bac Scientifique", date: "Aujourd'hui" },
    { id: "2", title: "Démarches Campusen & Bourses", date: "Hier" },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>("1");
  const [copiedId, setCopiedId] = useState<string | null>(null);

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
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Salut ! Dis-moi ta série de Bac (S1, S2, L, G...) et je t'aide à trouver ta filière.",
        createdAt: new Date(),
      },
    ],
    onError: (err) => {
      // eslint-disable-next-line no-console
      console.error("[Chat error]", err);
    },
  });

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

  /* ─── Nouvelle discussion ────────────────────────────────────────── */
  const handleNewChat = () => {
    const newId = Date.now().toString();
    setConversations((prev) => [
      { id: newId, title: "Nouvelle discussion", date: "À l'instant" },
      ...prev,
    ]);
    setActiveConvId(newId);
    setMessages([
      {
        id: `welcome-${newId}`,
        role: "assistant",
        content:
          "Salut ! Dis-moi ta série de Bac (S1, S2, L, G...) et je t'aide à trouver ta filière.",
        createdAt: new Date(),
      },
    ]);
    setSidebarOpen(false);
  };

  /* ─── Clic sur une suggestion (envoi direct) ─────────────────────── */
  const handleSuggestionClick = (question: string) => {
    if (isLoading) return;
    append({
      role: "user",
      content: question,
    });
  };

  /* ─── Touche Entrée pour soumettre ───────────────────────────────── */
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

  // Trouver le titre de la discussion courante pour l'en-tête
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
        {/* En-tête de la sidebar avec Logo officiel UNIQUE */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2.5">
            <Image
              src="/logo.png"
              alt="Logo SenOrientation"
              width={26}
              height={26}
              className="object-contain shrink-0"
              priority
            />
            <span className="font-semibold text-[15px] text-[#1F2937] tracking-tight">
              SenOrientation
            </span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="p-1 text-[#6B7280] hover:text-[#1F2937] md:hidden"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Bouton Nouvelle discussion = bouton plein couleur d'accent #0B3D91 */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[14px] font-medium text-white bg-[#0B3D91] hover:bg-[#082E6E] rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle discussion</span>
          </button>
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

        {/* Pied de sidebar : lien texte simple Connexion / Déconnexion */}
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

        {/* En-tête : Titre de la discussion + Badge discret (aucun logo ici) */}
        <header className="shrink-0 h-13 border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="p-1.5 text-[#6B7280] hover:text-[#1F2937] md:hidden shrink-0"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            {/* Titre de la discussion en casse normale */}
            <h1 className="text-[14.5px] font-medium text-[#1F2937] truncate">
              {headerTitle}
            </h1>
          </div>

          {/* Badge discret Campusen */}
          <div className="shrink-0">
            <span className="text-[12px] text-[#6B7280] bg-[#F9FAFB] px-2.5 py-1 rounded-md border border-[#E5E7EB]">
              Campusen &amp; Universités publiques
            </span>
          </div>
        </header>

        {/* Zone des messages (760px max) */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 md:py-8 bg-white">
          <div className="max-w-[760px] mx-auto space-y-6">

            {/* Fil des messages */}
            {messages.map((msg) => {
              const isBot = msg.role === "assistant";

              if (isBot) {
                return (
                  /* Bot : SANS BULLE, texte directement sur fond blanc avec avatar rond à gauche */
                  <div key={msg.id} className="flex items-start gap-3.5 group pt-1">
                    {/* Petit avatar rond */}
                    <div className="w-7 h-7 rounded-full bg-[#0B3D91] text-white flex items-center justify-center font-semibold text-[11px] shrink-0 mt-0.5 select-none">
                      S
                    </div>

                    <div className="flex-1 min-w-0">
                      <BotMessageMarkdown content={msg.content} />

                      {/* Boutons copier / régénérer visibles SEULEMENT AU SURVOL */}
                      <div className="mt-2 flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
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

              /* Utilisateur : bulle à droite, couleur d'accent #0B3D91, rayon 16px, padding 10px 16px, texte blanc */
              return (
                <div key={msg.id} className="flex justify-end pt-1">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-[#0B3D91] text-white rounded-[16px] px-4 py-2.5 text-[15px] leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Indicateur de saisie/chargement */}
            {isLoading && (
              <div className="flex items-center gap-3 pt-1">
                <div className="w-7 h-7 rounded-full bg-[#0B3D91] text-white flex items-center justify-center font-semibold text-[11px] shrink-0">
                  S
                </div>
                <div className="text-[14px] text-[#6B7280] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#0B3D91] animate-pulse" />
                  <span>Recherche des filières officielles...</span>
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

            {/* 4 Suggestions (chips) cliquables au démarrage */}
            {messages.length === 1 && !isLoading && (
              <div className="pl-10 pt-2">
                <p className="text-[12.5px] font-medium text-[#4B5563] mb-2.5">
                  Suggestions :
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(sug)}
                      className="text-left text-[13px] font-medium text-[#1F2937] bg-[#F3F4F6] hover:bg-[#E5E7EB] hover:text-[#0B3D91] border border-[#D1D5DB] px-3.5 py-1.5 rounded-full transition-colors cursor-pointer"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
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
            {/* Champ avec bordure 1px grise, rayon 14px, focus en couleur d'accent */}
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
                placeholder="Pose ta question d'orientation..."
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 text-[15px] text-[#1F2937] placeholder:text-[#9CA3AF] focus:outline-none resize-none leading-relaxed py-1 px-1.5 max-h-32"
              />

              {/* Bouton d'envoi rond : gris quand vide, accent plein #0B3D91 quand actif */}
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

            {/* Pied de page en 12px gris, casse normale */}
            <p className="mt-2 text-center text-[12px] text-[#6B7280]">
              Données issues des universités publiques et de campusen.sec.gouv.sn
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
