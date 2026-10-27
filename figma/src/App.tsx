import { useEffect, useRef, useState } from "react"
import DOMPurify from "dompurify"
import { marked } from "marked"

type IconName = "mail" | "sparkles" | "search" | "chevron" | "calendar" | "arrow" | "grid" | "star" | "settings" | "help" | "bell" | "close" | "check" | "refresh" | "clock" | "shield" | "external" | "more" | "file" | "logout"
function Icon({
  name,
  size = 20,
  className = "",
}: {
  name: IconName
  size?: number
  className?: string
}) {
  const paths: Record<IconName, React.ReactNode> = {
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="3" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    sparkles: (
      <>
        <path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" />
        <path d="m20 2 .6 1.4L22 4l-1.4.6L20 6l-.6-1.4L18 4l1.4-.6L20 2Z" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 4 4" />
      </>
    ),
    chevron: <path d="m9 5 7 7-7 7" />,
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v4M17 3v4M3 11h18M7 15h2m6 0h2M7 18h2" />
      </>
    ),
    arrow: (
      <>
        <path d="M5 12h14m-5-5 5 5-5 5" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="2" />
        <rect x="14" y="3" width="7" height="7" rx="2" />
        <rect x="3" y="14" width="7" height="7" rx="2" />
        <rect x="14" y="14" width="7" height="7" rx="2" />
      </>
    ),
    star: (
      <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
    ),
    settings: (
      <>
        <path d="m9 3-.5 3-2 .9L4 6l-2 4 2.5 2L4 15l2 3 3-.5 2 2.5h3l1.5-3 3-.5 2-3-2-2 .5-3-3-2-2 .5L13 3H9Z" />
        <circle cx="11.5" cy="11.5" r="3" />
      </>
    ),
    help: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4m0 3h.01" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    refresh: (
      <>
        <path d="M20 7v5h-5M4 17v-5h5" />
        <path d="M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8 12 3 3 5-5" />
      </>
    ),
    external: (
      <>
        <path d="M14 3h7v7m0-7L10 14M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" />
      </>
    ),
    more: (
      <>
        <circle cx="5" cy="12" r="1" />
        <circle cx="12" cy="12" r="1" />
        <circle cx="19" cy="12" r="1" />
      </>
    ),
    file: (
      <>
        <path d="M14 3H5v18h14V8l-5-5Zm0 0v5h5M8 12h8M8 16h5" />
      </>
    ),
    logout: (
      <>
        <path d="M9 4H4v16h5m4-13 5 5-5 5m-5-5h10" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

type Email = {
  id: string | number
  sender: string
  address: string
  initials: string
  color: string
  subject: string
  preview: string
  body: string
  bodyText?: string | null
  bodyHtml?: string | null
  snippet?: string | null
  category: string
  date: string
  time: string
  unread: boolean
  action?: string
}

type GmailApiEmail = {
  id: string
  received_at: string
  from: string | null
  subject: string | null
  snippet: string | null
  body_text?: string | null
  body_html?: string | null
  label_ids: string[]
}

type FetchJob = {
  status: "fetching" | "completed" | "failed"
  completed: number
  total: number
  phase: string
  messages?: GmailApiEmail[]
  cached_count: number
  fetched_count: number
  error?: string
}

type GmailUser = {
  email?: string
  first_name?: string
  last_name?: string
  picture?: string
}

type AIProvider = "local" | "openai" | "gemini" | "openrouter" | "openrouter-free" | "other-api"

type LlmSettings = {
  provider: AIProvider
  model: string
  api_key_configured?: boolean
  base_url?: string
  local_model_path?: string
}

const AI_PROVIDERS: { id: AIProvider; label: string; description: string; icon: IconName }[] = [
  { id: "openai", label: "OpenAI", description: "Connect with an OpenAI API key", icon: "sparkles" },
  { id: "gemini", label: "Gemini", description: "Use Google Gemini models", icon: "grid" },
  { id: "openrouter", label: "OpenRouter", description: "Choose from many hosted models", icon: "external" },
  { id: "openrouter-free", label: "OpenRouter Free", description: "Use an OpenRouter :free model", icon: "star" },
  { id: "other-api", label: "Other API", description: "Any OpenAI-compatible endpoint", icon: "settings" },
  { id: "local", label: "Local LLM", description: "Run a GGUF model on this device", icon: "file" },
]

const DEFAULT_MODELS: Record<AIProvider, string> = {
  local: "local-qwen",
  openai: "gpt-5-mini",
  gemini: "gemini-2.5-flash",
  openrouter: "openai/gpt-5-mini",
  "openrouter-free": "meta-llama/llama-3.3-70b-instruct:free",
  "other-api": "model-id-from-provider",
}

const API_PROVIDER_NAMES: Record<Exclude<AIProvider, "local">, string> = {
  openai: "openai",
  gemini: "gemini",
  openrouter: "openrouter",
  "openrouter-free": "openrouter/free",
  "other-api": "openai_compatible",
}

const UI_PROVIDER_NAMES: Record<string, AIProvider> = {
  local: "local",
  openai: "openai",
  gemini: "gemini",
  openrouter: "openrouter",
  "openrouter/free": "openrouter-free",
  openai_compatible: "other-api",
}

type AiAnalysis = {
  id: string
  markdown: string
}

function markdownHtml(markdown: string) {
  return DOMPurify.sanitize(marked.parse(markdown, { async: false }))
}

const avatarColors = ["purple", "violet", "blue", "rose", "teal", "orange"]

function toLocalInputValue(date: Date) {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

function toEmail(message: GmailApiEmail, index: number): Email {
  const sender = message.from?.replace(/\s*<[^>]+>/, "") || "Unknown sender"
  const address = message.from?.match(/<([^>]+)>/)?.[1] || message.from || ""
  const initials = sender
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase()
  const labels = new Set(message.label_ids)
  const category = labels.has("CATEGORY_PROMOTIONS")
    ? "Promotions"
    : labels.has("CATEGORY_UPDATES")
      ? "Updates"
      : "Work"
  const receivedAt = new Date(message.received_at)
  return {
    id: message.id,
    sender,
    address,
    initials: initials || "?",
    color: avatarColors[index % avatarColors.length],
    subject: message.subject || "(No subject)",
    preview: message.snippet || "",
    body: message.body_text || message.snippet || "",
    bodyText: message.body_text,
    bodyHtml: message.body_html || null,
    snippet: message.snippet,
    category,
    date: message.received_at,
    time: receivedAt.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }),
    unread: labels.has("UNREAD"),
  }
}
const EMAILS: Email[] = [
  {
    id: 1,
    sender: "Olivia Rhye",
    address: "olivia@acme.studio",
    initials: "OR",
    color: "purple",
    subject: "Website redesign — ready for your review",
    preview:
      "Hey Alex, the latest designs are ready. Would love your thoughts…",
    body: "Hey Alex,\n\nThe latest website redesign is ready for your review. We’ve incorporated the feedback from our last session and refined the homepage and product pages.\n\nCould you share your feedback by Wednesday? Once we have your approval, the engineering team can start the handoff.\n\nThanks,\nOlivia",
    category: "Work",
    date: "2025-06-16",
    time: "10:42 AM",
    unread: true,
    action:
      "Review the website redesign and send Olivia your feedback by Wednesday.",
  },
  {
    id: 2,
    sender: "Linear",
    address: "notifications@linear.app",
    initials: "L",
    color: "violet",
    subject: "Your weekly workspace digest",
    preview: "Here’s what happened in your workspace this week. 12 issues…",
    body: "Your weekly workspace digest\n\nYour team completed 12 issues, started 3 projects, and shipped the new onboarding flow. There are 4 issues assigned to you awaiting review.\n\nVisit your workspace to catch up with the team.",
    category: "Updates",
    date: "2025-06-16",
    time: "9:15 AM",
    unread: true,
  },
  {
    id: 3,
    sender: "James Wilson",
    address: "james@acme.studio",
    initials: "JW",
    color: "blue",
    subject: "Quick sync on the Q3 roadmap?",
    preview:
      "Hi Alex, can we find 30 minutes this week to align on priorities?",
    body: "Hi Alex,\n\nCan we find 30 minutes this week to align on our Q3 priorities? I’d like to discuss the analytics dashboard, customer onboarding, and the mobile release.\n\nI’m free Tuesday at 2 PM or Thursday at 10 AM. Let me know what works for you.\n\nBest,\nJames",
    category: "Work",
    date: "2025-06-15",
    time: "Jun 15",
    unread: true,
    action:
      "Confirm a 30-minute roadmap sync with James: Tuesday at 2 PM or Thursday at 10 AM.",
  },
  {
    id: 4,
    sender: "Notion",
    address: "team@makenotion.com",
    initials: "N",
    color: "neutral",
    subject: "A little more focus. A lot more possibility.",
    preview:
      "Meet the new features designed to help your team do its best work.",
    body: "Meet the new features designed to help your team do its best work.\n\nDiscover connected projects, improved search, and a simpler calendar experience. Read our latest product update for a full overview.",
    category: "Promotions",
    date: "2025-06-15",
    time: "Jun 15",
    unread: false,
  },
  {
    id: 5,
    sender: "Sarah Chen",
    address: "sarah@acme.studio",
    initials: "SC",
    color: "rose",
    subject: "June invoice & project summary",
    preview: "Attached is the invoice for this month along with a quick recap…",
    body: "Hi Alex,\n\nHere is the invoice for June, totaling $2,400, along with a quick recap of the work completed: design system updates, dashboard wireframes, and usability testing.\n\nPlease arrange payment by June 25. Let me know if you have any questions.\n\nThank you,\nSarah",
    category: "Finance",
    date: "2025-06-14",
    time: "Jun 14",
    unread: false,
    action: "Arrange payment of Sarah’s $2,400 June invoice by June 25.",
  },
  {
    id: 6,
    sender: "Figma",
    address: "team@figma.com",
    initials: "F",
    color: "orange",
    subject: "Your next great idea starts here",
    preview: "A few things to inspire your next project. Explore what’s new…",
    body: "A few things to inspire your next project.\n\nExplore our latest community resources, learn from fellow designers, and discover new ways to bring your ideas to life with Figma.",
    category: "Updates",
    date: "2025-06-13",
    time: "Jun 13",
    unread: false,
  },
  {
    id: 7,
    sender: "Michael Foster",
    address: "michael@acme.studio",
    initials: "MF",
    color: "teal",
    subject: "Re: Customer interview notes",
    preview: "Thanks for pulling these together. A few interesting patterns…",
    body: "Hey Alex,\n\nThanks for pulling these customer interview notes together. A few interesting patterns stood out: users want faster onboarding, clearer analytics, and better export options.\n\nLet’s include these insights in the next product planning session.\n\nCheers,\nMichael",
    category: "Work",
    date: "2025-06-12",
    time: "Jun 12",
    unread: false,
  },
  {
    id: 8,
    sender: "Stripe",
    address: "receipts@stripe.com",
    initials: "S",
    color: "violet",
    subject: "Your receipt from Framer",
    preview:
      "Your payment of $20.00 to Framer has been processed successfully.",
    body: "Your payment has been processed successfully.\n\nMerchant: Framer\nAmount: $20.00\nDate: June 11, 2025\nPlan: Monthly subscription\n\nKeep this receipt for your records.",
    category: "Finance",
    date: "2025-06-11",
    time: "Jun 11",
    unread: false,
  },
]
const DEMO_FOLLOW_UPS: Email[] = [
  [
    ["Priya Shah", "priya@acme.studio", "Q3 roadmap — analytics priorities", "Sharing the analytics priorities we discussed for the Q3 roadmap.", "What should make the first cut?"],
    ["James Wilson", "james@acme.studio", "Re: Q3 roadmap — analytics priorities", "Following up on the analytics priorities for Q3. I recommend we start with retention and onboarding.", "Can we align before Thursday's planning session?"],
    ["Priya Shah", "priya@acme.studio", "Re: Q3 roadmap — decision needed", "A quick follow-up on the Q3 roadmap decision. The team is ready to scope the analytics work.", "Please confirm the priority order."],
  ],
  [
    ["Olivia Rhye", "olivia@acme.studio", "Website redesign — first review", "The first pass of the website redesign is ready for your review.", "I would love feedback on the homepage direction."],
    ["Olivia Rhye", "olivia@acme.studio", "Re: Website redesign — feedback", "Following up on the website redesign feedback and next steps.", "Should we move the approved direction into handoff?"],
    ["Marcus Lee", "marcus@acme.studio", "Website redesign handoff", "The design handoff is ready with the latest homepage and product page files.", "I have included the open questions from the review."],
  ],
  [
    ["Sarah Chen", "sarah@acme.studio", "June invoice & project summary", "Attached is the June invoice and a recap of the completed project work.", "Payment is requested by June 25."],
    ["Sarah Chen", "sarah@acme.studio", "Re: June invoice & project summary", "Checking in on the June invoice and whether you need any additional details.", "Happy to resend the attachment."],
    ["Finance team", "finance@acme.studio", "Payment reminder — June project", "A friendly reminder about the June project invoice.", "Please share the expected payment date."],
  ],
  [
    ["Michael Foster", "michael@acme.studio", "Customer interview notes", "The customer interviews point to faster onboarding, clearer analytics, and better exports.", "These themes should shape product planning."],
    ["Michael Foster", "michael@acme.studio", "Re: Customer interview notes", "A follow-up with the strongest patterns from the customer interviews.", "Let us include these in the next planning session."],
    ["Nina Park", "nina@acme.studio", "Customer research synthesis", "The research synthesis confirms onboarding remains the clearest opportunity.", "I added the evidence and recommended experiments."],
  ],
] as const

const DEMO_EMAILS: Email[] = [...EMAILS, ...DEMO_FOLLOW_UPS.flatMap((group, groupIndex) => group.map((item, itemIndex) => {
  const [sender, address, subject, preview, body] = item
  const initials = sender.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase()
  return { id: `demo-${groupIndex}-${itemIndex}`, sender, address, initials, color: avatarColors[(groupIndex + itemIndex) % avatarColors.length], subject, preview, body: `${body}\n\nThanks,\n${sender}`, category: "Work", date: `2025-06-${String(10 + groupIndex * 2 + itemIndex).padStart(2, "0")}`, time: `Jun ${10 + groupIndex * 2 + itemIndex}`, unread: itemIndex !== 2 }
}))]

const categories = ["All emails", "Work", "Updates", "Promotions", "Finance"]
const dateLabel = (date: string) =>
  new Date(date).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })

function InfoPage({ kind }: { kind: "Features" | "Privacy Policy" }) {
  const features = kind === "Features"
  const items = [["calendar", "Fetch by date range", "Choose exactly which slice of your inbox to bring into focus."], ["sparkles", "AI-powered analysis", "Turn long threads into useful signals, with the provider you choose."], ["mail", "Smart categories", "See work, personal, finance, and other messages at a glance."], ["eye", "Unread tracking", "Keep unread context visible."], ["star", "Starred emails", "Build a dependable list of messages worth keeping close."], ["file", "AI summaries", "Get concise takeaways without opening every thread."], ["cpu", "Local LLM option", "Run analysis on your device when you prefer local processing."]]
  return <div className="info-page"><div className="info-hero"><div><div className="eyebrow">MAILSAGE {features ? "CAPABILITIES" : "TRUST CENTER"}</div><h1>{features ? "A calmer way to work through email." : "Privacy, in plain language."}</h1><p>{features ? "MailSage turns a busy inbox into a focused workspace, with thoughtful AI controls at every step." : "This policy explains what MailSage can access, how your email is processed, and the choices you keep."}</p></div><span className="info-hero-orb"><Icon name={features ? "sparkles" : "shield"} size={38} /></span></div>{features ? <><div className="feature-grid">{items.map(([icon, title, description]) => <article className="feature-card" key={title}><span className="feature-icon"><Icon name={icon} size={21} /></span><h2>{title}</h2><p>{description}</p></article>)}</div><section className="info-callout"><Icon name="shield" size={20} /><div><strong>You stay in control.</strong><p>Fetch only what you need, choose how analysis happens, and keep your inbox workflow focused.</p></div></section></> : <div className="policy-layout"><aside className="policy-toc"><strong>On this page</strong><a href="#access">Gmail access</a><a href="#processing">Processing</a><a href="#providers">AI providers</a><a href="#storage">Storage & sharing</a><a href="#control">Your control</a></aside><article className="policy-card"><p className="policy-updated">Last updated: October 27, 2026</p><p>This policy describes MailSage&apos;s current application behavior. Confirm deployment-specific details before publishing it as a legal notice.</p><h2 id="access">Gmail access and permissions</h2><p>MailSage requests the permissions needed to identify your account and fetch messages you ask for. You can revoke access through Google.</p><h2 id="processing">Email data processing</h2><p>Fetched messages are used to display your workspace, track unread and starred state, categorize messages, and produce requested analyses.</p><h2 id="providers">AI providers and local processing</h2><p>External provider analysis sends selected email content through that provider&apos;s API. With the local LLM option, analysis is intended to run on your device; verify your runtime configuration.</p><h2 id="storage">Storage and sharing</h2><p>This page does not promise a specific retention period, encryption method, or deletion schedule; confirm those details for your deployment.</p><h2 id="control">Your control</h2><p>You can choose the date range and analysis provider, disconnect Gmail, or revoke Google access. Contact your deployment operator for deletion requests.</p></article></div>}</div>
}

export default function App() {
  const [page, setPage] = useState("Inbox")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All emails")
  const [start, setStart] = useState(() => toLocalInputValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)))
  const [end, setEnd] = useState(() => toLocalInputValue(new Date()))
  const [range, setRange] = useState(() => ({ start: toLocalInputValue(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)), end: toLocalInputValue(new Date()) }))
  const [emails, setEmails] = useState<Email[]>(DEMO_EMAILS)
  const [relatedPrompt, setRelatedPrompt] = useState<{ source: Email; matches: { email: Email; reasons: string[] }[] } | null>(null)
  const [relatedSelection, setRelatedSelection] = useState<(string | number)[]>([])
  const [fetching, setFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState({ completed: 0, total: 0, phase: "" })
  const [selected, setSelected] = useState<(string | number)[]>([])
  const [stars, setStars] = useState<(string | number)[]>([])
  const [read, setRead] = useState<(string | number)[]>([])
  const [activeEmail, setActiveEmail] = useState<Email | null>(null)
  const [analyzed, setAnalyzed] = useState<AiAnalysis[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [streamedSummary, setStreamedSummary] = useState("")
  const [activeStreamId, setActiveStreamId] = useState("")
  const [streamedById, setStreamedById] = useState<Record<string, string>>({})
  const [revealedById, setRevealedById] = useState<Record<string, string>>({})
  const [aiPanelWidth, setAiPanelWidth] = useState(282)
  const inboxLayoutRef = useRef<HTMLDivElement>(null)
  const panelResizeRef = useRef<{ startX: number; startWidth: number } | null>(null)
  const [notice, setNotice] = useState("")
  const [modal, setModal] = useState<"settings" | "help" | null>(null)
  const [connectedEmail, setConnectedEmail] = useState<string | null>(null)
  const [gmailUser, setGmailUser] = useState<GmailUser | null>(null)
  const [dateMenu, setDateMenu] = useState(false)
  const [aiProvider, setAiProvider] = useState<AIProvider>("local")
  const [modelName, setModelName] = useState(DEFAULT_MODELS.local)
  const [apiKey, setApiKey] = useState("")
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false)
  const [localModelPath, setLocalModelPath] = useState("")
  const [baseUrl, setBaseUrl] = useState("")
  const [savingSettings, setSavingSettings] = useState(false)
  const fetched = emails
  const visible = fetched.filter(
    (e) =>
      (page !== "Starred" || stars.includes(e.id)) &&
      (category === "All emails" || e.category === category) &&
      `${e.sender} ${e.subject} ${e.preview}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const unread = fetched.filter((e) => e.unread && !read.includes(e.id)).length
  const fullName = [gmailUser?.first_name, gmailUser?.last_name].filter(Boolean).join(" ") || connectedEmail || "Your account"
  const firstName = gmailUser?.first_name || fullName.split(" ")[0] || "Your"
  const initials = [gmailUser?.first_name, gmailUser?.last_name]
    .filter(Boolean)
    .map((name) => name![0])
    .join("")
    .toUpperCase() || "?"
  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 4500)
  }
  async function markEmailsRead(ids: (string | number)[]) {
    const emailIds = ids.map(String)
    setRead((previous) => [...new Set([...previous, ...ids])])
    setEmails((previous) =>
      previous.map((email) =>
        emailIds.includes(String(email.id)) ? { ...email, unread: false } : email,
      ),
    )
    setActiveEmail((previous) =>
      previous && emailIds.includes(String(previous.id))
        ? { ...previous, unread: false }
        : previous,
    )

    const gmailIds = ids.filter((id): id is string => typeof id === "string")
    if (!gmailIds.length) return

    try {
      const response = await fetch("/api/mark-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: gmailIds }),
      })
      const result = (await response.json()) as { error?: string }
      if (!response.ok) {
        throw new Error(result.error || "Gmail could not mark the email as read.")
      }
    } catch (error) {
      notify(
        error instanceof Error
          ? error.message
          : "Marked read locally, but Gmail could not be updated.",
      )
    }
  }
  function resizeAiPanel(width: number) {
    const layoutWidth = inboxLayoutRef.current?.clientWidth || 0
    const maxWidth = Math.max(220, Math.min(layoutWidth * 0.5, layoutWidth - 360))
    setAiPanelWidth(Math.min(maxWidth, Math.max(220, width)))
  }
  function handleAiPanelResizeKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return
    event.preventDefault()
    resizeAiPanel(aiPanelWidth + (event.key === "ArrowLeft" ? 16 : -16))
  }
  useEffect(() => {
    const hasUnrevealedText = Object.entries(streamedById).some(
      ([id, content]) => (revealedById[id] || "").length < content.length,
    )
    if (!hasUnrevealedText) return

    const timer = window.setTimeout(() => {
      setRevealedById((current) => {
        const next = { ...current }
        for (const [id, content] of Object.entries(streamedById)) {
          const revealed = next[id] || ""
          if (revealed.length < content.length) {
            next[id] = content.slice(0, revealed.length + 2)
          }
        }
        return next
      })
    }, 20)

    return () => window.clearTimeout(timer)
  }, [revealedById, streamedById])
  useEffect(() => {
    const handleResize = () => resizeAiPanel(aiPanelWidth)
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [aiPanelWidth])
  useEffect(() => {
    void loadLlmSettings()
    void loadGmailStatus()
  }, [])

  async function loadGmailStatus() {
    try {
      const response = await fetch("/api/gmail/status")
      const status = (await response.json()) as GmailUser & { connected?: boolean }
      if (response.ok && status.connected && status.email) {
        setConnectedEmail(status.email)
        setGmailUser(status)
      }
    } catch {
      // The normal disconnected state is the useful fallback while the local API starts.
    }
  }

  async function connectGmail() {
    setFetching(true)
    notify("Complete the Google permission prompt in your browser to connect Gmail.")
    try {
      const response = await fetch("/api/gmail/connect", { method: "POST" })
      const result = (await response.json()) as GmailUser & { connected?: boolean; error?: string }
      if (!response.ok || !result.connected || !result.email) {
        throw new Error(result.error || "Gmail could not be connected.")
      }
      setConnectedEmail(result.email)
      setGmailUser(result)
      notify(`Gmail connected as ${result.email}.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gmail could not be connected.")
    } finally {
      setFetching(false)
    }
  }

  async function logoutGmail() {
    setFetching(true)
    try {
      const response = await fetch("/api/gmail/logout", { method: "POST" })
      const result = (await response.json()) as { logged_out?: boolean; error?: string }
      if (!response.ok || !result.logged_out) {
        throw new Error(result.error || "Gmail could not be logged out.")
      }
      setConnectedEmail(null)
      setGmailUser(null)
      setEmails([])
      setSelected([])
      setStars([])
      setRead([])
      setActiveEmail(null)
      setAnalyzed([])
      setStreamedSummary("")
      setActiveStreamId("")
      setStreamedById({})
      setRevealedById({})
      setModal(null)
      notify("Logged out of Gmail. Connect again to authorize a mailbox.")
    } catch (error) {
      notify(error instanceof Error ? error.message : "Gmail could not be logged out.")
    } finally {
      setFetching(false)
    }
  }

  async function loadLlmSettings() {
    try {
      const response = await fetch("/api/llm-settings")
      const settings = (await response.json()) as LlmSettings & { error?: string; provider: string }
      if (!response.ok) throw new Error(settings.error || "Could not load AI settings.")
      const provider = UI_PROVIDER_NAMES[settings.provider] || "local"
      setAiProvider(provider)
      setModelName(settings.model || DEFAULT_MODELS[provider])
      setLocalModelPath(settings.local_model_path || "")
      setBaseUrl(settings.base_url || "")
      setApiKeyConfigured(Boolean(settings.api_key_configured))
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not load AI settings.")
    }
  }

  function selectProvider(provider: AIProvider) {
    setAiProvider(provider)
    setModelName(DEFAULT_MODELS[provider])
    setApiKey("")
    setApiKeyConfigured(false)
  }

  async function saveAISettings() {
    if (aiProvider === "local" && !localModelPath.trim()) {
      notify("Enter the path to your local GGUF model.")
      return
    }
    if (aiProvider !== "local" && !apiKey.trim() && !apiKeyConfigured) {
      notify("Enter an API key before saving this provider.")
      return
    }
    if (!modelName.trim()) {
      notify("Enter a model ID before saving.")
      return
    }
    if (aiProvider === "other-api" && !baseUrl.trim()) {
      notify("Enter the provider's Chat Completions URL.")
      return
    }
    setSavingSettings(true)
    try {
      const payload: Record<string, string> = {
        provider: aiProvider === "local" ? "local" : API_PROVIDER_NAMES[aiProvider],
        model: modelName.trim(),
      }
      if (aiProvider === "local") payload.local_model_path = localModelPath.trim()
      if (aiProvider === "other-api") payload.base_url = baseUrl.trim()
      if (apiKey.trim()) payload.api_key = apiKey.trim()
      const response = await fetch("/api/llm-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
      const saved = (await response.json()) as LlmSettings & { error?: string }
      if (!response.ok) throw new Error(saved.error || "Could not save AI settings.")
      setApiKey("")
      setApiKeyConfigured(Boolean(saved.api_key_configured))
      setModal(null)
      notify(`${AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.label} is ready for analysis.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not save AI settings.")
    } finally {
      setSavingSettings(false)
    }
  }
  async function fetchEmails(forceRefresh = false) {
    if (!start || !end || start > end) {
      notify(
        "Choose a valid date range. The start date must come before the end date.",
      )
      return
    }
    setFetching(true)
    setFetchProgress({ completed: 0, total: 0, phase: "Checking local cache" })
    try {
      const response = await fetch("/api/fetch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          start: new Date(start).toISOString(),
          end: new Date(end).toISOString(),
          force_refresh: forceRefresh,
        }),
      })
      const started = (await response.json()) as { job_id?: string; error?: string }
      if (!response.ok || !started.job_id) {
        throw new Error(started.error || "Gmail could not start the fetch.")
      }
      const result = await waitForFetch(started.job_id)
      if (result.status === "failed" || !result.messages) {
        throw new Error(result.error || "Gmail could not return messages.")
      }
      setEmails(result.messages.map(toEmail))
      setRange({ start, end })
      setSelected([])
      notify(
        result.fetched_count
          ? `Updated ${result.fetched_count} emails from Gmail.`
          : `Loaded ${result.cached_count} emails from local cache.`,
      )
    } catch (error) {
      notify(error instanceof Error ? error.message : "Could not fetch Gmail messages.")
    } finally {
      setFetching(false)
    }
  }
  async function waitForFetch(jobId: string): Promise<FetchJob> {
    while (true) {
      const response = await fetch(`/api/fetch/${jobId}`)
      const result = (await response.json()) as FetchJob
      if (!response.ok) {
        throw new Error(result.error || "Could not read fetch progress.")
      }
      setFetchProgress({
        completed: result.completed,
        total: result.total,
        phase: result.phase,
      })
      if (result.status !== "fetching") {
        return result
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350))
    }
  }
  function findRelated(source: Email) {
    const keywords = source.subject.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 4)
    return fetched.filter((candidate) => candidate.id !== source.id).map((email) => {
      const reasons = [
        keywords.some((keyword) => `${email.subject} ${email.preview}`.toLowerCase().includes(keyword)) ? "Semantically similar" : "",
        email.subject.toLowerCase().includes("re:") && email.sender === source.sender ? "Same thread" : "",
        email.sender === source.sender ? "Same sender" : "",
      ].filter(Boolean)
      return { email, reasons }
    }).filter((match) => match.reasons.length).sort((a, b) => b.reasons.length - a.reasons.length).slice(0, 4)
  }

  async function analyze(emailsToAnalyze: Email[], skipRelationCheck = false) {
    if (!emailsToAnalyze.length) {
      notify("Select at least one email to analyze.")
      return
    }
    if (!skipRelationCheck && emailsToAnalyze.length === 1) {
      const matches = findRelated(emailsToAnalyze[0])
      if (matches.length) {
        setRelatedSelection(matches.map((match) => match.email.id))
        setRelatedPrompt({ source: emailsToAnalyze[0], matches })
        return
      }
    }
    setAnalyzing(true)
    setStreamedSummary("")
    setActiveStreamId("")
    setStreamedById({})
    setRevealedById({})
    setActiveEmail(null)
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emails: emailsToAnalyze.map((email) => ({
            id: email.id,
            subject: email.subject,
            sender: email.address || email.sender,
            body_text: email.bodyText,
            body_html: email.bodyHtml,
            snippet: email.snippet || email.body,
            body: email.body,
          })),
        }),
      })
      if (!response.ok || !response.body) throw new Error("Local AI could not start the analysis.")
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      const rawById = new Map<string, string>()
      const completed: AiAnalysis[] = []
      let buffer = ""
      while (true) {
        const { value, done } = await reader.read()
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""
        for (const line of lines) {
          if (!line.trim()) continue
          const event = JSON.parse(line) as { type: string; id?: string; content?: string; analysis?: AiAnalysis; error?: string }
          if (event.type === "token" && event.id && event.content) {
            const id = event.id
            const raw = `${rawById.get(id) || ""}${event.content}`
            rawById.set(id, raw)
            setActiveStreamId(id)
            setStreamedSummary(raw)
            setStreamedById((previous) => ({ ...previous, [id]: raw }))
          } else if (event.type === "analysis" && event.analysis) {
            const analysis = event.analysis
            completed.push(analysis)
            setStreamedById((previous) => ({
              ...previous,
              [analysis.id]: analysis.markdown,
            }))
          } else if (event.type === "error") {
            throw new Error(event.error || "Local AI could not analyze these emails.")
          }
        }
        if (done) break
      }
      if (!completed.length) throw new Error("Local AI returned no analysis.")
      await markEmailsRead(completed.map((analysis) => analysis.id))
      setAnalyzed(completed)
      setPage("AI analyses")
      notify(`Analyzed ${completed.length} email${completed.length === 1 ? "" : "s"} locally.`)
    } catch (error) {
      notify(error instanceof Error ? error.message : "Local AI could not analyze these emails.")
    } finally {
      setAnalyzing(false)
    }
  }
  function toggleSelected(id: string | number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  function toggleStar(id: string | number) {
    setStars((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  const allSelected =
    visible.length > 0 && visible.every((e) => selected.includes(e.id))
  const progressPercent = fetchProgress.total
    ? Math.min(100, Math.round((fetchProgress.completed / fetchProgress.total) * 100))
    : 0
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault()
            setPage("Inbox")
          }}
        >
          <span className="brand-mark">
            <Icon name="mail" size={23} />
          </span>
          Mailsage<span className="brand-dot"></span>
        </a>
        <div className="workspace">
          {gmailUser?.picture ? <img className="workspace-avatar user-photo" src={gmailUser.picture} alt="" /> : <span className="workspace-avatar">{initials}</span>}
          <div>
            <strong>{firstName}’s workspace</strong>
            <span>{connectedEmail || "Personal account"}</span>
          </div>
          <Icon name="chevron" size={15} className="rotate-down" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {([
            { label: "Inbox", icon: "mail" },
            { label: "AI analyses", icon: "sparkles" },
            { label: "Starred", icon: "star" },
            { label: "Features", icon: "sparkles" },
            { label: "Privacy Policy", icon: "shield" },
          ] as const).map((item) => (
            <button
              key={item.label}
              className={`nav-item ${page === item.label ? "active" : ""}`}
              onClick={() => {
                setPage(item.label)
                setCategory("All emails")
                setQuery("")
              }}
            >
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
              {item.label === "Inbox" && (
                <span className="nav-count">{fetched.length}</span>
              )}
              {item.label === "AI analyses" && <span className="new-badge">AI</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="connection-card">
            <span className="connection-icon">
              <Icon name="shield" size={19} />
            </span>
            <strong>Your inbox, only smarter.</strong>
            <p>You’re in control of what you share with AI. Always.</p>
            <button onClick={() => setModal("help")}>
              Learn how it works <Icon name="arrow" size={15} />
            </button>
          </div>
          <button className="nav-item" onClick={() => setModal("settings")}>
            <Icon name="settings" size={19} />
            Settings
          </button>
          <button className="nav-item" onClick={() => setModal("help")}>
            <Icon name="help" size={19} />
            Help & getting started
            <Icon name="external" size={13} />
          </button>
          <div className="profile">
            {gmailUser?.picture ? <img className="profile-avatar user-photo" src={gmailUser.picture} alt="" /> : <span className="profile-avatar">{initials}</span>}
            <div>
              <strong>{fullName}</strong>
              <span>{connectedEmail || "Not connected"}</span>
            </div>
            <button
              className="icon-button"
              aria-label="Account settings"
              onClick={() => setModal("settings")}
            >
              <Icon name="more" size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <Icon name="chevron" size={14} />
            <span>{page}</span>
          </div>
          <div className="topbar-actions">
            <span className="demo-badge">
              <span />
              Personal workspace
            </span>
            <button
              className="icon-button"
              aria-label="Help"
              onClick={() => setModal("help")}
            >
              <Icon name="help" size={19} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label="Notifications"
              onClick={() =>
                notify("You’re all caught up. No new notifications.")
              }
            >
              <Icon name="bell" size={19} />
              <i />
            </button>
            {gmailUser?.picture ? <img className="profile-avatar small user-photo" src={gmailUser.picture} alt="" /> : <span className="profile-avatar small">{initials}</span>}
          </div>
        </header>
        <main className={page === "Features" || page === "Privacy Policy" ? "info-page-active" : ""}>
          {(page === "Features" || page === "Privacy Policy") && <InfoPage kind={page} />}
          <div className="page-heading">
            <div>
              <div className="eyebrow">A LITTLE CLARITY FOR YOUR INBOX</div>
              <h1>
                {page === "Inbox"
                  ? "Your inbox, in focus."
                  : page === "AI analyses"
                    ? "Your AI insights, in one place."
                    : "The emails worth keeping."}
              </h1>
              <p>
                Fetch the messages you need and keep the important ones close.
              </p>
            </div>
            <button
              className="button secondary connect-button"
              onClick={() => void connectGmail()}
              disabled={fetching}
            >
              <GmailMark />
              <span>{connectedEmail ? "Gmail Connected" : "Connect Gmail"}</span>
              <Icon name="external" size={14} />
            </button>
          </div>
          <section className="fetch-card" aria-label="Fetch emails by date">
            <div className="fetch-title">
              <span className="surface-icon">
                <Icon name="calendar" size={21} />
              </span>
              <div>
                <h2>Start with a time frame</h2>
                <p>Choose a date range to fetch your emails.</p>
              </div>
            </div>
            <div className="date-controls">
              <label className="date-field">
                <span>From</span>
                <input
                  aria-label="Start date"
                  type="datetime-local"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </label>
              <span className="date-divider">–</span>
              <label className="date-field">
                <span>To</span>
                <input
                  aria-label="End date"
                  type="datetime-local"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </label>
              <div className="date-preset-wrap">
                <button
                  className="preset-button"
                  onClick={() => setDateMenu(!dateMenu)}
                >
                  Last 7 days
                  <Icon name="chevron" size={13} className="rotate-down" />
                </button>
                {dateMenu && (
                  <div className="preset-menu">
                    {[7, 14, 30].map((days) => (
                      <button
                        key={days}
                        onClick={() => {
                          const now = new Date()
                          const earlier = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
                          setStart(toLocalInputValue(earlier))
                          setEnd(toLocalInputValue(now))
                          setDateMenu(false)
                        }}
                      >
                        Last {days} days
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button
                className="button primary"
                onClick={() => fetchEmails()}
                disabled={fetching}
              >
                <Icon
                  name={fetching ? "refresh" : "mail"}
                  size={17}
                  className={fetching ? "spinning" : ""}
                />
                {fetching ? "Fetching…" : "Fetch emails"}
              </button>
              <button
                className="button secondary refresh-button"
                onClick={() => fetchEmails(true)}
                disabled={fetching}
                title="Fetch this time range from Gmail again"
              >
                <Icon name="refresh" size={16} />
                Fetch again
              </button>
              <button
                className="button secondary"
                onClick={() => analyze(fetched.filter((email) => selected.includes(email.id)))}
                disabled={!selected.length || analyzing}
              >
                <Icon name="sparkles" size={16} />
                Analyze with AI
              </button>
            </div>
          </section>
          {fetching && (
            <div className="fetch-progress" role="status" aria-live="polite">
              <div className="fetch-progress-label">
                <span>{fetchProgress.phase}</span>
                <strong>
                  {fetchProgress.total
                    ? `${fetchProgress.completed} of ${fetchProgress.total} emails`
                    : "Preparing your fetch"}
                </strong>
              </div>
              <div className="fetch-progress-track" aria-hidden="true">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
            </div>
          )}
          <div className="stats-grid">
            <Stat
              icon="mail"
              label="Emails fetched"
              value={fetched.length}
              detail="In your selected time frame"
              color="green"
            />
            <Stat
              icon="mail"
              label="Unread emails"
              value={unread}
              detail="A few things to catch up on"
              color="blue"
            />
            <Stat
              icon="check"
              label="Selected emails"
              value={selected.length}
              detail="Ready for your review"
              color="purple"
            />
          </div>
          <div
            className="inbox-layout"
            ref={inboxLayoutRef}
            style={{ "--ai-panel-width": `${aiPanelWidth}px` } as React.CSSProperties}
          >
            <section className="inbox-card">
              <div className="inbox-title">
                <div>
                  <h2>
                    {page === "Starred"
                        ? "Starred emails"
                        : "Fetched emails"}{" "}
                    <span className="count-pill">
                      {visible.length}
                    </span>
                  </h2>
                  <p>
                    {dateLabel(range.start)} <span>–</span>{" "}
                    {dateLabel(range.end)}
                  </p>
                </div>
                <button
                  className="icon-button"
                  aria-label="Refresh emails"
                  onClick={() => fetchEmails(true)}
                >
                  <Icon
                    name="refresh"
                    size={17}
                    className={fetching ? "spinning" : ""}
                  />
                </button>
              </div>
              <div className="email-toolbar">
                <div className="tabs">
                  {categories.map((c) => (
                    <button
                      key={c}
                      className={category === c ? "selected" : ""}
                      onClick={() => setCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                <div className="search-field">
                  <Icon name="search" size={16} />
                  <input
                    aria-label="Search emails"
                    placeholder="Search emails…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                  <span>⌘ K</span>
                </div>
              </div>
              <div className="table-head">
                <label className="select-all">
                  <input
                    type="checkbox"
                    aria-label="Select all emails"
                    checked={allSelected}
                    onChange={() =>
                      setSelected(allSelected ? [] : visible.map((e) => e.id))
                    }
                  />
                  <span>
                    {selected.length ? `${selected.length} selected` : "Email"}
                  </span>
                </label>
              </div>
              <div className="email-list">
                {visible.map((email) => (
                  <div
                    className={`email-row ${
                      selected.includes(email.id) ? "is-selected" : ""
                    }`}
                    key={email.id}
                  >
                    <input
                      type="checkbox"
                      aria-label={`Select email from ${email.sender}`}
                      checked={selected.includes(email.id)}
                      onChange={() => toggleSelected(email.id)}
                    />
                    <span className={`sender-avatar ${email.color}`}>
                      {email.initials}
                    </span>
                    <button
                      className="email-content"
                      onClick={() => {
                        setActiveEmail(email)
                        void markEmailsRead([email.id])
                      }}
                    >
                      <div className="sender-line">
                        <strong>{email.sender}</strong>
                        {email.unread && !read.includes(email.id) && (
                          <span className="unread-dot" />
                        )}
                        <span
                          className={`category-badge ${email.category.toLowerCase()}`}
                        >
                          {email.category}
                        </span>
                      </div>
                      <div
                        className={`email-subject ${
                          email.unread && !read.includes(email.id)
                            ? "unread"
                            : ""
                        }`}
                      >
                        {email.subject}
                      </div>
                      <p>{email.preview}</p>
                    </button>
                    <div className="email-end">
                      <span className="email-time">{email.time}</span>
                      <div className="row-actions">
                        <button
                          className={`icon-button star-button ${
                            stars.includes(email.id) ? "starred" : ""
                          }`}
                          aria-label={`${
                            stars.includes(email.id) ? "Unstar" : "Star"
                          } email from ${email.sender}`}
                          onClick={() => toggleStar(email.id)}
                        >
                          <Icon name="star" size={15} />
                        </button>
                        <button
                          className="email-ai"
                          aria-label={`Analyze email from ${email.sender}`}
                          title="Analyze with local AI"
                          onClick={() => analyze([email])}
                        >
                          <Icon name="sparkles" size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {!visible.length && (
                  <div className="empty-state">
                    <Icon name="mail" size={30} />
                    <h3>No emails found</h3>
                    <p>Try a different search, category, or time range.</p>
                  </div>
                )}
              </div>
              <div className="table-footer">
                <span>
                  Showing{" "}
                  {visible.length}{" "}
                  of {fetched.length} emails
                </span>
                <span>
                  <span className="tiny-dot" />
                  All caught up
                </span>
              </div>
            </section>
            <div
              className="ai-panel-resize-handle"
              role="separator"
              aria-label="Resize Your AI copilot panel"
              aria-orientation="vertical"
              aria-valuemin={220}
              aria-valuemax={Math.max(
                220,
                Math.min(
                  (inboxLayoutRef.current?.clientWidth || 0) * 0.5,
                  (inboxLayoutRef.current?.clientWidth || 0) - 360,
                ),
              )}
              aria-valuenow={aiPanelWidth}
              tabIndex={0}
              onKeyDown={handleAiPanelResizeKeyDown}
              onPointerDown={(event) => {
                event.currentTarget.setPointerCapture(event.pointerId)
                panelResizeRef.current = {
                  startX: event.clientX,
                  startWidth: aiPanelWidth,
                }
              }}
              onPointerMove={(event) => {
                const drag = panelResizeRef.current
                if (drag) resizeAiPanel(drag.startWidth + drag.startX - event.clientX)
              }}
              onPointerUp={() => {
                panelResizeRef.current = null
              }}
              onPointerCancel={() => {
                panelResizeRef.current = null
              }}
            />
            <aside className="ai-panel">
              <div className="ai-panel-heading">
                <span className="ai-icon">
                  <Icon name="sparkles" size={20} />
                </span>
                <h2>Your AI copilot</h2>
                <span className="beta-badge">BETA</span>
              </div>
              {analyzing ? (
                <div className="ai-welcome">
                  <div className="orb spinning">
                    <Icon name="sparkles" size={32} />
                  </div>
                  <h3>Connecting the dots…</h3>
                  {streamedSummary ? (
                    <div
                      className="markdown-summary"
                      dangerouslySetInnerHTML={{
                        __html: markdownHtml(revealedById[activeStreamId] || ""),
                      }}
                    />
                  ) : (
                    <p className="markdown-summary">Starting your local summary…</p>
                  )}
                </div>
              ) : analyzed.length ? (
                <div className="analysis-result">
                  <span className="result-kicker">
                    <Icon name="check" size={14} />
                    LOCAL ANALYSIS COMPLETE
                  </span>
                  <h3>A clearer picture.</h3>
                  <p className="result-count">
                    Based on {analyzed.length}{" "}
                    {analyzed.length === 1 ? "email" : "emails"} you shared.
                  </p>
                  {analyzed.map((analysis) => (
                    <div className="summary-item" key={analysis.id}>
                      <strong>{fetched.find((email) => String(email.id) === analysis.id)?.sender || "Email"}</strong>
                      <div
                        className="markdown-summary"
                        dangerouslySetInnerHTML={{
                          __html: markdownHtml(revealedById[analysis.id] || ""),
                        }}
                      />
                    </div>
                  ))}
                  <button
                    className="button secondary full-width"
                    onClick={() => {
                      setAnalyzed([])
                      setPage("Inbox")
                    }}
                  >
                    Clear analysis
                  </button>
                  <p className="demo-disclaimer">
                    Local demo summary · No content was sent to an AI service.
                  </p>
                </div>
              ) : (
                <>
                  <div className="ai-welcome">
                    <div className="orb">
                      <Icon name="sparkles" size={35} />
                    </div>
                    <span className="mini-spark one" aria-hidden="true">
                      <Icon name="sparkles" size={14} />
                    </span>
                    <span className="mini-spark two" aria-hidden="true">
                      <Icon name="sparkles" size={9} />
                    </span>
                    <h3>
                      Less inbox.
                      <br />
                      More insight.
                    </h3>
                    <p>
                      Your emails have a story to tell.
                      <br />
                      Let’s find the important parts.
                    </p>
                  </div>
                  <div className="ai-features">
                    <div>
                      <span className="feature-icon">
                        <Icon name="file" size={16} />
                      </span>
                      <div>
                        <strong>Get the bigger picture</strong>
                        <p>Quick summaries, without the scroll.</p>
                      </div>
                    </div>
                    <div>
                      <span className="feature-icon">
                        <Icon name="check" size={17} />
                      </span>
                      <div>
                        <strong>Find your next steps</strong>
                        <p>Turn conversations into action.</p>
                      </div>
                    </div>
                    <div>
                      <span className="feature-icon">
                        <Icon name="grid" size={16} />
                      </span>
                      <div>
                        <strong>Connect the dots</strong>
                        <p>Spot themes across your emails.</p>
                      </div>
                    </div>
                  </div>
                  <div className="ai-tip">
                    <span className="tip-spark">
                      <Icon name="sparkles" size={16} />
                    </span>
                    <p>
                      Click the <strong>sparkle icon</strong> on any email, or
                      select a few to analyze together.
                    </p>
                  </div>
                </>
              )}
              <div className="ai-privacy">
                <Icon name="shield" size={14} />
                <span>Only the emails you choose. Always.</span>
              </div>
            </aside>
          </div>
          <footer className="page-footer">
            <span>Made for a calmer, clearer inbox.</span>
            <span>
              <Icon name="shield" size={13} />
              Your data stays yours.
            </span>
          </footer>
        </main>
      </div>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          <span>{notice}</span>
          <button
            className="icon-button"
            aria-label="Dismiss notification"
            onClick={() => setNotice("")}
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      )}
      {relatedPrompt && (
        <div className="modal-backdrop" onClick={() => setRelatedPrompt(null)}>
          <section className="modal related-modal" role="dialog" aria-modal="true" aria-labelledby="related-title" onClick={(event) => event.stopPropagation()}>
            <button className="modal-close icon-button" aria-label="Close related email dialog" onClick={() => setRelatedPrompt(null)}><Icon name="close" /></button>
            <span className="ai-icon"><Icon name="sparkles" /></span>
            <span className="settings-kicker">CONTEXT CHECK</span>
            <h2 id="related-title">A little more context?</h2>
            <p className="related-intro">I&apos;ve identified {relatedPrompt.matches.length} potentially relevant emails that could provide additional context for your summary.</p>
            <div className="algorithm-legend"><span className="legend-semantic">Semantic similarity</span><span className="legend-thread">Same thread</span><span className="legend-sender">Same sender</span></div>
            <div className="related-list">
              {relatedPrompt.matches.map(({ email, reasons }) => (
                <label className="related-row" key={email.id}>
                  <span className={`relation-marker ${reasons[0].toLowerCase().replaceAll(" ", "-")}`} />
                  <input type="checkbox" checked={relatedSelection.includes(email.id)} onChange={() => setRelatedSelection((current) => current.includes(email.id) ? current.filter((id) => id !== email.id) : [...current, email.id])} />
                  <span className="related-copy"><strong>{email.sender}</strong><span>{email.subject}</span><small>{reasons.join(" · ")}</small></span>
                </label>
              ))}
            </div>
            <div className="related-actions"><button className="button secondary" onClick={() => setRelatedPrompt(null)}>Continue with this email</button><button className="button primary" onClick={() => { const selectedRelated = fetched.filter((email) => relatedSelection.includes(email.id)); setRelatedPrompt(null); void analyze([relatedPrompt.source, ...selectedRelated], true) }}>Include selected emails <Icon name="arrow" size={15} /></button></div>
          </section>
        </div>
      )}
      {(activeEmail || modal) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setActiveEmail(null)
            setModal(null)
          }}
        >
          <section
            className={`modal ${modal === "settings" ? "settings-modal" : ""}`}
            role="dialog"
            aria-modal="true"
            aria-label={
              activeEmail
                ? activeEmail.subject
                : modal === "settings"
                  ? "AI provider settings"
                  : "Getting started"
            }
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="modal-close icon-button"
              aria-label="Close dialog"
              onClick={() => {
                setActiveEmail(null)
                setModal(null)
              }}
            >
              <Icon name="close" />
            </button>
            {activeEmail ? (
              <>
                <span
                  className={`category-badge ${activeEmail.category.toLowerCase()}`}
                >
                  {activeEmail.category}
                </span>
                <h2>{activeEmail.subject}</h2>
                <div className="modal-sender">
                  <span className={`sender-avatar ${activeEmail.color}`}>
                    {activeEmail.initials}
                  </span>
                  <div>
                    <strong>{activeEmail.sender}</strong>
                    <p>{activeEmail.address}</p>
                  </div>
                  <span>{dateLabel(activeEmail.date)}</span>
                </div>
                {activeEmail.bodyHtml ? (
                  <div
                    className="email-body email-html"
                    dangerouslySetInnerHTML={{
                      __html: DOMPurify.sanitize(activeEmail.bodyHtml, {
                        USE_PROFILES: { html: true },
                        ADD_ATTR: ["target"],
                      }),
                    }}
                  />
                ) : (
                  <div className="email-body">{activeEmail.body}</div>
                )}
                <div className="modal-bottom">
                  <span>
                    <Icon name="shield" size={15} />
                    Gmail data stays on this device
                  </span>
                  <button className="button primary" onClick={() => analyze([activeEmail])}>
                    <Icon name="sparkles" size={17} />
                    Analyze with AI
                  </button>
                </div>
              </>
            ) : modal === "settings" ? (
              <>
                <span className="settings-star-flare settings-star-flare-one" aria-hidden="true" />
                <span className="settings-star-flare settings-star-flare-two" aria-hidden="true" />
                <span className="settings-star-flare settings-star-flare-three" aria-hidden="true" />
                <span className="settings-star-flare settings-star-flare-four" aria-hidden="true" />
                <div className="settings-panel">
                <div className="settings-heading">
                  <span className="ai-icon"><Icon name="sparkles" size={20} /></span>
                  <div><span className="settings-kicker">AI SETTINGS</span><h2>Choose how your copilot thinks.</h2><p>Switch between an on-device model and your preferred API provider.</p></div>
                </div>
                <div className="settings-section-heading"><div><h3>AI provider</h3><p>Select the engine used to analyze email.</p></div><span className="settings-status"><span className="tiny-dot" />{AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.label}</span></div>
                <div className="provider-grid">
                  {AI_PROVIDERS.map((provider) => (
                    <button className={`provider-option ${aiProvider === provider.id ? "selected" : ""}`} key={provider.id} onClick={() => selectProvider(provider.id)} aria-pressed={aiProvider === provider.id}>
                      <span className="provider-icon"><Icon name={provider.icon} size={17} /></span><span><strong>{provider.label}</strong><small>{provider.description}</small></span><span className="provider-radio">{aiProvider === provider.id && <span />}</span>
                    </button>
                  ))}
                </div>
                <div className="provider-config"><div className="provider-config-heading"><span className="provider-icon large"><Icon name={AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.icon || "sparkles"} size={19} /></span><div><h3>{AI_PROVIDERS.find((provider) => provider.id === aiProvider)?.label} configuration</h3><p>{aiProvider === "local" ? "Enter the path to the GGUF model on this computer." : "Credentials are saved only by your local Gmail Analyzer backend."}</p></div></div>
                  {aiProvider === "local" ? <div className="local-model-fields"><label className="settings-field"><span>Local GGUF model path</span><input value={localModelPath} onChange={(event) => setLocalModelPath(event.target.value)} placeholder="C:/models/your-model.gguf" /><small>The backend opens this path using llama-cpp-python.</small></label></div> : <div className="api-provider-fields"><label className="settings-field"><span>Model ID</span><input value={modelName} onChange={(event) => setModelName(event.target.value)} placeholder="Enter a provider model ID" /></label><label className="settings-field"><span>API key</span><input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={apiKeyConfigured ? "Saved locally — leave blank to keep it" : "Enter your private API key"} autoComplete="off" spellCheck={false} /><small>{apiKeyConfigured ? "A key is already saved. Enter a value only to replace it." : "Stored locally in .secrets and never returned to this browser."}</small></label>{aiProvider === "other-api" && <label className="settings-field"><span>Chat Completions URL</span><input value={baseUrl} onChange={(event) => setBaseUrl(event.target.value)} placeholder="https://provider.example/v1/chat/completions" /></label>}<div className="settings-note"><Icon name="shield" size={15} /><p>Selected email content is sent only to the provider you save here. OpenRouter Free models must use a model ID ending in <code>:free</code>.</p></div></div>}
                </div>
                <div className={`gmail-settings-row ${connectedEmail ? "connected" : "not-connected"}`}>
                  <span className="tiny-dot" />
                  <div className="gmail-settings-copy">
                      <strong>{connectedEmail ? "Email connected" : "Email not connected"}</strong>
                      <span>{connectedEmail || "Connect an email account to fetch and analyze messages."}</span>
                  </div>
                  {connectedEmail ? (
                    <button className="remove-email-button" onClick={() => void logoutGmail()} disabled={fetching || analyzing}>Logout</button>
                  ) : (
                    <button className="connect-email-button" onClick={() => void connectGmail()} disabled={fetching}>Login</button>
                  )}
                </div>
                <div className="settings-actions">
                  <button className="button secondary" onClick={() => setModal(null)}>Cancel</button>
                  <button className="button primary" onClick={() => void saveAISettings()} disabled={savingSettings}>{savingSettings ? "Saving…" : "Save AI settings"}<Icon name="arrow" size={15} /></button>
                </div>
                </div>
              </>
            ) : (
              <>
                <span className="ai-icon">
                  <Icon name="sparkles" />
                </span>
                <h2>A calmer inbox starts here.</h2>
                <div className="help-step">
                  <span>1</span>
                  <div>
                    <h3>Choose your time frame</h3>
                    <p>
                      Pick a date range and click Fetch emails. Demo emails are
                      available June 11–16, 2025.
                    </p>
                  </div>
                </div>
                <div className="help-step">
                  <span>2</span>
                  <div>
                    <h3>Find what matters</h3>
                    <p>
                      Search, filter by category, star an email, or open it to
                      read the full conversation.
                    </p>
                  </div>
                </div>
                <div className="help-step">
                  <span>3</span>
                  <div>
                    <h3>Read an email</h3>
                    <p>
                      Click an email’s sparkle icon or select multiple emails to
                      see a local demo summary and action items. No data leaves
                      this app.
                    </p>
                  </div>
                </div>
                <button
                  className="button primary full-width"
                  onClick={() => setModal(null)}
                >
                  Got it. Let’s explore
                  <Icon name="arrow" size={16} />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}
function Stat({
  icon,
  label,
  value,
  detail,
  color,
}: {
  icon: IconName
  label: string
  value: number
  detail: string
  color: string
}) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className={`stat-icon ${color}`}>
          <Icon name={icon} size={18} />
        </span>
      </div>
      <div className="stat-value">
        {value}
        <span className="stat-detail">{detail}</span>
      </div>
    </div>
  )
}
function GmailMark() {
  return (
    <svg
      width="19"
      height="17"
      viewBox="0 0 24 20"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 18V5l10 7 10-7v13"
        stroke="#4285F4"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M2 5v13" stroke="#34A853" strokeWidth="4" />
      <path
        d="m2 5 10 7L22 5"
        stroke="#EA4335"
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path d="M22 5v13" stroke="#FBBC04" strokeWidth="4" />
    </svg>
  )
}
