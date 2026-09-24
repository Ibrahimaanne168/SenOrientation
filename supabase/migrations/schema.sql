-- ============================================================================
-- AGENT IA D'ORIENTATION (SÉNÉGAL) - MIGRATION INITIALE
-- Schéma de base de données complet, Row Level Security (RLS) et pgvector
-- ============================================================================

-- 1. Extension vectorielle pour le RAG
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Table profiles (Données minimales de l'étudiant/élève)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    niveau_etude TEXT, -- Ex: Terminale, Bac, Licence 1, etc.
    serie TEXT,        -- Ex: S1, S2, L1, L2, L', G, T1, T2, STEG
    interets TEXT[],   -- Ex: {'informatique', 'santé', 'agronomie'}
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_profiles_user_id UNIQUE (user_id)
);

-- 3. Table universites (Établissements d'enseignement supérieur sénégalais)
CREATE TABLE IF NOT EXISTS public.universites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    ville TEXT NOT NULL,
    filieres TEXT[] NOT NULL DEFAULT '{}',
    admission TEXT NOT NULL,
    debouches TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Table bourses (Bourses et allocations d'études de l'État du Sénégal et partenaires)
CREATE TABLE IF NOT EXISTS public.bourses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nom TEXT NOT NULL,
    description TEXT NOT NULL,
    conditions TEXT NOT NULL,
    lien TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. Table conversations (Historique de chat de l'utilisateur)
CREATE TABLE IF NOT EXISTS public.conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Nouvelle discussion',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Table messages (Échanges au sein d'une conversation)
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Table knowledge_embeddings (Base de connaissances pour le RAG)
CREATE TABLE IF NOT EXISTS public.knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    embedding VECTOR(1536), -- Dimension standard OpenAI / text-embedding-3-small
    source TEXT NOT NULL,   -- Ex: 'universites', 'bourses', 'campusen', 'metiers'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- ACTIVATION STRICTE DU ROW LEVEL SECURITY (RLS) SUR TOUTES LES TABLES
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bourses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.knowledge_embeddings ENABLE ROW LEVEL SECURITY;

-- Politiques pour profiles (Uniquement son propre profil)
CREATE POLICY "profiles_select_own" ON public.profiles
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "profiles_insert_own" ON public.profiles
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "profiles_update_own" ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Politiques pour conversations (Uniquement ses propres conversations)
CREATE POLICY "conversations_select_own" ON public.conversations
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "conversations_insert_own" ON public.conversations
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_update_own" ON public.conversations
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "conversations_delete_own" ON public.conversations
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- Politiques pour messages (Uniquement les messages de ses propres conversations)
CREATE POLICY "messages_select_own" ON public.messages
    FOR SELECT TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
        )
    );

CREATE POLICY "messages_insert_own" ON public.messages
    FOR INSERT TO authenticated
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND c.user_id = auth.uid()
        )
    );

-- Politiques de consultation publique/authentifiée pour le catalogue de connaissances
-- Les tables universites, bourses et knowledge_embeddings sont lisibles par les utilisateurs authentifiés
CREATE POLICY "universites_read_all" ON public.universites
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "bourses_read_all" ON public.bourses
    FOR SELECT TO authenticated, anon
    USING (true);

CREATE POLICY "knowledge_embeddings_read_all" ON public.knowledge_embeddings
    FOR SELECT TO authenticated, anon
    USING (true);

-- Modifications de connaissances réservées au rôle service_role (Admin / Pipeline d'ingestion)
CREATE POLICY "universites_admin_write" ON public.universites
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "bourses_admin_write" ON public.bourses
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

CREATE POLICY "knowledge_embeddings_admin_write" ON public.knowledge_embeddings
    FOR ALL TO service_role
    USING (true) WITH CHECK (true);

-- ============================================================================
-- FONCTION RPC POUR RECHERCHE VECTORIELLE (RAG)
-- ============================================================================

CREATE OR REPLACE FUNCTION match_knowledge(
    query_embedding VECTOR(1536),
    match_threshold FLOAT DEFAULT 0.5,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source TEXT,
    similarity FLOAT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN QUERY
    SELECT
        ke.id,
        ke.content,
        ke.source,
        1 - (ke.embedding <=> query_embedding) AS similarity
    FROM public.knowledge_embeddings ke
    WHERE ke.embedding IS NOT NULL
      AND 1 - (ke.embedding <=> query_embedding) > match_threshold
    ORDER BY similarity DESC
    LIMIT match_count;
END;
$$;

-- Index vectoriel pour les performances du RAG
CREATE INDEX IF NOT EXISTS idx_knowledge_embeddings_vec
    ON public.knowledge_embeddings
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- ============================================================================
-- DONNÉES DE RÉFÉRENCE INITIALES (SÉNÉGAL)
-- Universités publiques sénégalaises, formations et bourses
-- ============================================================================

INSERT INTO public.universites (nom, ville, filieres, admission, debouches)
VALUES
    (
        'Université Cheikh Anta Diop (UCAD)',
        'Dakar',
        ARRAY['Médecine & Pharmacie (FMPOS)', 'Sciences et Technologies (FST - Informatique, Mathématiques, Physique)', 'Sciences Juridiques et Politiques (FSJP)', 'Lettres et Sciences Humaines (FLSH)', 'École Supérieure Polytechnique (ESP - Génie Informatique, Télécoms, Génie Civil)', 'École des Bibliothécaires, Archivistes et Documentalistes (EBAD)'],
        'Orientation obligatoire via la plateforme nationale Campusen après obtention du Baccalauréat sénégalais. Sélection sur dossier ou concours pour les écoles spécialisées (ESP, FMPOS, EBAD).',
        ARRAY['Médecin', 'Pharmacien', 'Ingénieur logiciel', 'Avocat / Juriste', 'Enseignant-chercheur', 'Gestionnaire de données']
    ),
    (
        'Université Gaston Berger (UGB)',
        'Saint-Louis',
        ARRAY['Sciences Appliquées et Technologies (SAT - Informatique, Mathématiques Appliquées)', 'Sciences Économiques et de Gestion (SEG)', 'Sciences Juridiques et Politiques (SJP)', 'Lettres et Sciences Humaines (LSH)', 'Sciences de la Santé (2S)', 'Institut Polytechnique de Saint-Louis (IPSL - Génie Civil, Électromécanique)'],
        'Plateforme Campusen pour les UFR générales. Concours d''entrée direct pour les filières d''excellence de l''IPSL.',
        ARRAY['Data analyst', 'Ingénieur télécoms & réseaux', 'Économiste', 'Magistrat', 'Médecin généraliste', 'Ingénieur BTP']
    ),
    (
        'Université Iba Der Thiam (UIDT)',
        'Thiès',
        ARRAY['Sciences et Technologies (Informatique industrielle, Mathématiques appliquées)', 'Sciences Économiques et Sociales', 'Santé', 'UFR Ingénierie et Technologies'],
        'Plateforme Campusen basée sur les moyennes du Bac (séries S1, S2, S3, T1 particulièrement valorisées pour l''ingénierie).',
        ARRAY['Développeur système', 'Auditeur financier', 'Gestionnaire de projets d''ingénierie', 'Infirmier d''État']
    ),
    (
        'Université Amadou Mahtar Mbow (UAM)',
        'Diamniadio',
        ARRAY['École Supérieure des Mines et de la Géologie (ESMG)', 'École Supérieure d''Urbanisme et d''Architecture (ESUAA)', 'École Supérieure d''Ingénierie des TIC (ESI-TIC)', 'Haute École des Sciences Économiques et de Gestion (HEG)'],
        'Campusen (Bac scientifique ou technique S1, S2, S3, T1, T2 recommandé) + entretien d''aptitude pour certaines filières technologiques.',
        ARRAY['Ingénieur géologue/minier', 'Architecte urbaniste', 'Architecte Cloud / DevOps', 'Expert en finance verte']
    ),
    (
        'Université du Sine Saloum El-Hâdj Ibrahima NIASS (USSEIN)',
        'Kaolack',
        ARRAY['Agronomie et Productions Végétales', 'Élevage et Productions Animales', 'Sciences Halieutiques et Aquacoles', 'Agroalimentaire et Nutrition', 'Management des Entreprises Agricoles'],
        'Campusen pour les bacheliers des séries scientifiques (S1, S2) et sciences expérimentales/agricoles (S4, S5).',
        ARRAY['Ingénieur agronome', 'Spécialiste agro-business', 'Responsable de production piscicole', 'Directeur de coopérative agricole']
    )
ON CONFLICT DO NOTHING;

INSERT INTO public.bourses (nom, description, conditions, lien)
VALUES
    (
        'Bourses Nationales de l''Enseignement Supérieur (DGE)',
        'Allocation financière mensuelle de l''État du Sénégal attribuée aux étudiants orientés dans les universités publiques pour financer leurs études.',
        'Être de nationalité sénégalaise, titulaire du Baccalauréat, orienté par l''État via Campusen et régulièrement inscrit. Critères : excellence académique (mention au Bac) et critères sociaux.',
        'https://campusen.sec.gouv.sn'
    ),
    (
        'Bourses d''Excellence de la République du Sénégal',
        'Bourse prestigieuse finançant des études supérieures poussées pour les meilleurs lauréats du Concours Général et les bacheliers avec mention Très Bien.',
        'Mention Très Bien au Baccalauréat (séries S1, S2, S3 de préférence) ou lauréat des premiers prix du Concours Général sénégalais.',
        'https://campusen.sec.gouv.sn'
    ),
    (
        'Aide Sociale Universitaire (Dakar & Régions)',
        'Aide ponctuelle attribuée chaque année académique aux étudiants sénégalais issus de milieux défavorisés ne bénéficiant pas d''une bourse entière.',
        'Dossier social examiné par la Commission d''Attribution des Bourses et Aides Sociales de l''université.',
        'https://campusen.sec.gouv.sn'
    )
ON CONFLICT DO NOTHING;

-- Initialisation des connaissances brutes pour le RAG (utilisées pour la recherche textuelle et vectorielle)
INSERT INTO public.knowledge_embeddings (content, source)
VALUES
    (
        'ORIENTATION BAC SÉNÉGAL - FILIÈRES SCIENTIFIQUES (S1, S2) : Les bacheliers S1 et S2 sont prioritaires pour les écoles d''ingénieurs (ESP Dakar, IPSL Saint-Louis, ESI-TIC UAM Diamniadio), les facultés de médecine (FMPOS UCAD, 2S UGB) et les filières Mathématiques-Informatique de l''UCAD (FST), UGB (SAT) et UIDT Thiès. Débouchés clés : Médecine, Ingénierie logicielle, Génie civil, Data science, Télécommunications.',
        'campusen'
    ),
    (
        'ORIENTATION BAC SÉNÉGAL - FILIÈRES LITTÉRAIRES (L1, L2, L'') : Les bacheliers des séries L sont orientés vers les Facultés des Lettres et Sciences Humaines (FLSH UCAD, LSH UGB), les Facultés des Sciences Juridiques et Politiques (FSJP UCAD, SJP UGB), l''EBAD (archivistique, documentation), les filières de communication, journalisme (CESTI Dakar par concours) et sciences sociales. Débouchés : Avocats, Magistrats, Diplomates, Journalistes, Gestionnaires RH, Enseignants.',
        'campusen'
    ),
    (
        'ORIENTATION BAC SÉNÉGAL - SÉRIES TECHNIQUES ET GESTION (G, T1, T2, STEG) : Les bacheliers des séries G et STEG s''orientent principalement vers les sciences de gestion (FASEG UCAD, HEG UAM, UGB SEG, IUT/ESP gestion) pour les métiers de la comptabilité, audit, banque et finance. Les séries T1 et T2 sont orientées vers l''ingénierie mécanique, électrotechnique, génie civil à l''ESP, l''UIDT ou l''IPSL.',
        'campusen'
    ),
    (
        'PROCÉDURE CAMPUSEN SÉNÉGAL : L''orientation dans tous les établissements d''enseignement supérieur public du Sénégal se fait exclusivement via le portail https://campusen.sec.gouv.sn. Les candidats doivent créer un compte avec leur numéro de table au Bac et leur date de naissance, classer leurs choix de filières par ordre de préférence avant la date limite fixée par le Ministère de l''Enseignement Supérieur de la Recherche et de l''Innovation (MESRI).',
        'campusen'
    ),
    (
        'BOURSES D''ÉTUDES SÉNÉGAL : Les bourses d''études supérieures au Sénégal sont gérées par la Direction des Bourses (DGB / MESRI). Il existe le demi-taux (20 000 FCFA/mois) et le plein-taux (40 000 FCFA/mois au niveau licence, revalorisé au Master). L''attribution dépend de la mention au Bac et des critères d''âge et de nationalité sénégalaise.',
        'bourses'
    )
ON CONFLICT DO NOTHING;
