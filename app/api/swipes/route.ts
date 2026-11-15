import { body, handle, ok } from "@/lib/api";
import { recordSwipe } from "@/lib/services/preferences";
import { SwipeSchema } from "@/lib/validators";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const input = await body(req, SwipeSchema);
  requireStudent(input.studentId);
  const res = await recordSwipe(input);
  return ok(res);
});
