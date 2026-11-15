// Small helpers to keep route handlers thin and consistent.
import { NextResponse } from "next/server";
import { ZodError, type ZodTypeAny, type z } from "zod";

import { HttpError } from "./errors";
export { HttpError };

export function ok<T>(data: T, init?: number) {
  return NextResponse.json(data, { status: init ?? 200 });
}

export async function body<S extends ZodTypeAny>(req: Request, schema: S): Promise<z.infer<S>> {
  let json: unknown = {};
  try {
    const text = await req.text();
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, "Invalid JSON body");
  }
  return schema.parse(json);
}

export function handle<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (e) {
      if (e instanceof ZodError) return NextResponse.json({ error: "Validation failed", issues: e.issues }, { status: 400 });
      if (e instanceof HttpError) return NextResponse.json({ error: e.message }, { status: e.status });
      const msg = e instanceof Error ? e.message : String(e);
      if (/No .* found|NotFound|findUniqueOrThrow/i.test(msg) || (e as { code?: string })?.code === "P2025")
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      console.error("[api]", e);
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  };
}
