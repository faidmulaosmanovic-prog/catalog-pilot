export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16 text-sm leading-6">
      <h1 className="text-2xl font-semibold">Privacy Policy</h1>
      <p>Last updated 31 October 2026.</p>
      <p>
        CatalogPilot stores the account, organization, and catalog data you submit so you can
        import, validate, edit, and export product files. The operator of this installation is
        responsible for that database.
      </p>
      <h2 className="text-lg font-semibold">Data we store</h2>
      <ul className="list-disc pl-5">
        <li>Account name, email address, and a password hash.</li>
        <li>Organization membership and the role you assign.</li>
        <li>Product fields, import files, validation results, bulk edits, and export files.</li>
        <li>Billing status. Card numbers stay with Stripe when Checkout is enabled.</li>
      </ul>
      <h2 className="text-lg font-semibold">Cookies</h2>
      <p>
        A session cookie keeps you signed in. An organization cookie remembers the active
        workspace. CatalogPilot does not set advertising cookies.
      </p>
      <h2 className="text-lg font-semibold">Processors</h2>
      <p>
        PostgreSQL holds the catalog. Stripe processes payments when a secret key is configured.
        Cloudflare may host the app. Error reports go to Sentry only when SENTRY_DSN is set.
        OpenAI and product analytics are not used in this version.
      </p>
      <h2 className="text-lg font-semibold">Retention and deletion</h2>
      <p>
        Deleted products are soft-deleted. Ask the operator to remove an organization. Export
        files and import files follow the operator’s backup retention.
      </p>
    </main>
  );
}
