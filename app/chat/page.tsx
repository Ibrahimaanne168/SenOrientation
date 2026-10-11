"use client";

import { useRef, useEffect, useState } from "react";
import { useChat } from "ai/react";
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
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ─── 4 Suggestions en petites bulles arrondies (chips) ───────────────── */
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

/* ─── Rendu Markdown sans serif, 16px, interligne 1.6, gras en 600 ─────── */
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

  /* ─── Récupération session utilisateur ──────────────────────────── */
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

  /* ─── Mise à jour du titre de conversation ───────────────────────── */
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

  /* ─── Démarrer une nouvelle discussion ───────────────────────────── */
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

  /* ─── Touche Entrée pour envoyer ─────────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  /* ─── Copier le texte ────────────────────────────────────────────── */
  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

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
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-64 bg-[#F7F7F8] border-r border-[#E5E7EB] transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* En-tête de la sidebar */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#E5E7EB]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F7B4F] shrink-0" />
            <span className="font-semibold text-[15px] text-[#1F2937]">
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

        {/* Bouton Nouvelle discussion */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[14px] font-medium text-[#1F2937] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4 text-[#6B7280]" />
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
                    ? "bg-[#0F7B4F] text-white font-medium"
                    : "text-[#4B5563] hover:bg-white hover:text-[#1F2937]"
                }`}
              >
                <MessageSquare
                  className={`w-3.5 h-3.5 shrink-0 ${
                    isActive ? "text-white" : "text-[#9CA3AF]"
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
            <div className="flex items-center justify-between px-2 py-1.5 text-[12.5px] text-[#4B5563]">
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
              className="flex items-center justify-center gap-2 py-2 px-3 text-[13px] font-medium text-[#1F2937] bg-white border border-[#E5E7EB] hover:bg-gray-50 rounded-lg transition-colors w-full"
            >
              <User className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE PRINCIPALE (FOND BLANC PUR #FFFFFF)
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-white">

        {/* En-tête simple et aéré */}
        <header className="shrink-0 h-13 border-b border-[#E5E7EB] px-4 sm:px-6 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
              className="p-1.5 text-[#6B7280] hover:text-[#1F2937] md:hidden"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-[15px] text-[#1F2937]">
                SenOrientation
              </span>
              <span className="text-[#9CA3AF] hidden sm:inline">•</span>
              <span className="text-[13px] text-[#6B7280] hidden sm:inline">
                Orientation post-Bac au Sénégal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[12px] text-[#6B7280] bg-[#F7F7F8] px-2.5 py-1 rounded-full border border-[#E5E7EB]">
              Campusen &amp; Universités publiques
            </span>
          </div>
        </header>

        {/* Zone des messages */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 md:py-8 bg-white">
          <div className="max-w-[700px] mx-auto space-y-5">

            {/* Fil des messages avec bulles classiques */}
            {messages.map((msg) => {
              const isBot = msg.role === "assistant";

              if (isBot) {
                return (
                  <div key={msg.id} className="flex justify-start">
                    <div className="max-w-[88%] sm:max-w-[82%] bg-[#F3F4F6] text-[#1F2937] rounded-2xl rounded-tl-sm px-4 sm:px-5 py-3.5 relative group">
                      <BotMessageMarkdown content={msg.content} />

                      {/* Bouton copier discret */}
                      <div className="mt-2 pt-1 flex justify-end">
                        <button
                          onClick={() => handleCopy(msg.content, msg.id)}
                          className="text-[#9CA3AF] hover:text-[#4B5563] p-0.5 rounded transition-colors"
                          title="Copier"
                        >
                          {copiedId === msg.id ? (
                            <Check className="w-3 h-3 text-[#0F7B4F]" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                );
              }

              /* Message de l'élève (droite, fond vert profond #0F7B4F, texte blanc) */
              return (
                <div key={msg.id} className="flex justify-end">
                  <div className="max-w-[85%] sm:max-w-[78%] bg-[#0F7B4F] text-white rounded-2xl rounded-tr-sm px-4 sm:px-5 py-3 text-[15px] leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Indicateur de saisie/génération */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-[#F3F4F6] text-[#6B7280] rounded-2xl rounded-tl-sm px-4 py-3 text-[14px] flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#0F7B4F] animate-pulse" />
                  <span>Recherche des filières officielles...</span>
                </div>
              </div>
            )}

            {/* Message d'erreur si la requête échoue */}
            {error && (
              <div className="p-3.5 bg-red-50 border border-red-200 rounded-lg text-red-800 text-[13.5px] flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <p>
                  Une erreur est survenue lors de l&apos;envoi. Merci de vérifier votre connexion et de réessayer.
                </p>
              </div>
            )}

            {/* 4 Suggestions sous forme de petites bulles arrondies cliquables (chips) */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-3">
                <p className="text-[12.5px] font-medium text-[#6B7280] mb-2.5">
                  Suggestions :
                </p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTIONS.map((sug, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSuggestionClick(sug)}
                      className="text-left text-[13px] text-[#374151] bg-[#F7F7F8] hover:bg-[#E5E7EB] hover:text-[#111827] border border-[#E5E7EB] px-3.5 py-1.5 rounded-full transition-colors"
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
            ZONE DE SAISIE FIXE EN BAS
        ════════════════════════════════════════════ */}
        <div className="shrink-0 p-3 sm:p-4 bg-white border-t border-[#E5E7EB]">
          <div className="max-w-[700px] mx-auto">
            <form
              onSubmit={handleSubmit}
              className="flex items-end gap-2 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-2 focus-within:border-[#0F7B4F] focus-within:bg-white transition-colors"
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

              {/* Bouton d'envoi rond en vert profond #0F7B4F */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className="w-9 h-9 rounded-lg bg-[#0F7B4F] hover:bg-[#0D6943] text-white flex items-center justify-center transition-colors disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            {/* Pied de page discret en casse normale */}
            <p className="mt-2 text-center text-[11px] text-[#9CA3AF]">
              Données issues des universités publiques et de campusen.sec.gouv.sn
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
