import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
        CatalogPilot
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        Product data operations platform
      </h1>
      <p className="max-w-xl text-base leading-7 text-zinc-600 dark:text-zinc-300">
        Import a catalog, fix data quality issues, and export Shopify or Amazon CSV files.
      </p>
      <div className="flex gap-4 text-sm">
        <Link className="underline" href="/register">
          Create account
        </Link>
        <Link className="underline" href="/login">
          Sign in
        </Link>
      </div>
    </main>
  );
}
