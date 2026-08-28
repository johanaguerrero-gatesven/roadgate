/**
 * =============================================================================
 * Adaptador de email para invitaciones de equipo (Fase II)
 * =============================================================================
 * Envía el enlace de invitación por email usando Resend si el proyecto tiene
 * configurada la clave `RESEND_API_KEY`. Si no la hay, no se rompe el flujo:
 * la API devuelve el enlace para que el Admin lo comparta manualmente.
 *
 * El token en claro sólo viaja en el email/enlace; en BD sólo vive su SHA-256.
 */

export type InvitationEmailResult = { sent: boolean; reason?: string };

/** Construye el enlace de aceptación a partir del origen de la petición. */
export function buildInvitationUrl(request: Request, token: string): string {
  const origin = new URL(request.url).origin;
  return `${origin}/accept-invite?token=${encodeURIComponent(token)}`;
}

/** Envía el email de invitación (best-effort). Nunca lanza. */
export async function sendInvitationEmail(params: {
  to: string;
  inviteUrl: string;
  teamName: string;
  invitedByEmail?: string | null;
}): Promise<InvitationEmailResult> {
  const apiKey = process.env["RESEND_API_KEY"];
  if (!apiKey) return { sent: false, reason: "email_not_configured" };

  const from = process.env["INVITATION_EMAIL_FROM"] ?? "RoadGate <onboarding@resend.dev>";
  const inviter = params.invitedByEmail ? ` by ${params.invitedByEmail}` : "";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: `You have been invited to ${params.teamName} on RoadGate`,
        html: `
          <p>You have been invited${inviter} to join the team <strong>${params.teamName}</strong> on RoadGate.</p>
          <p><a href="${params.inviteUrl}">Accept the invitation</a></p>
          <p>This link expires in 7 days. If you did not expect this email, you can ignore it.</p>
        `,
      }),
    });
    if (!response.ok) {
      console.error("[invitations] email provider returned", response.status);
      return { sent: false, reason: "email_provider_error" };
    }
    return { sent: true };
  } catch (error) {
    console.error("[invitations] email send failed:", error);
    return { sent: false, reason: "email_provider_error" };
  }
}
