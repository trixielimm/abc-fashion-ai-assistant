import { extractPreferences } from "@/lib/ai/extractPreferences";
import { z } from "zod";

const RequestSchema = z.object({ message: z.string().trim().min(1) });

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  const result = RequestSchema.safeParse(body);
  if (!result.success) {
    return Response.json(
      { error: "message must be a non-empty string." },
      { status: 400 },
    );
  }

  try {
    const preferences = await extractPreferences(result.data.message);
    return Response.json({ preferences });
  } catch {
    // Never return provider errors: they may contain sensitive request details.
    return Response.json(
      { error: "Unable to extract shopping preferences. Please try again." },
      { status: 500 },
    );
  }
}
