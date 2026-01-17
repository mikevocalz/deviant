/**
 * Terms Acceptance API Route
 *
 * Records when a user accepts the DVNT membership agreement during signup.
 * Creates a legal record in Payload CMS for compliance.
 */

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      userId,
      email,
      acceptedAt,
      ipAddress,
      userAgent,
      termsVersion,
      acceptedPolicies,
    } = body;

    const payloadUrl =
      process.env.PAYLOAD_URL || process.env.PAYLOAD_SERVER_URL;
    const payloadApiKey = process.env.PAYLOAD_API_KEY;

    if (!payloadUrl || !payloadApiKey) {
      console.log("[Terms] Payload not configured, skipping record");
      return Response.json({ success: true, recorded: false });
    }

    // Record the terms acceptance in Payload
    const response = await fetch(`${payloadUrl}/api/terms-acceptances`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Api-Key ${payloadApiKey}`,
      },
      body: JSON.stringify({
        user: userId,
        email,
        acceptedAt: acceptedAt || new Date().toISOString(),
        ipAddress: ipAddress || "unknown",
        userAgent: userAgent || "unknown",
        termsVersion: termsVersion || "1.0",
        acceptedPolicies: acceptedPolicies || [
          "terms-of-service",
          "privacy-policy",
          "community-standards",
          "verification-requirements",
        ],
        ageConfirmed: true,
      }),
    });

    // Also update the user's verified status
    if (userId) {
      try {
        await fetch(`${payloadUrl}/api/users/${userId}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Api-Key ${payloadApiKey}`,
          },
          body: JSON.stringify({
            verified: true,
          }),
        });
      } catch (err) {
        console.error("[Terms] Failed to update user verified status:", err);
      }
    }

    if (response.ok) {
      const data = await response.json();
      return Response.json({
        success: true,
        recorded: true,
        verified: true,
        acceptanceId: data.doc?.id,
      });
    } else {
      console.error(
        "[Terms] Failed to record acceptance:",
        await response.text(),
      );
      return Response.json({ success: true, recorded: false });
    }
  } catch (error) {
    console.error("[Terms] Error recording acceptance:", error);
    return Response.json({ success: true, recorded: false });
  }
}
