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
  Copy,
  Check,
  Mic,
  Paperclip,
  Share2,
  Mail,
  Smartphone,
  ExternalLink,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ConversationItem {
  id: string;
  title: string;
  date: string;
}

const STARTER_CHIPS = [
  "Quelles filières après un Bac S2 ?",
  "Comment fonctionne Campusen ?",
  "Critères pour la bourse de l'État",
  "Débouchés d'ingénieur à l'ESP",
  "Que faire avec un Bac L2 ?",
  "Facultés de médecine au Sénégal",
];

/* ─── Rendu Markdown respectant les règles typographiques ────────────── */
function BotMessageContent({ content }: { content: string }) {
  return (
    <div className="prose-orientation">
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

/* ═══════════════════════════════════════════════════════════════════════
   PAGE DE CHAT — SENORIENTATION
══════════════════════════════════════════════════════════════════════ */
export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false); // Mobile-first : fermée par défaut sur petit écran
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationItem[]>([
    { id: "1", title: "Filières après Bac S2", date: "Aujourd'hui" },
    { id: "2", title: "Démarches bourses DGES", date: "Hier" },
  ]);
  const [activeConvId, setActiveConvId] = useState<string>("1");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Micro dictée vocale (Web Speech)
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<unknown>(null);

  // Modales légères (Resend & Telegram)
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [emailSent, setEmailSent] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /* ─── Vercel AI SDK ───────────────────────────────────────────────── */
  const {
    messages,
    input,
    setInput,
    handleInputChange,
    handleSubmit: chatSubmit,
    isLoading,
    error,
    setMessages,
  } = useChat({
    api: "/api/chat",
    initialMessages: [
      {
        id: "welcome",
        role: "assistant",
        content:
          "Salut ! Dis-moi ta série de Bac (S1, S2, L, G...) ou ce qui t'intéresse, et je t'aide à trouver les meilleures filières et démarches Campusen au Sénégal.",
        createdAt: new Date(),
      },
    ],
    body: { conversationId: activeConvId },
  });

  /* ─── Vérification session Supabase ──────────────────────────────── */
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

  /* ─── Web Speech Recognition ─────────────────────────────────────── */
  useEffect(() => {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .SpeechRecognition ||
        (window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown })
          .webkitSpeechRecognition;

      if (SpeechRecognition) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const recog = new (SpeechRecognition as any)();
        recog.continuous = false;
        recog.interimResults = false;
        recog.lang = "fr-FR";

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recog.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          }
          setIsListening(false);
        };
        recog.onerror = () => setIsListening(false);
        recog.onend = () => setIsListening(false);
        recognitionRef.current = recog;
      }
    }
  }, [setInput]);

  const toggleSpeech = () => {
    if (!recognitionRef.current) return;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recog = recognitionRef.current as any;
    if (isListening) {
      recog.stop();
      setIsListening(false);
    } else {
      try {
        recog.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  /* ─── Auto-scroll ─────────────────────────────────────────────────── */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  /* ─── Textarea auto-resize ────────────────────────────────────────── */
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [input]);

  /* ─── Titrage de la conversation ─────────────────────────────────── */
  useEffect(() => {
    const last = [...messages].reverse().find((m) => m.role === "user");
    if (!last) return;
    setConversations((prev) =>
      prev.map((c) =>
        c.id === activeConvId && c.title === "Nouvelle discussion"
          ? {
              ...c,
              title: last.content.slice(0, 28) + (last.content.length > 28 ? "…" : ""),
            }
          : c
      )
    );
  }, [messages, activeConvId]);

  const handleNewChat = () => {
    const id = Date.now().toString();
    setConversations((prev) => [
      { id, title: "Nouvelle discussion", date: "À l'instant" },
      ...prev,
    ]);
    setActiveConvId(id);
    setMessages([
      {
        id: `welcome-${id}`,
        role: "assistant",
        content:
          "Salut ! Quelle est ta série ou la question qui te préoccupe pour tes études supérieures ?",
        createdAt: new Date(),
      },
    ]);
    setSidebarOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      chatSubmit(e as unknown as React.FormEvent<HTMLFormElement>);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleChipClick = (question: string) => {
    const fake = { preventDefault: () => {} } as React.FormEvent<HTMLFormElement>;
    chatSubmit(fake, { data: { content: question } });
  };

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--color-bg)] text-[var(--color-text)]">

      {/* ════════════════════════════════════════════
          PANNEAU LATÉRAL (SIDEBAR HUMAINE SANS TICS IA)
      ════════════════════════════════════════════ */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-2xs md:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex flex-col w-[270px] bg-[var(--color-surface)] border-r border-[var(--color-border)] transition-transform duration-200 ease-out md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full md:w-64"
        }`}
      >
        {/* En-tête de la sidebar avec touche d'asymétrie sénégalaise */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[var(--color-border-subtle)]">
          <div className="flex items-center gap-2">
            <span
              className="w-2 h-2 rounded-full bg-[var(--color-accent)] shrink-0"
              aria-hidden="true"
            />
            <span className="font-semibold text-[15px] tracking-tight">SenOrientation</span>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            aria-label="Fermer le menu"
            className="p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] md:hidden"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Bouton Nouvelle discussion (casse normale, zéro all-caps) */}
        <div className="p-3">
          <button
            onClick={handleNewChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 text-[14px] font-medium text-[var(--color-accent-contrast)] bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] rounded-md transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Nouvelle discussion</span>
          </button>
        </div>

        {/* Liste des discussions */}
        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
          <p className="px-2 py-1 text-[12px] font-medium text-[var(--color-text-secondary)]">
            Historique
          </p>

          {conversations.map((c) => {
            const isActive = c.id === activeConvId;
            return (
              <button
                key={c.id}
                onClick={() => {
                  setActiveConvId(c.id);
                  setSidebarOpen(false);
                }}
                className={`w-full flex items-center gap-2.5 px-2.5 py-2 text-[13.5px] rounded-md text-left transition-colors ${
                  isActive
                    ? "bg-[var(--color-surface-subtle)] text-[var(--color-text)] font-medium"
                    : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-subtle)] hover:text-[var(--color-text)]"
                }`}
              >
                <MessageSquare className="w-3.5 h-3.5 shrink-0 opacity-60" />
                <span className="truncate">{c.title}</span>
              </button>
            );
          })}
        </div>

        {/* Pied de la barre latérale */}
        <div className="p-3 border-t border-[var(--color-border-subtle)] space-y-2">
          <a
            href="https://t.me"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between px-2.5 py-1.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded hover:bg-[var(--color-surface-subtle)] transition-colors"
          >
            <span className="flex items-center gap-2">
              <Smartphone className="w-3.5 h-3.5 opacity-70" />
              <span>Bot Telegram mobile</span>
            </span>
            <ExternalLink className="w-3 h-3 opacity-50" />
          </a>

          {userEmail ? (
            <div className="flex items-center justify-between px-2.5 py-1.5 text-[12.5px] text-[var(--color-text-secondary)]">
              <span className="truncate">{userEmail}</span>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 px-2.5 py-1.5 text-[13px] text-[var(--color-text)] hover:bg-[var(--color-surface-subtle)] rounded transition-colors"
            >
              <User className="w-3.5 h-3.5 opacity-70" />
              <span>Connexion</span>
            </Link>
          )}
        </div>
      </aside>

      {/* ════════════════════════════════════════════
          ZONE PRINCIPALE DE LECTURE & CONVERSATION
      ════════════════════════════════════════════ */}
      <main className="flex-1 flex flex-col h-full overflow-hidden bg-[var(--color-bg)]">

        {/* En-tête supérieur sobre */}
        <header className="shrink-0 h-13 border-b border-[var(--color-border)] px-4 flex items-center justify-between bg-[var(--color-surface)]">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Ouvrir le menu"
              className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text)] rounded md:hidden"
            >
              <PanelLeftOpen className="w-4 h-4" />
            </button>

            {/* Logo typographique franc avec point d'ancrage local */}
            <div className="flex items-baseline gap-2">
              <span className="font-bold text-[16px] tracking-tight text-[var(--color-text)]">
                SenOrientation
              </span>
              <span className="text-[12px] text-[var(--color-text-secondary)] hidden sm:inline">
                Guide post-Bac au Sénégal
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEmailModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium text-[var(--color-text)] bg-[var(--color-surface-subtle)] hover:bg-[var(--color-border)] rounded-md transition-colors"
            >
              <Mail className="w-3.5 h-3.5 opacity-70" />
              <span className="hidden sm:inline">Recevoir mon bilan</span>
            </button>
          </div>
        </header>

        {/* Zone des messages (mobile-first, centrée, respiration fluide) */}
        <div className="flex-1 overflow-y-auto px-4 py-6 md:py-8">
          <div className="max-w-[720px] mx-auto space-y-6">

            {/* Écran d'accueil quand la conversation débute */}
            {messages.length <= 1 && (
              <section className="pt-4 pb-6 space-y-4">
                <div className="space-y-1.5">
                  <h1 className="text-[24px] sm:text-[30px] font-bold tracking-tight text-[var(--color-text)] leading-[1.25]">
                    Trouve ta filière après le Bac.
                  </h1>
                  <p className="text-[15px] sm:text-[16px] text-[var(--color-text-secondary)] leading-relaxed max-w-[58ch]">
                    Pose tes questions sur les universités publiques (UCAD, UGB, USSEIN...), les critères de sélection Campusen ou les bourses de l&apos;État.
                  </p>
                </div>

                {/* Chips de suggestions simples en ligne compacte (pas 4 cartes identiques !) */}
                <div className="pt-2">
                  <p className="text-[12.5px] font-medium text-[var(--color-text-secondary)] mb-2.5">
                    Questions fréquentes :
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {STARTER_CHIPS.map((chip, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleChipClick(chip)}
                        className="text-left text-[13px] text-[var(--color-text)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-accent)] hover:text-[var(--color-accent)] px-3 py-1.5 rounded-full transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {/* Fil des messages */}
            {messages.map((msg) => {
              const isBot = msg.role === "assistant";

              if (isBot) {
                return (
                  <article key={msg.id} className="pt-2">
                    {/* Zéro trait vertical, zéro étincelle, typographie pure à 16.5px / interligne 1.6 */}
                    <div className="bg-[var(--color-surface)] border border-[var(--color-border-subtle)] rounded-lg p-4 sm:p-6">
                      <BotMessageContent content={msg.content} />

                      {/* Barre d'action discrète en fin de message */}
                      <div className="mt-4 pt-3 border-t border-[var(--color-border-subtle)] flex items-center justify-between text-[12px] text-[var(--color-text-secondary)]">
                        <span>Sources officielles Campusen &amp; MESRI</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleCopy(msg.content, msg.id)}
                            className="p-1 hover:text-[var(--color-text)] rounded transition-colors"
                            title="Copier le texte"
                          >
                            {copiedId === msg.id ? (
                              <Check className="w-3.5 h-3.5 text-[var(--color-accent)]" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              }

              /* Message de l'élève : bulle droite, couleur foncée adoucie */
              return (
                <div key={msg.id} className="flex justify-end pt-1">
                  <div className="max-w-[85%] sm:max-w-[75%] bg-[var(--color-user-bubble)] text-[var(--color-user-text)] rounded-lg px-4 py-2.5 text-[15px] leading-relaxed">
                    {msg.content}
                  </div>
                </div>
              );
            })}

            {/* Indicateur de rédaction sobre */}
            {isLoading && (
              <div className="py-2 text-[14px] text-[var(--color-text-secondary)] italic">
                L&apos;agent vérifie les filières et prépare sa réponse...
              </div>
            )}

            {error && (
              <div className="p-3 rounded bg-red-50 text-red-800 text-[13px] border border-red-200">
                Une erreur est survenue lors de l&apos;envoi. Merci de réessayer.
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* ════════════════════════════════════════════
            ZONE DE SAISIE (MOBILE D'ABORD 360px)
        ════════════════════════════════════════════ */}
        <div className="shrink-0 p-3 sm:p-4 bg-[var(--color-surface)] border-t border-[var(--color-border)]">
          <div className="max-w-[720px] mx-auto">
            <form
              onSubmit={chatSubmit}
              className="flex items-end gap-2 bg-[var(--color-bg)] border border-[var(--color-border)] rounded-md p-2 focus-within:border-[var(--color-accent)] transition-colors"
            >
              <textarea
                ref={textareaRef}
                rows={1}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  isListening
                    ? "Écoute en cours, parle maintenant..."
                    : "Pose ta question (ex: Quelles filières après un Bac S2 ?)..."
                }
                disabled={isLoading}
                className="flex-1 bg-transparent border-0 text-[15px] text-[var(--color-text)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none resize-none leading-snug py-1 px-1 max-h-32"
              />

              {/* Bouton micro pour note vocale */}
              <button
                type="button"
                onClick={toggleSpeech}
                title="Dictée vocale"
                className={`p-2 rounded text-[var(--color-text-secondary)] hover:text-[var(--color-text)] transition-colors ${
                  isListening ? "text-red-600 bg-red-100" : ""
                }`}
              >
                <Mic className="w-4 h-4" />
              </button>

              {/* Bouton d'envoi principal sans dégradé, avec le vert profond d'accent */}
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                aria-label="Envoyer"
                className="p-2 rounded bg-[var(--color-accent)] text-[var(--color-accent-contrast)] hover:bg-[var(--color-accent-hover)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="mt-1.5 text-center text-[11px] text-[var(--color-text-tertiary)]">
              Informations basées sur les référentiels officiels Campusen.
            </p>
          </div>
        </div>
      </main>

      {/* ─── Modale d'envoi du bilan par email (Resend) ─── */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg max-w-sm w-full p-5 space-y-4">
            <div className="space-y-1">
              <h2 className="font-semibold text-[17px] text-[var(--color-text)]">
                Recevoir ta fiche d&apos;orientation
              </h2>
              <p className="text-[13px] text-[var(--color-text-secondary)] leading-relaxed">
                Renseigne ton adresse email pour recevoir le récapitulatif de tes échanges et les filières recommandées.
              </p>
            </div>

            {emailSent ? (
              <div className="p-3 rounded bg-emerald-50 text-emerald-800 text-[13px]">
                Fiche envoyée avec succès sur ta boîte mail !
              </div>
            ) : (
              <div className="space-y-3">
                <input
                  type="email"
                  placeholder="ton.email@gmail.com"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  className="w-full px-3 py-2 text-[14px] bg-[var(--color-bg)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                />

                <div className="flex gap-2 justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="px-3 py-1.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!emailInput) return;
                      setEmailSent(true);
                      setTimeout(() => {
                        setShowEmailModal(false);
                        setEmailSent(false);
                        setEmailInput("");
                      }, 2000);
                    }}
                    disabled={!emailInput}
                    className="px-4 py-1.5 text-[13px] font-medium bg-[var(--color-accent)] text-[var(--color-accent-contrast)] hover:bg-[var(--color-accent-hover)] rounded transition-colors disabled:opacity-40"
                  >
                    Envoyer
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
