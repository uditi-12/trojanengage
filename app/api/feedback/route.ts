import { body, handle, ok } from "@/lib/api";
import { submitFeedback } from "@/lib/services/events";
import { requireStudent } from "@/lib/session";
import { FeedbackSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const studentId = requireStudent();
  const input = await body(req, FeedbackSchema);
  const fb = await submitFeedback(studentId, input);
  return ok({ feedback: fb });
});
