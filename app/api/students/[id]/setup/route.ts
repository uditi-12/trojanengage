import { prisma } from "@/lib/db";
import { body, handle, ok } from "@/lib/api";
import { parseStrings, parseWeights, toJSON } from "@/lib/json";
import { computeProfileEmbedding, GOAL_TAGS, initialTagWeights } from "@/lib/services/preferences";
import { round } from "@/lib/utils";
import { SetupSchema } from "@/lib/validators";
import { requireStudent } from "@/lib/session";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request, { params }: { params: { id: string } }) => {
  requireStudent(params.id);
  const input = await body(req, SetupSchema);
  const student = await prisma.student.findUniqueOrThrow({ where: { id: params.id } });
  let weights: Record<string, number>;
  if (student.onboarded) {
    // Editing from the profile page: keep learned weights, boost only newly added interests/goals.
    weights = parseWeights(student.tagWeights);
    const prevI = new Set(parseStrings(student.interests));
    const prevG = new Set(parseStrings(student.goals));
    for (const t of input.interests) if (!prevI.has(t)) weights[t] = round((weights[t] ?? 0) + 1);
    for (const g of input.goals) if (!prevG.has(g)) for (const t of GOAL_TAGS[g] ?? []) weights[t] = round((weights[t] ?? 0) + 0.5);
  } else {
    weights = initialTagWeights(input.interests, input.goals);
  }
  const patch = { interests: toJSON(input.interests), goals: toJSON(input.goals), tagWeights: toJSON(weights) };
  const vec = await computeProfileEmbedding(patch);
  const updated = await prisma.student.update({
    where: { id: params.id },
    data: { ...patch, profileEmbedding: toJSON(vec.map((x) => round(x, 5))), onboarded: true, profileSentence: student.onboarded ? student.profileSentence : null },
  });
  return ok({ ok: true, studentId: updated.id });
});
