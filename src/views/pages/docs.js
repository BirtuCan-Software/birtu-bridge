// src/views/pages/docs.js
const { escapeHtml } = require('../../utils/html');

function codeBlock(value, language = '') {
  return `<pre class="overflow-x-auto rounded-md bg-slate-950 p-4 text-xs leading-6 text-slate-100"><code>${escapeHtml(
    value
  )}</code></pre>`;
}

function renderDocsBody() {
  return `
    <div class="mb-8">
      <p class="text-xs font-semibold uppercase tracking-wide text-slate-500">Operator documentation</p>
      <h1 class="mt-2 text-2xl font-semibold text-slate-950">Integrating Chapa through Birtu Bridge</h1>
      <p class="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
        This page explains how an operator admin connects a client application to Chapa using Birtu Bridge.
        The bridge becomes the stable payment layer between your app and Chapa: your app talks to the bridge,
        the bridge talks to Chapa, and the bridge delivers payment updates back to your app.
      </p>
    </div>

    <div class="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
      <aside class="lg:sticky lg:top-6 lg:self-start">
        <div class="rounded-lg border border-slate-200 bg-white p-4">
          <h2 class="mb-3 text-sm font-medium text-slate-800">On this page</h2>
          <nav class="space-y-2 text-sm">
            <a class="block text-slate-600 hover:text-slate-950" href="#mental-model">Mental model</a>
            <a class="block text-slate-600 hover:text-slate-950" href="#operator-setup">Operator setup</a>
            <a class="block text-slate-600 hover:text-slate-950" href="#app-integration">App integration</a>
            <a class="block text-slate-600 hover:text-slate-950" href="#example">Full example</a>
            <a class="block text-slate-600 hover:text-slate-950" href="#webhooks">Payment updates</a>
            <a class="block text-slate-600 hover:text-slate-950" href="#testing">Testing checklist</a>
            <a class="block text-slate-600 hover:text-slate-950" href="#operations">Operations</a>
          </nav>
        </div>
      </aside>

      <article class="space-y-6">
        <section id="mental-model" class="rounded-lg border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-950">Mental model</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            A normal Chapa integration usually has one application calling Chapa directly. With Birtu Bridge,
            each client app gets its own application record and API key inside the bridge. The client app never
            needs the Chapa secret key. It only needs its bridge API key.
          </p>
          <ol class="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>Your app asks Birtu Bridge to initialize a payment.</li>
            <li>Birtu Bridge creates a tracked transaction and calls Chapa.</li>
            <li>Birtu Bridge returns Chapa's checkout URL to your app.</li>
            <li>Your app redirects the customer to that checkout URL.</li>
            <li>Chapa sends the payment result to Birtu Bridge.</li>
            <li>Birtu Bridge verifies the result, updates the transaction, and delivers a webhook to your app.</li>
          </ol>
          <div class="mt-4 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            The important rule: use Chapa credentials only in Birtu Bridge. Use bridge-issued API keys in your
            client apps.
          </div>
        </section>

        <section id="operator-setup" class="rounded-lg border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-950">Operator setup in the admin UI</h2>
          <div class="mt-4 space-y-5 text-sm leading-6 text-slate-600">
            <div>
              <h3 class="font-medium text-slate-900">1. Create an application</h3>
              <p>
                Open <a href="/ui/applications" class="text-slate-900 underline">Applications</a>, enter the app name,
                choose <span class="font-medium">sandbox</span> while testing or <span class="font-medium">production</span>
                when going live, then create it. Use one bridge application per real client app, store, website, or mobile backend.
              </p>
            </div>
            <div>
              <h3 class="font-medium text-slate-900">2. Issue an API key</h3>
              <p>
                Open the application detail page and click <span class="font-medium">New key</span>. Copy the full key immediately.
                The bridge only shows the full key once. Give this key to the app backend that will initialize payments.
              </p>
            </div>
            <div>
              <h3 class="font-medium text-slate-900">3. Add redirect whitelist entries</h3>
              <p>
                Add the hostnames your app may use as payment return URLs, for example <code class="rounded bg-slate-100 px-1">example.com</code>.
                If your app uses separate subdomains such as <code class="rounded bg-slate-100 px-1">shop.example.com</code>, add them exactly
                or enable subdomains for the parent hostname. The bridge rejects initialization requests with unapproved return URLs.
              </p>
            </div>
            <div>
              <h3 class="font-medium text-slate-900">4. Set the webhook delivery URL</h3>
              <p>
                Enter the endpoint on your app that should receive payment updates, such as
                <code class="rounded bg-slate-100 px-1">https://example.com/webhooks/birtu-bridge</code>.
                This is different from the Chapa webhook URL. Chapa calls the bridge; the bridge calls your app.
              </p>
            </div>
          </div>
        </section>

        <section id="app-integration" class="rounded-lg border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-950">What the client app must send</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            To start a payment, the app backend sends a POST request to the bridge with its API key in the
            <code class="rounded bg-slate-100 px-1">Authorization</code> header.
          </p>
          <div class="mt-4">
            ${codeBlock(`POST https://bridge.example.com/v1/transactions/initialize
Authorization: Bearer bb_live_or_test_key_here
Content-Type: application/json

{
  "clientOrderId": "ORDER-10045",
  "amount": 1250,
  "currency": "ETB",
  "customerEmail": "customer@example.com",
  "firstName": "Abebe",
  "lastName": "Kebede",
  "returnUrl": "https://example.com/payment/return?order=ORDER-10045"
}`)}
          </div>
          <table class="mt-5 w-full border-collapse text-left text-sm">
            <thead>
              <tr class="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th class="py-2 pr-3">Field</th>
                <th class="py-2 pr-3">Required</th>
                <th class="py-2">Meaning</th>
              </tr>
            </thead>
            <tbody class="text-slate-600">
              <tr class="border-b border-slate-100"><td class="py-2 pr-3 font-mono text-xs">clientOrderId</td><td class="py-2 pr-3">Yes</td><td class="py-2">Your app's stable order ID. Reusing it makes initialization idempotent.</td></tr>
              <tr class="border-b border-slate-100"><td class="py-2 pr-3 font-mono text-xs">amount</td><td class="py-2 pr-3">Yes</td><td class="py-2">Positive payment amount.</td></tr>
              <tr class="border-b border-slate-100"><td class="py-2 pr-3 font-mono text-xs">currency</td><td class="py-2 pr-3">No</td><td class="py-2">Defaults to ETB when omitted.</td></tr>
              <tr class="border-b border-slate-100"><td class="py-2 pr-3 font-mono text-xs">customerEmail</td><td class="py-2 pr-3">Yes</td><td class="py-2">Customer email sent to Chapa.</td></tr>
              <tr class="border-b border-slate-100"><td class="py-2 pr-3 font-mono text-xs">firstName</td><td class="py-2 pr-3">No</td><td class="py-2">Customer first name, passed through to Chapa when provided.</td></tr>
              <tr class="border-b border-slate-100"><td class="py-2 pr-3 font-mono text-xs">lastName</td><td class="py-2 pr-3">No</td><td class="py-2">Customer last name, passed through to Chapa when provided.</td></tr>
              <tr><td class="py-2 pr-3 font-mono text-xs">returnUrl</td><td class="py-2 pr-3">Yes</td><td class="py-2">Where Chapa returns the customer after checkout. Its hostname must be whitelisted.</td></tr>
            </tbody>
          </table>
        </section>

        <section id="example" class="rounded-lg border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-950">Full backend example</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            This Express-style example shows the usual pattern: create an order in your own app, call the bridge,
            save the bridge transaction reference, then redirect the customer to checkout.
          </p>
          <div class="mt-4">
            ${codeBlock(`app.post("/checkout", async (req, res) => {
  const order = await orders.create({
    customerId: req.user.id,
    amount: 1250,
    status: "payment_pending"
  });

  const bridgeResponse = await fetch("https://bridge.example.com/v1/transactions/initialize", {
    method: "POST",
    headers: {
      "Authorization": "Bearer bb_test_your_app_key",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      clientOrderId: String(order.id),
      amount: order.amount,
      currency: "ETB",
      customerEmail: req.user.email,
      firstName: req.user.firstName,
      lastName: req.user.lastName,
      returnUrl: "https://example.com/payment/return?order=" + order.id
    })
  });

  const payment = await bridgeResponse.json();

  if (!bridgeResponse.ok) {
    await orders.markPaymentStartFailed(order.id, payment.error);
    return res.status(502).send("Payment could not be started. Please try again.");
  }

  await orders.savePaymentAttempt(order.id, {
    chapaTxRef: payment.chapaTxRef,
    attemptCount: payment.attemptCount,
    checkoutUrl: payment.checkoutUrl
  });

  res.redirect(payment.checkoutUrl);
});`, 'js')}
          </div>
          <h3 class="mt-5 font-medium text-slate-900">Successful bridge response</h3>
          <div class="mt-3">
            ${codeBlock(`{
  "status": "INITIALIZED",
  "checkoutUrl": "https://checkout.chapa.co/checkout/payment/...",
  "chapaTxRef": "generated-reference-from-bridge",
  "attemptCount": 1
}`)}
          </div>
        </section>

        <section id="webhooks" class="rounded-lg border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-950">Receiving payment updates</h2>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            Configure Chapa to send gateway webhooks to the bridge endpoint:
            <code class="rounded bg-slate-100 px-1">https://bridge.example.com/v1/webhooks/chapa</code>.
            Do not point Chapa directly at every client app. The bridge verifies the Chapa webhook, updates its transaction,
            and queues delivery to the application webhook URL you saved in the admin UI.
          </p>
          <p class="mt-3 text-sm leading-6 text-slate-600">
            Your app's webhook handler should be idempotent. Treat the order ID or transaction reference as unique,
            update the order only if it is still unpaid, and return a 2xx response after processing. If your endpoint
            fails, the bridge retries delivery and eventually shows the failure under Delivery Failures.
          </p>
          <div class="mt-4">
            ${codeBlock(`app.post("/webhooks/birtu-bridge", express.json(), async (req, res) => {
  const event = req.body;

  if (event.status === "PAID") {
    await orders.markPaid(event.clientOrderId || event.client_order_id);
  }

  if (event.status === "FAILED" || event.status === "ABORTED") {
    await orders.markPaymentFailed(event.clientOrderId || event.client_order_id);
  }

  res.sendStatus(204);
});`, 'js')}
          </div>
        </section>

        <section id="testing" class="rounded-lg border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-950">Testing checklist</h2>
          <ul class="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            <li>Use a sandbox application and a Chapa test secret key until the full payment flow works.</li>
            <li>Create one bridge API key and store it as a server-side environment variable in the client app.</li>
            <li>Add the exact return URL hostname before sending the first initialize request.</li>
            <li>Confirm the initialize response returns <code class="rounded bg-slate-100 px-1">INITIALIZED</code> and a checkout URL.</li>
            <li>Complete a Chapa test payment and confirm the transaction changes in the Transactions page.</li>
            <li>Confirm your app receives the bridge webhook and marks the order paid only once.</li>
            <li>Check Delivery Failures after testing; it should be empty for a healthy integration.</li>
          </ul>
        </section>

        <section id="operations" class="rounded-lg border border-slate-200 bg-white p-6">
          <h2 class="text-lg font-semibold text-slate-950">Operator responsibilities</h2>
          <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div class="rounded-md bg-slate-50 p-4">
              <h3 class="font-medium text-slate-900">Keep keys scoped</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">Give each app its own API key. Revoke a key immediately if it leaks or a client app is retired.</p>
            </div>
            <div class="rounded-md bg-slate-50 p-4">
              <h3 class="font-medium text-slate-900">Watch transactions</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">Use the Transactions page to inspect stuck, failed, or disputed payment attempts with their checkout URL and gateway details.</p>
            </div>
            <div class="rounded-md bg-slate-50 p-4">
              <h3 class="font-medium text-slate-900">Retry deliveries</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">Use Delivery Failures when an app webhook endpoint was down. Fix the client app first, then retry the failed delivery.</p>
            </div>
            <div class="rounded-md bg-slate-50 p-4">
              <h3 class="font-medium text-slate-900">Run background jobs</h3>
              <p class="mt-2 text-sm leading-6 text-slate-600">The reconciler and delivery worker must run from cron so missed webhooks and failed deliveries heal automatically.</p>
            </div>
          </div>
        </section>
      </article>
    </div>
  `;
}

module.exports = { renderDocsBody };
