import { handle, ok } from "@/lib/api";
import { saveEvent } from "@/lib/services/registrations";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (_req: Request, { params }: { params: { id: string } }) => {
  const studentId = requireStudent();
  return ok({ registration: await saveEvent(studentId, params.id) });
});
