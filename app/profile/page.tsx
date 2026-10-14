"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Save,
  MessageSquare,
  User,
  GraduationCap,
  BookOpen,
  Compass,
  MapPin,
  Clock,
  Loader2,
  AlertCircle,
  LogOut,
} from "lucide-react";
import BrandLogo from "@/components/BrandLogo";

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Données utilisateur
  const [user, setUser] = useState<any>(null);

  // Champs du profil
  const [etablissement, setEtablissement] = useState("");
  const [classe, setClasse] = useState("");
  const [serie, setSerie] = useState("");
  const [annee, setAnnee] = useState("2026-2027");
  const [matieres, setMatieres] = useState<string[]>([]);
  const [centresInteret, setCentresInteret] = useState<string[]>([]);
  const [formations, setFormations] = useState("");
  const [duree, setDuree] = useState("");
  const [ville, setVille] = useState("");
  const [budget, setBudget] = useState("");

  const MATIERES_LIST = [
    "Mathématiques",
    "Sciences Physiques",
    "SVT (Biologie/Géologie)",
    "Français & Littérature",
    "Philosophie",
    "Histoire & Géographie",
    "Anglais",
    "Sciences Économiques & Gestion",
    "Informatique",
  ];

  const CENTRES_INTERET_LIST = [
    "Informatique & IA",
    "Santé & Médecine",
    "Génie civil & BTP",
    "Agronomie & Environnement",
    "Économie & Finance",
    "Droit & Sciences politiques",
    "Communication & Médias",
    "Arts & Métiers créatifs",
  ];

  useEffect(() => {
    async function loadProfile() {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          // Si non connecté, on permet quand même de consulter la page ou on lit depuis le profil local
          const localStored = localStorage.getItem("senorientation_student_profile");
          if (localStored) {
            try {
              const p = JSON.parse(localStored);
              setEtablissement(p.etablissement_actuel || "");
              setClasse(p.classe_actuelle || "");
              setSerie(p.serie || "");
              setMatieres(p.matieres_preferees || []);
              setCentresInteret(p.centres_interet || []);
              setFormations((p.formations_envisagees || []).join(", "));
              setDuree(p.contraintes_utiles?.duree || "");
              setVille(p.contraintes_utiles?.ville || "");
              setBudget(p.contraintes_utiles?.budget || "");
            } catch {}
          }
          setLoading(false);
          return;
        }

        const data = await res.json();
        if (data.authenticated && data.user) {
          setUser(data.user);
          const p = data.user.profile || {};
          setEtablissement(p.etablissement_actuel || "");
          setClasse(p.classe_actuelle || "");
          setSerie(p.serie || "");
          setAnnee(p.annee_etudes_souhaitee || "2026-2027");
          setMatieres(p.matieres_preferees || []);
          setCentresInteret(p.centres_interet || []);
          setFormations((p.formations_envisagees || []).join(", "));
          setDuree(p.contraintes_utiles?.duree || "");
          setVille(p.contraintes_utiles?.ville || "");
          setBudget(p.contraintes_utiles?.budget || "");
        }
      } catch {
        // Ignorer
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, []);

  const toggleMatiere = (m: string) => {
    setMatieres((prev) =>
      prev.includes(m) ? prev.filter((item) => item !== m) : [...prev, m]
    );
  };

  const toggleInteret = (item: string) => {
    setCentresInteret((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  // Calcul du score de complétion dynamique
  const calculateCompleteness = () => {
    let score = 20; // Accès
    if (etablissement.trim()) score += 10;
    if (classe.trim()) score += 15;
    if (serie.trim()) score += 15;
    if (matieres.length > 0) score += 15;
    if (centresInteret.length > 0) score += 15;
    if (formations.trim()) score += 5;
    if (ville.trim() || duree.trim()) score += 5;
    return Math.min(100, score);
  };

  const completeness = calculateCompleteness();

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    const payload = {
      etablissement_actuel: etablissement.trim(),
      classe_actuelle: classe.trim(),
      serie: serie.trim(),
      annee_etudes_souhaitee: annee.trim(),
      matieres_preferees: matieres,
      centres_interet: centresInteret,
      formations_envisagees: formations
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean),
      contraintes_utiles: {
        duree: duree.trim(),
        ville: ville.trim(),
        budget: budget.trim(),
      },
    };

    try {
      // Sauvegarde serveur si connecté
      if (user) {
        await fetch("/api/auth/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      // Sauvegarde locale pour synchronisation directe avec le chat
      localStorage.setItem("senorientation_student_profile", JSON.stringify(payload));

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch {
      setError("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/login");
    } catch {
      router.push("/login");
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-app)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--gold-primary)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-app)] text-[var(--text-main)] font-sans pb-16">
      {/* Barre supérieure fixe */}
      <header className="h-16 border-b border-[var(--border-main)] px-4 sm:px-8 flex items-center justify-between bg-[var(--bg-card)]/90 backdrop-blur-md sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="p-2 text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--bg-hover)] rounded-xl transition-colors"
            title="Retour au chat"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2.5">
            <BrandLogo size={32} />
            <span className="font-serif font-bold text-lg tracking-wider uppercase">
              <span className="text-[var(--text-main)]">JAN</span>
              <span className="text-[var(--brand-green)] dark:text-[var(--brand-sand)]">GORA</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/chat"
            className="flex items-center gap-2 px-3.5 py-1.5 text-[13px] font-bold text-[var(--btn-primary-text)] bg-[var(--btn-primary-bg)] rounded-xl shadow-2xs hover:brightness-105 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>Aller au chat</span>
          </Link>
          {user && (
            <button
              onClick={handleLogout}
              className="p-2 text-[var(--text-muted)] hover:text-red-500 rounded-xl transition-colors"
              title="Se déconnecter"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 pt-8 space-y-6">
        {/* Titre & Message d'accueil */}
        <div>
          <h1 className="font-serif font-bold text-2xl sm:text-3xl tracking-tight">
            Mon profil d&apos;orientation
          </h1>
          <p className="text-[13.5px] text-[var(--text-muted)] mt-1">
            Complétez progressivement ces informations pour affiner les recommandations de Jangora. Vous pouvez discuter librement même sans remplir tous les champs !
          </p>
        </div>

        {/* Jauge de progression facultative */}
        <div className="p-4 sm:p-5 bg-[var(--gold-light)] border border-[var(--gold-border)] rounded-2xl space-y-3 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[13.5px] font-bold text-[var(--gold-primary)] flex items-center gap-2">
              <GraduationCap className="w-4.5 h-4.5" />
              <span>Complétion du profil d&apos;orientation</span>
            </span>
            <span className="px-2.5 py-0.5 rounded-full text-[12px] font-bold bg-[var(--bg-card)] text-[var(--gold-primary)] border border-[var(--gold-border)]">
              {completeness}%
            </span>
          </div>
          <div className="h-2 w-full bg-[var(--border-main)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--gold-primary)] transition-all duration-500 rounded-full"
              style={{ width: `${completeness}%` }}
            />
          </div>
          <p className="text-[11.5px] text-[var(--text-muted)] italic">
            {completeness >= 80
              ? "Excellent ! Votre profil est complet pour des recommandations ultra-ciblées."
              : "La complétion est facultative : Jangora peut aussi découvrir ces éléments au fil de la discussion."}
          </p>
        </div>

        {/* Formulaire de profil */}
        <form onSubmit={handleSave} className="space-y-6">
          {/* Section 1 : Identité officielle */}
          <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3">
              <User className="w-4 h-4 text-[var(--gold-primary)]" />
              <h2 className="font-bold text-[15px]">Identité de l&apos;élève</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[13.5px]">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Nom complet
                </label>
                <div className="p-2.5 bg-[var(--bg-hover)] border border-[var(--border-main)] rounded-xl font-semibold">
                  {user?.fullName || "Élève Jangora"}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
                  Adresse e-mail vérifiée
                </label>
                <div className="p-2.5 bg-[var(--bg-hover)] border border-[var(--border-main)] rounded-xl font-mono text-[12.5px] flex items-center justify-between">
                  <span className="truncate">{user?.email || "Non connecté"}</span>
                  {user?.email && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 : Parcours scolaire actuel */}
          <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3">
              <BookOpen className="w-4 h-4 text-[var(--gold-primary)]" />
              <h2 className="font-bold text-[15px]">Situation scolaire actuelle</h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                  Établissement actuel
                </label>
                <input
                  type="text"
                  value={etablissement}
                  onChange={(e) => setEtablissement(e.target.value)}
                  placeholder="Ex : Lycée Lamine Guèye"
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] bg-[var(--bg-input)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                  Classe / Niveau
                </label>
                <select
                  value={classe}
                  onChange={(e) => setClasse(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] bg-[var(--bg-input)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)]"
                >
                  <option value="">Sélectionner...</option>
                  <option value="Troisième (BFEM)">Troisième (BFEM)</option>
                  <option value="Seconde">Seconde</option>
                  <option value="Première">Première</option>
                  <option value="Terminale">Terminale</option>
                  <option value="Nouveau bachelier">Nouveau bachelier</option>
                  <option value="Licence 1 / Supérieur">Licence 1 / Supérieur</option>
                  <option value="En réorientation">En réorientation</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                  Série de Baccalauréat
                </label>
                <select
                  value={serie}
                  onChange={(e) => setSerie(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] bg-[var(--bg-input)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)]"
                >
                  <option value="">Sélectionner la série...</option>
                  <option value="S1">S1 (Sciences exactes & Maths)</option>
                  <option value="S2">S2 (Sciences expérimentales)</option>
                  <option value="S3">S3 (Sciences & Techniques industrielles)</option>
                  <option value="S4">S4 (Sciences agronomiques)</option>
                  <option value="S5">S5 (Sciences agroalimentaires)</option>
                  <option value="L1">L1 (Langues & Littérature)</option>
                  <option value="L2">L2 (Sciences humaines & Littérature)</option>
                  <option value="L'">L&apos; (Arts plastiques / Musique)</option>
                  <option value="G">G (Gestion & Commerce - STEG)</option>
                  <option value="T1">T1 (Génie mécanique)</option>
                  <option value="T2">T2 (Génie civil / Électronique)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 3 : Matières et centres d'intérêt */}
          <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3">
              <Compass className="w-4 h-4 text-[var(--gold-primary)]" />
              <h2 className="font-bold text-[15px]">Matières et Domaines de prédilection</h2>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-2">
                Matières où vous êtes à l&apos;aise
              </label>
              <div className="flex flex-wrap gap-2">
                {MATIERES_LIST.map((m) => {
                  const selected = matieres.includes(m);
                  return (
                    <button
                      key={m}
                      type="button"
                      onClick={() => toggleMatiere(m)}
                      className={`px-3 py-1.5 rounded-xl text-[13px] font-medium border transition-all cursor-pointer ${
                        selected
                          ? "bg-[var(--brand-green)] text-white border-[var(--brand-green)] dark:bg-[var(--brand-sand)] dark:text-[#0D2928]"
                          : "bg-[var(--bg-hover)] text-[var(--text-main)] border-[var(--border-main)] hover:border-[var(--gold-primary)]"
                      }`}
                    >
                      {m}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-2">
                Centres d&apos;intérêt professionnels
              </label>
              <div className="flex flex-wrap gap-2">
                {CENTRES_INTERET_LIST.map((item) => {
                  const selected = centresInteret.includes(item);
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => toggleInteret(item)}
                      className={`px-3 py-1.5 rounded-xl text-[13px] font-medium border transition-all cursor-pointer ${
                        selected
                          ? "bg-[var(--brand-green)] text-white border-[var(--brand-green)] dark:bg-[var(--brand-sand)] dark:text-[#0D2928]"
                          : "bg-[var(--bg-hover)] text-[var(--text-main)] border-[var(--border-main)] hover:border-[var(--gold-primary)]"
                      }`}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Section 4 : Formations envisagées & Contraintes utiles */}
          <div className="p-5 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xs space-y-4">
            <div className="flex items-center gap-2 border-b border-[var(--border-main)] pb-3">
              <MapPin className="w-4 h-4 text-[var(--gold-primary)]" />
              <h2 className="font-bold text-[15px]">Préférences et contraintes d&apos;études</h2>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                Formations ou métiers déjà envisagés
              </label>
              <input
                type="text"
                value={formations}
                onChange={(e) => setFormations(e.target.value)}
                placeholder="Ex : Licence Informatique à l'UCAD, École Polytechnique de Thiès..."
                className="w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] bg-[var(--bg-input)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                  Ville souhaitée
                </label>
                <input
                  type="text"
                  value={ville}
                  onChange={(e) => setVille(e.target.value)}
                  placeholder="Dakar, Saint-Louis, Thiès..."
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] bg-[var(--bg-input)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                  Durée d&apos;études
                </label>
                <select
                  value={duree}
                  onChange={(e) => setDuree(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] bg-[var(--bg-input)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)]"
                >
                  <option value="">Indifférent</option>
                  <option value="Courte (Bac+2 / Bac+3)">Courte (Bac+2 / Bac+3 - BTS, DUT, Licence)</option>
                  <option value="Longue (Bac+5)">Longue (Bac+5 - Master, Diplôme d&apos;ingénieur)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text-main)] mb-1.5">
                  Cadre budgétaire
                </label>
                <select
                  value={budget}
                  onChange={(e) => setBudget(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border text-[13.5px] bg-[var(--bg-input)] border-[var(--border-main)] focus:outline-none focus:border-[var(--brand-green)]"
                >
                  <option value="">Indifférent</option>
                  <option value="Public Campusen (25 000 FCFA/an)">Public Campusen (25 000 FCFA/an)</option>
                  <option value="Établissement privé accrédité">Privé accrédité ANAQ-SUP</option>
                </select>
              </div>
            </div>
          </div>

          {/* Bouton de sauvegarde et messages */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
            <Link
              href="/chat"
              className="flex items-center gap-2 text-[13.5px] text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Retourner au chat d&apos;orientation</span>
            </Link>

            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 h-11 flex items-center justify-center gap-2 bg-[#155E59] hover:brightness-105 active:scale-[0.99] dark:bg-[#E9D5A1] dark:text-[#0D2928] text-white font-bold text-[14px] rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Enregistrer mon profil</span>
            </button>
          </div>

          {saveSuccess && (
            <div className="p-3.5 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-emerald-700 dark:text-emerald-300 text-[13px] flex items-center gap-2 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Profil enregistré avec succès ! Il sera pris en compte lors de vos prochains échanges.</span>
            </div>
          )}

          {error && (
            <div className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-xl text-red-600 dark:text-red-400 text-[13px] flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>
      </div>
    </main>
  );
}
