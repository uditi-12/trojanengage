import { prisma } from "../db";
import { truncate } from "../utils";

export type LogEntry = {
  feature: string;
  provider: string;
  model: string;
  inputSummary: string;
  outputSummary: string;
  latencyMs: number;
  usedFallback: boolean;
};

let loggingDisabled = false;
/** The seed script disables logging so the "AI under the hood" panel starts clean. */
export function disableAiLogging() {
  loggingDisabled = true;
}
export function enableAiLogging() {
  loggingDisabled = false;
}

export async function logAi(entry: LogEntry) {
  if (loggingDisabled) return;
  try {
    await prisma.aiLog.create({
      data: {
        ...entry,
        inputSummary: truncate(entry.inputSummary, 300),
        outputSummary: truncate(entry.outputSummary, 400),
        latencyMs: Math.round(entry.latencyMs),
      },
    });
  } catch (e) {
    console.warn("[ai] failed to write AiLog", e);
  }
}
