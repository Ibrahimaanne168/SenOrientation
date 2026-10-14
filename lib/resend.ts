import { Resend } from "resend";

/**
 * Service d'envoi d'emails transactionnels Jangora via Resend.
 * Sécurisé : la clé API Resend n'est JAMAIS exposée au frontend.
 * En mode local / développement sans clé, un repli propre simule l'envoi dans la console.
 */

function getResendClient(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || apiKey === "placeholder-resend-key") {
    return null;
  }
  return new Resend(apiKey);
}

/**
 * Envoie le code de vérification à 6 chiffres pour l'inscription (Étape 2)
 */
export async function sendVerificationCodeEmail(
  email: string,
  code: string,
  fullName?: string
): Promise<{ success: boolean; error?: string }> {
  const recipientName = fullName ? fullName.trim() : "Futur(e) bachelier(e)";
  const resend = getResendClient();

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Code de vérification Jangora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F5EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #112624;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F7F5EF; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5DCC5; overflow: hidden; box-shadow: 0 4px 12px rgba(17,38,36,0.05);">
          <!-- En-tête vert Baobab Jangora -->
          <tr>
            <td style="background-color: #155E59; padding: 30px 24px; text-align: center;">
              <h1 style="margin: 0; font-family: Georgia, serif; font-size: 26px; font-weight: bold; letter-spacing: 3px; color: #FFFFFF;">
                JAN<span style="color: #E9D5A1;">GORA</span>
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #E9D5A1; letter-spacing: 0.5px;">L'orientation vers le savoir</p>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 16px; font-size: 18px; color: #155E59;">Bonjour ${recipientName},</h2>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #3D5752;">
                Bienvenue sur <strong>Jangora</strong>, ta plateforme d'orientation officielle pour le supérieur au Sénégal. Pour valider ton adresse e-mail et poursuivre la création de ton compte, voici ton code de confirmation :
              </p>

              <!-- Bloc Code OTP -->
              <div style="background-color: #F4EEDC; border: 1.5px dashed #A8812F; border-radius: 12px; padding: 18px; text-align: center; margin: 24px 0;">
                <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #155E59; font-family: monospace;">
                  ${code}
                </span>
                <p style="margin: 8px 0 0; font-size: 12px; color: #7B6836;">Ce code expire dans 10 minutes (usage unique).</p>
              </div>

              <p style="margin: 0 0 12px; font-size: 13px; line-height: 1.5; color: #556E68;">
                Si tu n'as pas initié cette inscription, tu peux ignorer cet e-mail en toute sécurité. Ton compte ne sera pas créé.
              </p>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color: #FAF8F3; padding: 18px 24px; text-align: center; border-top: 1px solid #E5DCC5; font-size: 11.5px; color: #8C9E9A;">
              Jangora · Orientation & Informations Supérieures · Sénégal<br>
              Référentiel officiel des universités, bourses DGES et plateformes Campusen
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  if (!resend) {
    // Mode local / Fallback sécurisé : journalisation sans fuite de mot de passe
    // eslint-disable-next-line no-console
    console.log(`[Resend DEV/LOCAL] Code de vérification envoyé à ${email} : ${code}`);
    return { success: true };
  }

  try {
    const fromAddress = process.env.RESEND_FROM_EMAIL || "Jangora <onboarding@resend.dev>";
    const result = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: `Ton code de vérification Jangora : ${code}`,
      html,
    });

    if (result.error) {
      // eslint-disable-next-line no-console
      console.error("[Resend Error]", result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Resend Exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email",
    };
  }
}

/**
 * Envoie le lien de réinitialisation de mot de passe à usage unique
 */
export async function sendPasswordResetEmail(
  email: string,
  resetUrl: string,
  fullName?: string
): Promise<{ success: boolean; error?: string }> {
  const recipientName = fullName ? fullName.trim() : "Élève / Étudiant";
  const resend = getResendClient();

  const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>Réinitialisation de ton mot de passe Jangora</title>
</head>
<body style="margin: 0; padding: 0; background-color: #F7F5EF; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #112624;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #F7F5EF; padding: 40px 15px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #FFFFFF; border-radius: 16px; border: 1px solid #E5DCC5; overflow: hidden; box-shadow: 0 4px 12px rgba(17,38,36,0.05);">
          <!-- En-tête vert Baobab Jangora -->
          <tr>
            <td style="background-color: #155E59; padding: 30px 24px; text-align: center;">
              <h1 style="margin: 0; font-family: Georgia, serif; font-size: 26px; font-weight: bold; letter-spacing: 3px; color: #FFFFFF;">
                JAN<span style="color: #E9D5A1;">GORA</span>
              </h1>
              <p style="margin: 6px 0 0; font-size: 13px; color: #E9D5A1;">Récupération de compte sécurisée</p>
            </td>
          </tr>

          <!-- Contenu principal -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 16px; font-size: 18px; color: #155E59;">Bonjour ${recipientName},</h2>
              <p style="margin: 0 0 20px; font-size: 14px; line-height: 1.6; color: #3D5752;">
                Nous avons reçu une demande de réinitialisation pour ton compte Jangora. Clique sur le bouton ci-dessous pour choisir un nouveau mot de passe sécurisé :
              </p>

              <!-- Bouton d'action -->
              <div style="text-align: center; margin: 30px 0;">
                <a href="${resetUrl}" target="_blank" style="display: inline-block; background-color: #155E59; color: #FFFFFF; text-decoration: none; font-weight: bold; font-size: 14px; padding: 14px 28px; border-radius: 12px; box-shadow: 0 2px 6px rgba(21,94,89,0.25);">
                  Réinitialiser mon mot de passe
                </a>
              </div>

              <p style="margin: 0 0 10px; font-size: 12px; color: #7B6836; text-align: center;">
                Ce lien est à usage unique et reste valide pendant 30 minutes.
              </p>

              <p style="margin: 20px 0 0; font-size: 12px; line-height: 1.5; color: #8C9E9A; border-top: 1px solid #ECE6D5; padding-top: 14px;">
                Si tu n'as pas demandé cette réinitialisation, ne t'inquiète pas : ton mot de passe actuel reste inchangé et ton compte reste protégé.
              </p>
            </td>
          </tr>

          <!-- Pied de page -->
          <tr>
            <td style="background-color: #FAF8F3; padding: 18px 24px; text-align: center; border-top: 1px solid #E5DCC5; font-size: 11.5px; color: #8C9E9A;">
              Jangora · Orientation & Informations Supérieures · Sénégal
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

  if (!resend) {
    // Mode local / Fallback sécurisé : journalisation
    // eslint-disable-next-line no-console
    console.log(`[Resend DEV/LOCAL] Lien de réinitialisation pour ${email} : ${resetUrl}`);
    return { success: true };
  }

  try {
    const fromAddress = process.env.RESEND_FROM_EMAIL || "Jangora <onboarding@resend.dev>";
    const result = await resend.emails.send({
      from: fromAddress,
      to: [email],
      subject: "Réinitialisation de ton mot de passe Jangora",
      html,
    });

    if (result.error) {
      // eslint-disable-next-line no-console
      console.error("[Resend Error]", result.error);
      return { success: false, error: result.error.message };
    }

    return { success: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[Resend Exception]", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Erreur lors de l'envoi de l'email",
    };
  }
}
