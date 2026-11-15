import { HttpError, body, handle, ok } from "@/lib/api";
import { checkIn } from "@/lib/services/events";
import { requireStudent } from "@/lib/session";
import { CheckInSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const studentId = requireStudent();
  const { eventId } = await body(req, CheckInSchema);
  const res = await checkIn(studentId, eventId);
  if (!res.ok) throw new HttpError(409, res.reason);
  return ok(res);
});
