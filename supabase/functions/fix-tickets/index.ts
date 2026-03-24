import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req) => {
  const supabaseClient = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  try {
    const { data, error } = await supabaseClient.rpc("exec_sql", {
      query: `
        UPDATE tickets t
        SET user_id = u.auth_id
        FROM users u
        WHERE t.user_id = u.id::text
          AND u.auth_id IS NOT NULL
          AND u.auth_id != t.user_id
        RETURNING t.id, t.event_id, t.user_id;
      `,
    });

    if (error) throw error;

    return new Response(
      JSON.stringify({
        success: true,
        updated: data?.length || 0,
        tickets: data,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
