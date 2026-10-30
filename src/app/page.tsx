export default function Home() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-3xl flex-col justify-center gap-4 px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-zinc-500 uppercase">
        CatalogPilot
      </p>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
        Product data operations platform
      </h1>
      <p className="max-w-xl text-base leading-7 text-zinc-600">
        Implementation is underway. Database foundation (DB-0) is in place.
        Domain modules start with identity and tenancy (DB-1).
      </p>
    </main>
  );
}
