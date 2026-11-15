import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md p-10 text-center">
      <div className="text-6xl font-black text-cardinal">404</div>
      <p className="mt-2 text-muted-foreground">That page doesn&apos;t exist.</p>
      <Link href="/" className="mt-4 inline-block font-semibold text-cardinal underline">
        Go home
      </Link>
    </main>
  );
}
