import { handle, ok } from "@/lib/api";
import { feedbackEligibility } from "@/lib/services/events";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const studentId = requireStudent();
  const eventId = new URL(req.url).searchParams.get("eventId") ?? "";
  return ok(await feedbackEligibility(studentId, eventId));
});
