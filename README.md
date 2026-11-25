# Pocket Ledger

A money tracker meant to work for almost anyone, anywhere:

- **Works offline.** It installs from the browser as an app (PWA) and runs on cheap Android phones, iPhones and laptops.
- **Any currency** (every ISO currency the browser knows, with a best guess from the phone's region) and **8 languages**: English, Español, Français, Português, العربية (right-to-left), हिन्दी, Kiswahili and 中文.
- **Private.** No account, no server, no ads and no tracking. Data stays in the browser on the phone.
- **Tiny.** No build step and no dependencies, about 60 KB in total, so it loads on slow 2G/3G connections.

## Free vs Pro ($10, one time)

| Free | Pro |
|---|---|
| Unlimited income and expense entries | Monthly budgets per category |
| Month-by-month balance | Unlimited savings goals (Free has 1) |
| 1 savings goal | Spending breakdown by category |
| Backup and restore (kept free so nobody loses their data) | Export to spreadsheet (CSV) |

## Run it locally

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Demo unlock key: `DEMO-PRO-2026` (set in `config.js`).

## Launch checklist

1. **Payments.** Create a $10 product on Gumroad with license keys turned on. Put the product link in `config.js → checkoutUrl` and the product ID in `gumroadProductId`. Then set `demoKey` to `""`.
2. **Hosting.** Any static host works for free: GitHub Pages, Netlify, Cloudflare Pages or Vercel. It must be served over HTTPS for the offline install to work.
3. **Translations.** Have a native speaker check each language in `i18n.js`. Those translations are machine-assisted.
4. **App stores (optional).** Wrap the PWA with [PWABuilder](https://www.pwabuilder.com) to publish on Google Play and the Microsoft Store. For the Apple App Store, digital unlocks generally have to go through Apple's in-app purchase, which takes about 15–30% of each sale.
5. **Regional pricing.** $10 is a lot of money in much of the world. Gumroad and Lemon Squeezy support purchasing-power-parity discounts, so turn them on if you want global reach.

## Known limits

- The Pro unlock is stored on the device. Someone technical could unlock it by hand. That's normal for a $10 offline app, and the license check stops casual sharing.
- Data lives in the browser's storage. If the user clears site data it's gone, which is why backup is free and easy to find.
