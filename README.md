# Synkra Client Hub

You are building the Synkra client portal. This is a separate Lovable project from the landing page. It deploys at flow.synkra.co.za. Every Synkra client logs in here regardless of whether they are a beta user from the Synkra for Her programme or a future paying customer.



This prompt builds the foundation only. No pages with real content yet. The design system, security layer, PocketBase connection, routing skeleton, PWA configuration, and Docker deployment files. WHAT THIS IS



A web application where clients manage their automation workflows. They activate pre-built templates, build custom workflows, monitor their automation activity, and manage their account settings. It must be fast, secure, and work as a Progressive Web App on mobile and desktop. TECH STACK



Frontend: React with TypeScript. Vite as the build tool.



Database and auth: PocketBase. The PocketBase URL and admin credentials will be provided as environment variables. Do not hardcode anything.



Styling: Tailwind CSS with a custom design token configuration.



Icons: Lucide React.



PWA: Vite PWA plugin.



State management: Zustand for global state. React Query for server state.



Routing: React Router v6. ENVIRONMENT VARIABLES



The application reads these from environment variables only. Never hardcode values. Never expose secrets in client-side code that would be visible in the browser.



Create a .env.example file:



VITE_POCKETBASE_URL=https://pb.synkra.co.za

VITE_APP_URL=https://flow.synkra.co.za

VITE_APP_NAME=Synkra



The RESEND API key is a server-side secret and is never exposed to the frontend. Email sending happens through the Python backend API, not directly from the portal frontend.DOCKER AND DEPLOYMENT FILES



Create these files. The application deploys on Coolify via GitHub. Coolify reads the Dockerfile from the repository root.



Dockerfile: FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

RUN npm run build



FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.output ./.output

EXPOSE 3000

ENV PORT=3000

ENV HOST=0.0.0.0

CMD ["node", ".output/server/index.mjs"] .dockerignore:



node_modules

dist

.git

.env

.env.local

*.log



.gitignore — confirm these are excluded:



node_modules

dist

.env

.env.local

.env.production

*.log

.DS_Store



The .env file must never be committed to GitHub. Only .env.example is committed. DESIGN SYSTEM



The portal supports dark mode and light mode. Dark mode is the default. The user can toggle in settings. The system preference is detected on first load.



Colour tokens — implement as CSS custom properties on :root and [data-theme="light"]:



Dark mode default:



css

:root {

  --bg-primary: #0A0A0A;

  --bg-secondary: #111111;

  --bg-card: #161616;

  --bg-elevated: #1C1C1C;

  --bg-input: #1A1A1A;



  --border-default: rgba(255, 255, 255, 0.08);

  --border-subtle: rgba(255, 255, 255, 0.04);

  --border-strong: rgba(255, 255, 255, 0.16);

  --border-focus: #56d722;



  --text-primary: #FFFFFF;

  --text-secondary: rgba(255, 255, 255, 0.65);

  --text-muted: rgba(255, 255, 255, 0.35);

  --text-disabled: rgba(255, 255, 255, 0.25);



  --accent-green: #56d722;

  --accent-green-subtle: rgba(86, 215, 34, 0.12);

  --accent-green-border: rgba(86, 215, 34, 0.3);



  --state-success: #56d722;

  --state-success-bg: rgba(86, 215, 34, 0.1);

  --state-warning: #F59E0B;

  --state-warning-bg: rgba(245, 158, 11, 0.1);

  --state-error: #EF4444;

  --state-error-bg: rgba(239, 68, 68, 0.1);

  --state-info: #3B82F6;

  --state-info-bg: rgba(59, 130, 246, 0.1);



  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.4);

  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.5);

  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.6);

  --shadow-focus: 0 0 0 3px rgba(86, 215, 34, 0.2);

}



Light mode — applied when data-theme="light" is on the html element:



css

[data-theme="light"] {

  --bg-primary: #F8F8F6;

  --bg-secondary: #FFFFFF;

  --bg-card: #FFFFFF;

  --bg-elevated: #FFFFFF;

  --bg-input: #FFFFFF;



  --border-default: rgba(0, 0, 0, 0.08);

  --border-subtle: rgba(0, 0, 0, 0.04);

  --border-strong: rgba(0, 0, 0, 0.16);

  --border-focus: #56d722;



  --text-primary: #0A0A0A;

  --text-secondary: rgba(0, 0, 0, 0.6);

  --text-muted: rgba(0, 0, 0, 0.35);

  --text-disabled: rgba(0, 0, 0, 0.25);



  --accent-green: #3da819;

  --accent-green-subtle: rgba(61, 168, 25, 0.1);

  --accent-green-border: rgba(61, 168, 25, 0.3);



  --state-success: #3da819;

  --state-success-bg: rgba(61, 168, 25, 0.1);

  --state-warning: #D97706;

  --state-warning-bg: rgba(217, 119, 6, 0.1);

  --state-error: #DC2626;

  --state-error-bg: rgba(220, 38, 38, 0.1);

  --state-info: #2563EB;

  --state-info-bg: rgba(37, 99, 235, 0.1);



  --shadow-sm: 0 1px 3px rgba(0, 0, 0, 0.08);

  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.1);

  --shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);

  --shadow-focus: 0 0 0 3px rgba(86, 215, 34, 0.2);

}



Theme persistence: store the user's theme preference in localStorage under the key synkra-theme. On app load read this value and apply the data-theme attribute to the html element before anything renders. Default to dark if no preference is stored. If the user has prefers-color-scheme: light and no stored preference use light.



Typography:



Import Inter from Google Fonts with weights 400, 500, 600, 700, 800.



Apply globally:



css

body {

  font-family: 'Inter', system-ui, sans-serif;

  -webkit-font-smoothing: antialiased;

  -moz-osx-font-smoothing: grayscale;

  background-color: var(--bg-primary);

  color: var(--text-primary);

}



Type scale as Tailwind custom values:



javascript

// tailwind.config.js

fontSize: {

  'xs': ['11px', { lineHeight: '1.4', letterSpacing: '0.02em' }],

  'sm': ['13px', { lineHeight: '1.5', letterSpacing: '0.01em' }],

  'base': ['15px', { lineHeight: '1.6' }],

  'md': ['17px', { lineHeight: '1.5', letterSpacing: '-0.01em' }],

  'lg': ['20px', { lineHeight: '1.4', letterSpacing: '-0.01em' }],

  'xl': ['24px', { lineHeight: '1.3', letterSpacing: '-0.02em' }],

  '2xl': ['32px', { lineHeight: '1.2', letterSpacing: '-0.02em' }],

  '3xl': ['44px', { lineHeight: '1.1', letterSpacing: '-0.03em' }],

}



Spacing: 4px base unit. All spacing is a multiple of 4.



Border radius tokens:



javascript

borderRadius: {

  'xs': '4px',

  'sm': '6px',

  'md': '10px',

  'lg': '14px',

  'xl': '20px',

  'full': '9999px',

}



POCKETBASE CONNECTION



Create src/lib/pocketbase.ts:



typescript

import PocketBase from 'pocketbase'



const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)



pb.autoCancellation(false)



export default pb



Install pocketbase: npm install pocketbase



The PocketBase client is a singleton. Import it from this file throughout the application. Never create multiple instances. POCKETBASE CONNECTION



Create src/lib/pocketbase.ts:



typescript

import PocketBase from 'pocketbase'



const pb = new PocketBase(import.meta.env.VITE_POCKETBASE_URL)



pb.autoCancellation(false)



export default pb



Install pocketbase: npm install pocketbase



The PocketBase client is a singleton. Import it from this file throughout the application. Never create multiple instances. SECURITY LAYER



Rate limiting on the client side:



Create src/lib/rateLimit.ts:



typescript

interface RateLimitEntry {

  count: number

  resetAt: number

}



const store = new Map<string, RateLimitEntry>()



export function checkRateLimit(

  key: string,

  maxAttempts: number,

  windowMs: number

): { allowed: boolean; remainingMs: number } {

  const now = Date.now()

  const entry = store.get(key)



  if (!entry || now > entry.resetAt) {

    store.set(key, { count: 1, resetAt: now + windowMs })

    return { allowed: true, remainingMs: 0 }

  }



  if (entry.count >= maxAttempts) {

    return { allowed: false, remainingMs: entry.resetAt - now }

  }



  entry.count++

  return { allowed: true, remainingMs: 0 }

}



export function clearRateLimit(key: string): void {

  store.delete(key)

}



Session management and auto logout:



Create src/lib/session.ts:



typescript

const SESSION_TIMEOUT_MS = 30 * 60 * 1000 // 30 minutes

const ACTIVITY_KEY = 'synkra-last-activity'

const TIMEOUT_WARNING_MS = 2 * 60 * 1000 // warn 2 minutes before



let timeoutRef: ReturnType<typeof setTimeout> | null = null

let warningRef: ReturnType<typeof setTimeout> | null = null

let onWarningCallback: (() => void) | null = null

let onLogoutCallback: (() => void) | null = null



export function initSession(

  onWarning: () => void,

  onLogout: () => void

): void {

  onWarningCallback = onWarning

  onLogoutCallback = onLogout

  resetActivity()

  

  const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'click']

  events.forEach(event => {

    document.addEventListener(event, resetActivity, { passive: true })

  })

}



export function resetActivity(): void {

  localStorage.setItem(ACTIVITY_KEY, Date.now().toString())

  clearTimeout(timeoutRef!)

  clearTimeout(warningRef!)

  

  warningRef = setTimeout(() => {

    onWarningCallback?.()

  }, SESSION_TIMEOUT_MS - TIMEOUT_WARNING_MS)



  timeoutRef = setTimeout(() => {

    destroySession()

    onLogoutCallback?.()

  }, SESSION_TIMEOUT_MS)

}



export function destroySession(): void {

  clearTimeout(timeoutRef!)

  clearTimeout(warningRef!)

  localStorage.removeItem(ACTIVITY_KEY)

  localStorage.removeItem('synkra-theme')

}



export function getLastActivity(): number {

  return parseInt(localStorage.getItem(ACTIVITY_KEY) || '0')

}



export function isSessionExpired(): boolean {

  const last = getLastActivity()

  if (!last) return true

  return Date.now() - last > SESSION_TIMEOUT_MS

} Input sanitisation:



Create src/lib/sanitize.ts:



typescript

export function sanitizeInput(input: string): string {

  return input

    .replace(/[<>]/g, '') // remove angle brackets

    .replace(/javascript:/gi, '') // remove javascript: protocol

    .replace(/on\w+=/gi, '') // remove event handlers

    .trim()

    .slice(0, 10000) // enforce max length

}



export function sanitizeEmail(email: string): string {

  return email.trim().toLowerCase().slice(0, 254)

}



export function isValidEmail(email: string): boolean {

  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/

  return re.test(email)

}



CSRF protection:



PocketBase handles CSRF protection natively via its auth token system. The auth token is stored in the PocketBase client instance and sent as a header on every request, not as a cookie. This means CSRF attacks cannot forge requests without the token.



SQL injection:



PocketBase uses parameterised filters. Never construct filter strings by concatenating user input directly. Always use PocketBase's filter syntax with named parameters:



typescript

// Never do this

pb.collection('users').getList(1, 50, { filter: `email = '${email}'` })



// Always do this

pb.collection('users').getList(1, 50, { 

  filter: pb.filter('email = {:email}', { email }) 

})



Create a note comment at the top of all PocketBase query files: SECURITY: Always use pb.filter() for user-supplied values. Never interpolate strings.



Content Security Policy:



Add a meta tag to index.html:



html

<meta http-equiv="Content-Security-Policy" content="

  default-src 'self';

  script-src 'self' 'unsafe-inline';

  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;

  font-src 'self' https://fonts.gstatic.com;

  img-src 'self' data: blob: https:;

  connect-src 'self' https://pb.synkra.co.za https://api.synkra.co.za;

  frame-src 'none';

  object-src 'none';

"> POCKETBASE COLLECTIONS



The Lovable application should create these collections in PocketBase automatically on first run using the PocketBase admin SDK. Add these collection definitions to a file at src/lib/setupCollections.ts. This file runs once when the app is first deployed and the PocketBase admin credentials are provided. // src/lib/setupCollections.ts

// This file creates all required PocketBase collections

// Run manually from the browser console or via a setup endpoint

// NEVER run in production without admin credentials



export const COLLECTION_SCHEMAS = [

  {

    name: 'users',

    type: 'auth',

    schema: [

      { name: 'name', type: 'text', required: true },

      { name: 'business_name', type: 'text' },

      { name: 'business_industry', type: 'text' },

      { name: 'business_address', type: 'text' },

      { name: 'whatsapp_number', type: 'text' },

      { name: 'google_calendar_link', type: 'text' },

      { name: 'google_sheet_id', type: 'text' },

      { name: 'user_type', type: 'select', options: { values: ['beta', 'paid'] } },

      { name: 'trial_ends_at', type: 'date' },

      { name: 'theme_preference', type: 'select', options: { values: ['dark', 'light', 'system'] } },

      { name: 'notify_on_failure', type: 'bool', options: { default: true } },

      { name: 'notify_weekly_summary', type: 'bool', options: { default: true } },

      { name: 'notification_email', type: 'email' },

      // Credits for beta users

      { name: 'credit_emails', type: 'number', options: { default: 100 } },

      { name: 'credit_emails_used', type: 'number', options: { default: 0 } },

      { name: 'credit_workflows', type: 'number', options: { default: 2000 } },

      { name: 'credit_workflows_used', type: 'number', options: { default: 0 } }

    ]

  },

  {

    name: 'workflow_templates',

    type: 'base',

    schema: [

      { name: 'name', type: 'text', required: true },

      { name: 'description', type: 'text' },

      { name: 'category', type: 'text' },

      { name: 'requires_paid_api', type: 'bool' },

      { name: 'integrations_required', type: 'json' },

      { name: 'blocks', type: 'json', required: true },

      { name: 'is_active', type: 'bool', options: { default: true } },

      { name: 'sort_order', type: 'number', options: { default: 0 } }

    ]

  },

  {

    name: 'workflows',

    type: 'base',

    schema: [

      { name: 'user_id', type: 'relation', required: true, options: { collectionId: 'users' } },

      { name: 'template_id', type: 'text' },

      { name: 'name', type: 'text', required: true },

      { name: 'description', type: 'text' },

      { name: 'status', type: 'select', required: true, options: { values: ['draft', 'published', 'paused', 'error'] } },

      { name: 'blocks', type: 'json', required: true },

      { name: 'trigger_type', type: 'text' },

      { name: 'trigger_config', type: 'json' },

      { name: 'integrations_required', type: 'json' },

      { name: 'run_count', type: 'number', options: { default: 0 } },

      { name: 'last_run_at', type: 'date' },

      { name: 'last_run_status', type: 'select', options: { values: ['success', 'failed', 'running'] } }

    ]

  },

  {

    name: 'workflow_runs',

    type: 'base',

    schema: [

      { name: 'workflow_id', type: 'relation', required: true, options: { collectionId: 'workflows' } },

      { name: 'user_id', type: 'relation', required: true, options: { collectionId: 'users' } },

      { name: 'status', type: 'select', required: true, options: { values: ['running', 'success', 'failed'] } },

      { name: 'triggered_at', type: 'date' },

      { name: 'completed_at', type: 'date' },

      { name: 'duration_ms', type: 'number' },

      { name: 'input_data', type: 'json' },

      { name: 'output_data', type: 'json' },

      { name: 'step_logs', type: 'json' },

      { name: 'error_message', type: 'text' }

    ]

  },

  {

    name: 'integrations',

    type: 'base',

    schema: [

      { name: 'user_id', type: 'relation', required: true, options: { collectionId: 'users' } },

      { name: 'type', type: 'select', required: true, options: { values: ['whatsapp', 'google_calendar', 'google_sheets', 'twilio_sms', 'resend_email'] } },

      { name: 'status', type: 'select', options: { values: ['connected', 'disconnected', 'error'] } },

      { name: 'display_name', type: 'text' },

      { name: 'last_tested_at', type: 'date' },

      { name: 'error_message', type: 'text' }

    ]

  }

] Note: Credentials for integrations are stored in your Python backend, never in PocketBase. The integrations collection in PocketBase only stores the status and display information. The actual API keys and OAuth tokens are managed server-side. ROUTING SKELETON



Create the route structure. All routes under /dashboard require authentication. Any unauthenticated access to a protected route redirects to /login.



/ → redirects to /login if not authenticated, to /dashboard if authenticated

/login → LoginPage

/reset-password → ResetPasswordPage

/dashboard → DashboardLayout (persistent shell)

  /dashboard → DashboardHome

  /dashboard/workflows → WorkflowsPage (template gallery and my workflows)

  /dashboard/workflows/builder/new → WorkflowBuilder (build from scratch)

  /dashboard/workflows/builder/:workflowId → WorkflowBuilder (edit existing)

  /dashboard/activity → ActivityPage (logs)

  /dashboard/settings → SettingsPage

  /dashboard/help → HelpPage



Create stub components for every route. Each stub shows the route name and a comment: Built in Portal Prompt [N]. No real content yet. PERSISTENT LAYOUT SHELL



The /dashboard layout wraps all dashboard routes. It renders:



Sidebar on desktop — 240px wide. Left side of the screen. Fixed position.



Top bar on mobile — 60px tall. Fixed at the top.



Bottom tab bar on mobile — 60px tall. Fixed at the bottom.



Content area — fills remaining space. Scrollable.



Sidebar content:



Top section: The SYNKRA wordmark in 16px font-weight 800 color var(--accent-green) letter-spacing 0.1em. Below it in 11px var(--text-muted): Client Portal.



Navigation items — each item is 44px tall, left-aligned, with a Lucide icon at 18px and a label in 14px. Active state: background var(--accent-green-subtle), text var(--accent-green), a 2px left border in var(--accent-green). Hover: background var(--border-subtle).



Items:



Dashboard (Home icon) → /dashboard

Workflows (Zap icon) → /dashboard/workflows

Activity (Activity icon) → /dashboard/activity

Settings (Settings icon) → /dashboard/settings

Help (HelpCircle icon) → /dashboard/help



Bottom of sidebar: user avatar circle in 32px showing initials, user name in 13px, user type badge showing BETA or PRO in 10px. Below that a theme toggle — a sun and moon icon that switches between dark and light mode.



Top bar on mobile:



The SYNKRA wordmark centred. A menu button on the left that opens a full-screen nav overlay. A notification bell on the right.



Bottom tab bar on mobile:



Five tabs: Dashboard, Workflows, Activity, Settings, Help. Active tab shows the icon in var(--accent-green). PWA CONFIGURATION



Install vite-plugin-pwa: npm install vite-plugin-pwa -D



Configure in vite.config.ts:



typescript

import { defineConfig } from 'vite'

import react from '@vitejs/plugin-react'

import { VitePWA } from 'vite-plugin-pwa'



export default defineConfig({

  plugins: [

    react(),

    VitePWA({

      registerType: 'autoUpdate',

      manifest: {

        name: 'Synkra',

        short_name: 'Synkra',

        description: 'Automate your business workflows',

        theme_color: '#0A0A0A',

        background_color: '#0A0A0A',

        display: 'standalone',

        orientation: 'any',

        start_url: '/dashboard',

        icons: [

          {

            src: '/icons/icon-192.png',

            sizes: '192x192',

            type: 'image/png',

            purpose: 'any maskable'

          },

          {

            src: '/icons/icon-512.png',

            sizes: '512x512',

            type: 'image/png',

            purpose: 'any maskable'

          }

        ]

      },

      workbox: {

        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],

        runtimeCaching: [

          {

            urlPattern: /^https:\/\/pb\.synkra\.co\.za\/.*/i,

            handler: 'NetworkFirst',

            options: {

              cacheName: 'pocketbase-cache',

              expiration: { maxEntries: 50, maxAgeSeconds: 300 }

            }

          }

        ]

      }

    })

  ]

})



Add placeholder PWA icons at public/icons/icon-192.png and public/icons/icon-512.png. These are 192x192 and 512x512 black squares with the Synkra S in green. Placeholder is fine for now — real icons replace them later. SESSION WARNING MODAL



A modal that appears 2 minutes before the session expires. It sits in the centre of the screen over a dark overlay.



Heading: Your session is expiring.



One sentence: You will be signed out in 2 minutes due to inactivity.



Two buttons: Stay signed in — green primary — and Sign out — ghost style.



Clicking Stay signed in calls resetActivity() and closes the modal. Clicking Sign out calls destroySession() and redirects to /login. If the user ignores the modal for 2 minutes the session expires and they are redirected to /login with a URL parameter ?reason=expired. On the login page this parameter shows a small informational message: Your session ended due to inactivity. QUALITY CHECKS FOR THIS PROMPT



The application builds without errors: npm run build completes.



The Dockerfile builds without errors: docker build -t synkra-portal . completes.



The .env file is listed in .gitignore and does not appear in git status.



Navigating to /dashboard without being logged in redirects to /login.



The theme toggle switches between dark and light mode. The preference persists after page refresh.



The sidebar renders at 240px on desktop. The bottom tab bar renders on mobile at screens below 768px.



The session warning modal appears after the configured timeout with no user activity.



All five PocketBase collection schemas are defined in setupCollections.ts.



The PWA manifest is valid and accessible at /manifest.webmanifest.



Commit message: feat: portal foundation — design system, security, PocketBase connection, routing, PWA, Docker

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/e9be191d-8caa-4c0a-842a-08f809411fe4).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
