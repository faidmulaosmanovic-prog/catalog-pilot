export default function TermsPage() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-6 py-16 text-sm leading-6">
      <h1 className="text-2xl font-semibold">Terms of use</h1>
      <p>Last updated 31 October 2026.</p>
      <p>
        CatalogPilot is a tool for preparing product catalog files. Shopify and Amazon exports
        are CSV templates. They do not connect to those marketplaces.
      </p>
      <h2 className="text-lg font-semibold">Accounts</h2>
      <p>
        You need a verified email. Organization owners control billing and membership. Editors
        can change the catalog. Viewers can read it. You are responsible for the product data
        you upload.
      </p>
      <h2 className="text-lg font-semibold">Plans</h2>
      <p>
        New organizations start a 14-day Starter trial. Product, member, and monthly job limits
        come from the active plan. Checkout and the billing portal use Stripe when the operator
        has configured a price.
      </p>
      <h2 className="text-lg font-semibold">Acceptable use</h2>
      <p>
        Do not attempt to access another organization’s data, bypass rate limits, or upload files
        that are not product catalogs. The service may reject oversized CSV uploads.
      </p>
      <h2 className="text-lg font-semibold">Availability</h2>
      <p>
        This pilot does not promise uninterrupted service. Catalog files you export should be
        reviewed before you upload them to a marketplace.
      </p>
    </main>
  );
}
