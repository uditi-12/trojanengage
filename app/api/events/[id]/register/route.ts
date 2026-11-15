import { body, handle, ok } from "@/lib/api";
import { registerForEvent } from "@/lib/services/registrations";
import { requireStudent } from "@/lib/session";
import { RegisterSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  const studentId = requireStudent();
  const { force } = await body(req, RegisterSchema);
  const res = await registerForEvent(studentId, params.id, force);
  return ok(res, res.ok ? 200 : 409);
});
