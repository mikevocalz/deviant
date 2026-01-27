/**
 * Age Validation API Endpoint
 *
 * CRITICAL: This endpoint enforces strict 18+ age verification.
 * NO EXCEPTIONS - users under 18 are permanently blocked.
 *
 * This endpoint should be called before any user registration
 * to validate the date of birth server-side.
 */

// Minimum age required
const MINIMUM_AGE = 18;

// Error messages
const UNDERAGE_ERROR = "You must be 18 or older to access this platform.";
const INVALID_DOB_ERROR = "Invalid date of birth format.";
const MISSING_DOB_ERROR = "Date of birth is required.";

/**
 * Calculate age from date of birth
 */
function calculateAge(dob: Date): number {
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }

  return age;
}

/**
 * Parse date string to Date object
 * Supports YYYY-MM-DD and MM/DD/YYYY formats
 */
function parseDate(dateStr: string): Date | null {
  const cleanDate = dateStr.trim();

  // Try YYYY-MM-DD format
  if (/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) {
    const [year, month, day] = cleanDate.split("-").map(Number);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try MM/DD/YYYY format
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(cleanDate)) {
    const [month, day, year] = cleanDate.split("/").map(Number);
    const date = new Date(year, month - 1, day);
    if (!isNaN(date.getTime())) return date;
  }

  // Try generic parsing
  const date = new Date(cleanDate);
  if (!isNaN(date.getTime())) return date;

  return null;
}

/**
 * POST /api/auth/validate-age
 *
 * Validates a date of birth for age requirement.
 * Returns 200 if valid (18+), 403 if underage, 400 if invalid.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { dateOfBirth } = body;

    // Check if DOB is provided
    if (!dateOfBirth) {
      console.log("[validate-age] Missing DOB");
      return Response.json(
        {
          valid: false,
          error: MISSING_DOB_ERROR,
          code: "MISSING_DOB",
        },
        { status: 400 },
      );
    }

    // Parse the date
    const dob = parseDate(dateOfBirth);
    if (!dob) {
      console.log("[validate-age] Invalid DOB format:", dateOfBirth);
      return Response.json(
        {
          valid: false,
          error: INVALID_DOB_ERROR,
          code: "INVALID_DOB",
        },
        { status: 400 },
      );
    }

    // Calculate age
    const age = calculateAge(dob);
    console.log("[validate-age] Calculated age:", age);

    // CRITICAL: Check if user is 18 or older
    if (age < MINIMUM_AGE) {
      console.log("[validate-age] BLOCKED: Underage user (age:", age, ")");
      return Response.json(
        {
          valid: false,
          isOver18: false,
          age,
          error: UNDERAGE_ERROR,
          code: "UNDERAGE",
        },
        { status: 403 },
      );
    }

    // Validate age is reasonable (not in future, not too old)
    if (age < 0) {
      return Response.json(
        {
          valid: false,
          error: "Date of birth cannot be in the future.",
          code: "FUTURE_DOB",
        },
        { status: 400 },
      );
    }

    if (age > 120) {
      return Response.json(
        {
          valid: false,
          error: "Please enter a valid date of birth.",
          code: "INVALID_AGE",
        },
        { status: 400 },
      );
    }

    // Age is valid - user is 18+
    console.log("[validate-age] ALLOWED: User is", age, "years old");
    return Response.json(
      {
        valid: true,
        isOver18: true,
        age,
        message: "Age verification successful.",
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[validate-age] Error:", error);
    return Response.json(
      {
        valid: false,
        error: "Failed to validate age.",
        code: "SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/auth/validate-age
 *
 * Returns info about the age validation endpoint.
 */
export async function GET() {
  return Response.json({
    endpoint: "/api/auth/validate-age",
    method: "POST",
    description: "Validates date of birth for 18+ age requirement",
    minimumAge: MINIMUM_AGE,
    earliestAllowedBirthYear: new Date().getFullYear() - MINIMUM_AGE,
    requiredFields: {
      dateOfBirth: "string (YYYY-MM-DD or MM/DD/YYYY format)",
    },
    responses: {
      200: "Age valid - user is 18+",
      400: "Invalid request (missing or invalid DOB)",
      403: "Forbidden - user is under 18",
    },
  });
}
