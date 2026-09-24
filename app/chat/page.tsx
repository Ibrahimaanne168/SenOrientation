"use client";

import { useRef, useEffect } from "react";
import { useChat } from "ai/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Image from "next/image";
import {
  Send,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
  AlertTriangle,
  LogOut,
  User,
  Compass,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

/* ─── Questions de démarrage ─────────────────────────────────────────── */
const STARTER_QUESTIONS = [
  "Quelles filières après un Bac S2 au Sénégal ?",
  "Comment fonctionne Campusen pour l'orientation ?",
  "Conditions pour obtenir une bourse de l'État ?",
  "Débouchés d'ingénieur à l'ESP de Dakar ?",
];

/* ─── Horodatage ─────────────────────────────────────────────────────── */
function formatTime(date: Date): string {
  return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

/* ─── Composant Markdown éditorial ─────────────────────────────────── */
function AssistantMarkdown({ content }: { content: string }) {
  return (
    <div className="prose-editorial">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Liens : ouvre dans un nouvel onglet avec sécurité rel
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

/* ─── Page principale ────────────────────────────────────────────────── */
export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: "1", title: "Orientation Bac Scientifique", date: "Aujourd'hui" },
    { id: "2", title: "Démarches Campusen & Bourses", date: "Hier" },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>("1");
  const [messageTimes, setMessageTimes] = useState<Record<string, Date>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── useChat (Vercel AI SDK officiel) ───────────────────────────── */
  const {
    messages,
    input,
    handleInputChange,
    handleSubmit: handleUseChatSubmit,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome-msg",
        role: "assistant",
        content:
          "Bonjour. Je suis votre Agent d'Orientation pour les universités et filières du Sénégal.\n\nPour commencer, quelle est votre **série de Bac** ou votre situation actuelle ? (ex : Terminale S2, Terminale L, Bac G…)",
        createdAt: new Date(),
      },
    ],
    onError: (err) => {
      // Erreur gérée via l'état `error` de useChat — log serveur uniquement
      console.error("[Chat] Erreur de stream :", err.message);
    },
    onFinish: (message) => {
      // Enregistrer l'horodatage de la réponse de l'assistant
      setMessageTimes((prev) => ({ ...prev, [message.id]: new Date() }));
    },
    body: {
      conversationId: activeConvId,
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
      // Non bloquant
    }
  }, []);

  /* ─── Défilement automatique ─────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ─── Redimensionnement textarea ─────────────────────────────────── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 160)}px`;
    }
  }, [input]);

  /* ─── Nouvelle discussion ─────────────────────────────────────────── */
  const handleNewChat = () => {
    const newId = Date.now().toString();
    const newConv: ConversationItem = {
      id: newId,
      title: "Nouvelle discussion",
      date: "À l'instant",
    };
    setConversations((prev) => [newConv, ...prev]);
    setActiveConvId(newId);
    setMessages([
      {
        id: `welcome-${newId}`,
        role: "assistant",
        content:
          "Bonjour. Comment puis-je vous guider dans votre projet d'orientation au Sénégal ?",
        createdAt: new Date(),
      },
    ]);
  };

  /* ─── Envoi avec question de démarrage ───────────────────────────── */
  const handleStarterQuestion = (question: string) => {
    const fakeEvent = {
      preventDefault: () => {},
    } as React.FormEvent<HTMLFormElement>;
    // Injecter dans input puis soumettre via un POST simulé
    handleUseChatSubmit(fakeEvent, { data: { content: question } });
  };

  /* ─── Envoi avec Entrée (sans Shift) ─────────────────────────────── */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleUseChatSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  /* ─── Mise à jour du titre de conversation ───────────────────────── */
  useEffect(() => {
    const lastUserMessage = [...messages].reverse().find((m) => m.role === "user");
    if (lastUserMessage) {
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeConvId && c.title === "Nouvelle discussion"
            ? {
                ...c,
                title:
                  lastUserMessage.content.slice(0, 32) +
                  (lastUserMessage.content.length > 32 ? "…" : ""),
              }
            : c
        )
      );
    }
  }, [messages, activeConvId]);

  /* ─── Rendu ────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#FBFAF7] text-[#1A1A1A]">

      {/* ══════════════════════════════════════════════════════════════
          SIDEBAR — fond légèrement plus chaud que paper
      ══════════════════════════════════════════════════════════════ */}
      <aside
        aria-label="Historique des discussions"
        className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-[#E8E5DF] bg-[#F5F3EE] transition-all duration-200 md:static ${
          sidebarOpen ? "w-64 translate-x-0" : "-translate-x-full md:w-0 md:translate-x-0 md:hidden"
        }`}
      >
        {/* En-tête Sidebar */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#E8E5DF]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full border border-[#0B2545] flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Logo SenOrientation"
                width={20}
                height={20}
                className="object-contain"
              />
            </div>
            <div>
              {/* Signature typographique : petites capitales + letter-spacing */}
              <span
                className="block text-[11px] font-semibold uppercase tracking-widest text-[#0B2545]"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                SenOrientation
              </span>
              <span
                className="block text-[10px] uppercase tracking-widest text-[#6B6B6B]"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Orientation SN
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer la barre latérale"
            className="p-1 text-[#6B6B6B] hover:text-[#0B2545] rounded transition-colors md:hidden"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Bouton Nouvelle Discussion — accent or sur le lien */}
        <div className="px-3 py-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-[#0B2545] border border-[#0B2545]/20 rounded-sm hover:border-[#C9A227] hover:text-[#C9A227] transition-all"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="uppercase tracking-wider text-[10px]">Nouvelle discussion</span>
          </button>
        </div>

        {/* Liste des conversations */}
        <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-px">
          <p
            className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#6B6B6B] mb-1"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Historique
          </p>
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => setActiveConvId(conv.id)}
              className={`w-full flex items-start gap-2 px-3 py-2 text-xs rounded-sm text-left transition-all ${
                conv.id === activeConvId
                  ? "bg-[#0B2545]/6 text-[#0B2545] border-l border-[#0B2545]"
                  : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#EEECE7]"
              }`}
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <MessageSquare className="w-3 h-3 shrink-0 mt-0.5 opacity-60" />
              <span className="truncate flex-1 leading-tight">{conv.title}</span>
            </button>
          ))}
        </nav>

        {/* Pied de sidebar */}
        <div className="px-3 py-3 border-t border-[#E8E5DF]">
          {userEmail ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 min-w-0">
                <User className="w-3 h-3 text-[#6B6B6B] shrink-0" />
                <span
                  className="text-[10px] text-[#6B6B6B] truncate"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  {userEmail}
                </span>
              </div>
              <button
                onClick={async () => {
                  const supabase = createClient();
                  await supabase.auth.signOut();
                  setUserEmail(null);
                }}
                title="Se déconnecter"
                aria-label="Se déconnecter"
                className="p-1 text-[#6B6B6B] hover:text-red-600 rounded transition-colors"
              >
                <LogOut className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center justify-center gap-1.5 w-full py-2 text-[10px] font-semibold uppercase tracking-widest text-[#0B2545] border border-[#0B2545]/20 rounded-sm hover:border-[#C9A227] hover:text-[#C9A227] transition-all"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              <User className="w-3 h-3" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════
          ZONE CENTRALE
      ══════════════════════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[#FBFAF7]">

        {/* HEADER — fond navy très fin, signature typographique */}
        <header className="shrink-0 border-b border-[#E8E5DF] bg-[#FBFAF7] px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {!sidebarOpen && (
              <button
                onClick={() => setSidebarOpen(true)}
                aria-label="Ouvrir la barre latérale"
                className="p-1 text-[#6B6B6B] hover:text-[#0B2545] rounded transition-colors"
              >
                <PanelLeftOpen className="w-4 h-4" />
              </button>
            )}
            <div>
              {/* Nom agent avec filet bicolore navy+or en dessous */}
              <h1
                className="text-sm font-semibold text-[#0B2545] uppercase tracking-widest leading-none"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                Agent d&apos;Orientation
              </h1>
              {/* Filet signature : navy + or */}
              <div className="flex mt-1" aria-hidden="true">
                <div className="h-px w-6 bg-[#0B2545]" />
                <div className="h-px w-4 bg-[#C9A227]" />
              </div>
            </div>
          </div>
          {/* Badge sources — texte sobre, pas d'icône animée */}
          <p
            className="hidden sm:block text-[10px] uppercase tracking-widest text-[#6B6B6B]"
            style={{ fontFamily: "Inter, sans-serif" }}
          >
            Sources : universités officielles &amp; Campusen
          </p>
        </header>

        {/* ZONE MESSAGES */}
        <div className="flex-1 overflow-y-auto py-8 px-4 sm:px-6 md:px-12">
          <div className="max-w-2xl mx-auto space-y-8">
            {messages.map((msg) => {
              const time = msg.createdAt
                ? formatTime(new Date(msg.createdAt))
                : messageTimes[msg.id]
                ? formatTime(messageTimes[msg.id])
                : null;

              if (msg.role === "assistant") {
                return (
                  <article key={msg.id} className="flex gap-0">
                    {/* Filet vertical gauche navy/30 */}
                    <div
                      className="shrink-0 w-px bg-[#0B2545]/20 mr-6 mt-1"
                      aria-hidden="true"
                    />
                    <div className="flex-1 py-6 min-w-0">
                      <AssistantMarkdown content={msg.content} />
                      {time && (
                        <p
                          className="mt-3 text-[10px] text-[#6B6B6B]"
                          style={{ fontFamily: "Inter, sans-serif" }}
                          aria-label={`Envoyé à ${time}`}
                        >
                          {time}
                        </p>
                      )}
                    </div>
                  </article>
                );
              }

              // Message utilisateur
              return (
                <article key={msg.id} className="flex justify-end">
                  <div className="max-w-[75%]">
                    <div
                      className="bg-[#F1F0EC] text-[#1A1A1A] px-4 py-3 rounded-sm"
                      style={{ fontFamily: "Inter, sans-serif", fontSize: "0.875rem", lineHeight: "1.6" }}
                    >
                      {msg.content}
                    </div>
                    {time && (
                      <p
                        className="mt-1 text-[10px] text-[#6B6B6B] text-right"
                        style={{ fontFamily: "Inter, sans-serif" }}
                      >
                        {time}
                      </p>
                    )}
                  </div>
                </article>
              );
            })}

            {/* Indicateur de chargement : caret clignotant */}
            {isLoading && (
              <article className="flex gap-0">
                <div className="shrink-0 w-px bg-[#0B2545]/20 mr-6 mt-1" aria-hidden="true" />
                <div className="flex-1 py-6">
                  <p
                    className="loading-caret text-[#6B6B6B] italic text-sm"
                    style={{ fontFamily: "var(--font-serif-var), Georgia, serif" }}
                    aria-live="polite"
                    aria-label="L'agent rédige une réponse"
                  >
                    Réflexion en cours
                  </p>
                </div>
              </article>
            )}

            {/* Erreur de stream — message propre, jamais de contenu brut */}
            {error && !isLoading && (
              <div
                role="alert"
                className="flex items-start gap-3 p-4 border border-[#E8E5DF] rounded-sm bg-[#FDF8F3]"
              >
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p
                    className="text-sm font-medium text-[#1A1A1A]"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    Une erreur est survenue
                  </p>
                  <p
                    className="text-xs text-[#6B6B6B] mt-0.5"
                    style={{ fontFamily: "Inter, sans-serif" }}
                  >
                    Veuillez réessayer. Si le problème persiste, rafraîchissez la page.
                  </p>
                </div>
              </div>
            )}

            {/* Suggestions de démarrage */}
            {messages.length === 1 && !isLoading && (
              <div className="pt-4">
                <p
                  className="text-[10px] font-semibold uppercase tracking-widest text-[#6B6B6B] mb-4 flex items-center gap-2"
                  style={{ fontFamily: "Inter, sans-serif" }}
                >
                  <Sparkles className="w-3 h-3 text-[#C9A227]" />
                  Suggestions fréquentes
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {STARTER_QUESTIONS.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleStarterQuestion(q)}
                      className="group text-left text-xs px-4 py-3 border border-[#E8E5DF] rounded-sm hover:border-[#0B2545] text-[#1A1A1A] transition-all flex items-start gap-2.5 bg-white"
                      style={{ fontFamily: "Inter, sans-serif" }}
                    >
                      <Compass className="w-3 h-3 text-[#6B6B6B] shrink-0 mt-0.5 group-hover:text-[#0B2545] transition-colors" />
                      <span className="leading-snug group-hover:text-[#0B2545] transition-colors">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* CHAMP DE SAISIE */}
        <div className="shrink-0 border-t border-[#E8E5DF] bg-[#FBFAF7] px-4 sm:px-6 md:px-12 py-4">
          <div className="max-w-2xl mx-auto">
            <form
              onSubmit={handleUseChatSubmit}
              className="flex items-end gap-3"
            >
              <label htmlFor="chat-input" className="sr-only">
                Posez votre question d&apos;orientation
              </label>
              <div className="flex-1 relative">
                <textarea
                  id="chat-input"
                  ref={textareaRef}
                  rows={1}
                  value={input}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Votre question d'orientation…"
                  disabled={isLoading}
                  aria-label="Votre question d'orientation"
                  className="w-full resize-none bg-white border border-[#D1CFC9] rounded-sm px-4 py-3 text-sm text-[#1A1A1A] placeholder:text-[#A8A69F] focus:outline-none focus:border-[#C9A227] max-h-40 overflow-y-auto transition-colors"
                  style={{ fontFamily: "Inter, sans-serif", lineHeight: "1.5" }}
                />
              </div>
              {/* Bouton envoi : icône monochrome navy, pas de fond bleu flashy */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer le message"
                className="shrink-0 p-3 border border-[#0B2545] text-[#0B2545] rounded-sm hover:bg-[#0B2545] hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
            <p
              className="text-[10px] text-center text-[#6B6B6B] mt-2 uppercase tracking-wider"
              style={{ fontFamily: "Inter, sans-serif" }}
            >
              Données officielles — Universités publiques &amp; Campusen.sec.gouv.sn
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
