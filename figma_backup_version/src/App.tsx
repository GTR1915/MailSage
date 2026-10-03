import { useMemo, useState } from "react"

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
  id: number
  sender: string
  address: string
  initials: string
  color: string
  subject: string
  preview: string
  body: string
  category: string
  date: string
  time: string
  unread: boolean
  action?: string
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
const categories = ["All emails", "Work", "Updates", "Promotions", "Finance"]
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })

export default function App() {
  const [page, setPage] = useState("Inbox")
  const [query, setQuery] = useState("")
  const [category, setCategory] = useState("All emails")
  const [start, setStart] = useState("2025-06-10")
  const [end, setEnd] = useState("2025-06-16")
  const [range, setRange] = useState({ start: "2025-06-10", end: "2025-06-16" })
  const [fetching, setFetching] = useState(false)
  const [selected, setSelected] = useState<number[]>([])
  const [stars, setStars] = useState<number[]>([3])
  const [read, setRead] = useState<number[]>([])
  const [activeEmail, setActiveEmail] = useState<Email | null>(null)
  const [analyzed, setAnalyzed] = useState<Email[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [notice, setNotice] = useState("")
  const [modal, setModal] = useState<"settings" | "help" | null>(null)
  const [dateMenu, setDateMenu] = useState(false)
  const fetched = useMemo(
    () => EMAILS.filter((e) => e.date >= range.start && e.date <= range.end),
    [range],
  )
  const visible = fetched.filter(
    (e) =>
      (page !== "Starred" || stars.includes(e.id)) &&
      (category === "All emails" || e.category === category) &&
      `${e.sender} ${e.subject} ${e.preview}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  )
  const unread = fetched.filter((e) => e.unread && !read.includes(e.id)).length
  function notify(message: string) {
    setNotice(message)
    window.setTimeout(() => setNotice(""), 4500)
  }
  function fetchEmails() {
    if (!start || !end || start > end) {
      notify(
        "Choose a valid date range. The start date must come before the end date.",
      )
      return
    }
    setFetching(true)
    window.setTimeout(() => {
      setRange({ start, end })
      setSelected([])
      setFetching(false)
      notify("Demo inbox refreshed. Connect Gmail to fetch your real emails.")
    }, 700)
  }
  function analyze(emails: Email[]) {
    if (!emails.length) {
      notify("Select at least one email to analyze.")
      return
    }
    setAnalyzing(true)
    setActiveEmail(null)
    window.setTimeout(() => {
      setAnalyzed(emails)
      setAnalyzing(false)
      setPage("AI analyses")
    }, 1000)
  }
  function toggleSelected(id: number) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  function toggleStar(id: number) {
    setStars((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    )
  }
  const allSelected =
    visible.length > 0 && visible.every((e) => selected.includes(e.id))
  const actionItems = analyzed.filter((email) => email.action)
  const uniqueSenders = new Set(analyzed.map((email) => email.address)).size
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
          mailwise<span className="brand-dot">.</span>
        </a>
        <div className="workspace">
          <span className="workspace-avatar">A</span>
          <div>
            <strong>Alex’s workspace</strong>
            <span>Personal account</span>
          </div>
          <Icon name="chevron" size={15} className="rotate-down" />
        </div>
        <div className="nav-label">WORKSPACE</div>
        <nav>
          {([
            { label: "Inbox", icon: "mail" },
            { label: "AI analyses", icon: "sparkles" },
            { label: "Starred", icon: "star" },
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
              {item.label === "AI analyses" && (
                <span className={analyzed.length ? "nav-count" : "new-badge"}>
                  {analyzed.length || "NEW"}
                </span>
              )}
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
            <span className="profile-avatar">AL</span>
            <div>
              <strong>Alex Lewis</strong>
              <span>alex.lewis@gmail.com</span>
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
              Demo workspace
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
            <span className="profile-avatar small">AL</span>
          </div>
        </header>
        <main>
          {page === "AI analyses" ? (
            <section className="analysis-dashboard">
              <div className="page-heading analysis-page-heading">
                <div>
                  <div className="eyebrow">YOUR AI BRIEFING</div>
                  <h1>Clarity, without the scroll.</h1>
                  <p>
                    See the important threads, decisions, and next steps in one
                    focused workspace.
                  </p>
                </div>
                <button
                  className="button secondary connect-button"
                  onClick={() => setPage("Inbox")}
                >
                  <Icon name="mail" size={16} />
                  <span>Back to inbox</span>
                  <Icon name="arrow" size={14} />
                </button>
              </div>
              {analyzed.length ? (
                <>
                  <section className="analysis-hero">
                    <div className="analysis-hero-copy">
                      <span className="result-kicker">
                        <Icon name="check" size={14} />
                        DEMO ANALYSIS COMPLETE
                      </span>
                      <h2>Your inbox has a clearer story.</h2>
                      <p>
                        We distilled {analyzed.length}{" "}
                        {analyzed.length === 1 ? "email" : "emails"} into the
                        signals that deserve your attention.
                      </p>
                      <div className="analysis-hero-actions">
                        <button
                          className="button analysis-primary-button"
                          onClick={() => setPage("Inbox")}
                        >
                          <Icon name="sparkles" size={16} />
                          Analyze more emails
                        </button>
                        <span>
                          <Icon name="shield" size={14} />
                          Local demo · No content was sent
                        </span>
                      </div>
                    </div>
                    <div className="analysis-hero-art" aria-hidden="true">
                      <div className="analysis-orbit orbit-one" />
                      <div className="analysis-orbit orbit-two" />
                      <div className="orb analysis-hero-orb">
                        <Icon name="sparkles" size={38} />
                      </div>
                      <span className="analysis-spark spark-one">
                        <Icon name="sparkles" size={18} />
                      </span>
                      <span className="analysis-spark spark-two">
                        <Icon name="sparkles" size={11} />
                      </span>
                    </div>
                  </section>

                  <div className="analysis-metrics">
                    <article className="analysis-metric">
                      <span className="analysis-metric-icon">
                        <Icon name="mail" size={18} />
                      </span>
                      <div>
                        <strong>{analyzed.length}</strong>
                        <span>Emails analyzed</span>
                      </div>
                      <p>The conversations in this briefing</p>
                    </article>
                    <article className="analysis-metric">
                      <span className="analysis-metric-icon action">
                        <Icon name="check" size={18} />
                      </span>
                      <div>
                        <strong>{actionItems.length}</strong>
                        <span>Action items</span>
                      </div>
                      <p>
                        {actionItems.length
                          ? "Clear next steps ready for you"
                          : "Nothing needs immediate attention"}
                      </p>
                    </article>
                    <article className="analysis-metric">
                      <span className="analysis-metric-icon people">
                        <Icon name="grid" size={18} />
                      </span>
                      <div>
                        <strong>{uniqueSenders}</strong>
                        <span>
                          {uniqueSenders === 1
                            ? "Conversation"
                            : "Conversations"}
                        </span>
                      </div>
                      <p>Unique senders connected in this view</p>
                    </article>
                  </div>

                  <div className="analysis-content-grid">
                    <section className="insights-card">
                      <div className="analysis-section-heading">
                        <div>
                          <span>KEY INSIGHTS</span>
                          <h2>What matters across your emails</h2>
                        </div>
                        <span className="analysis-count">
                          {analyzed.length}{" "}
                          {analyzed.length === 1 ? "insight" : "insights"}
                        </span>
                      </div>
                      <div className="insight-list">
                        {analyzed.map((email, index) => (
                          <button
                            className="insight-email"
                            key={email.id}
                            onClick={() => {
                              setActiveEmail(email)
                              setRead((prev) =>
                                prev.includes(email.id)
                                  ? prev
                                  : [...prev, email.id],
                              )
                            }}
                          >
                            <span className="insight-number">
                              {String(index + 1).padStart(2, "0")}
                            </span>
                            <span className={`sender-avatar ${email.color}`}>
                              {email.initials}
                            </span>
                            <span className="insight-email-copy">
                              <span className="insight-email-meta">
                                <strong>{email.sender}</strong>
                                <span
                                  className={`category-badge ${email.category.toLowerCase()}`}
                                >
                                  {email.category}
                                </span>
                              </span>
                              <span className="insight-subject">
                                {email.subject}
                              </span>
                              <span className="insight-summary">
                                {email.body
                                  .split("\n")
                                  .filter(Boolean)
                                  .slice(1, 2)
                                  .join(" ") || email.preview}
                              </span>
                            </span>
                            <span className="insight-email-end">
                              {email.action && (
                                <span className="action-flag">
                                  <Icon name="check" size={12} />
                                  Action
                                </span>
                              )}
                              <Icon name="arrow" size={16} />
                            </span>
                          </button>
                        ))}
                      </div>
                    </section>

                    <aside className="next-steps-card">
                      <div className="analysis-section-heading compact">
                        <div>
                          <span>NEXT STEPS</span>
                          <h2>Move things forward</h2>
                        </div>
                        <span className="next-steps-icon">
                          <Icon name="check" size={18} />
                        </span>
                      </div>
                      {actionItems.length ? (
                        <div className="dashboard-actions">
                          {actionItems.map((email) => (
                            <button
                              className="dashboard-action"
                              key={email.id}
                              onClick={() => setActiveEmail(email)}
                            >
                              <span className="dashboard-check">
                                <Icon name="check" size={13} />
                              </span>
                              <span>
                                <strong>{email.action}</strong>
                                <small>
                                  From {email.sender} · {email.subject}
                                </small>
                              </span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="no-dashboard-actions">
                          <span>
                            <Icon name="check" size={24} />
                          </span>
                          <h3>No immediate action items</h3>
                          <p>
                            These conversations are informational. You’re all
                            caught up for now.
                          </p>
                        </div>
                      )}
                      <div className="analysis-privacy">
                        <Icon name="shield" size={15} />
                        <p>
                          This is a local demo summary. Your email content stays
                          in this app.
                        </p>
                      </div>
                    </aside>
                  </div>
                </>
              ) : (
                <section className="analysis-empty">
                  <div className="analysis-empty-art" aria-hidden="true">
                    <div className="analysis-orbit orbit-one" />
                    <div className="analysis-orbit orbit-two" />
                    <div className="orb analysis-empty-orb">
                      <Icon name="sparkles" size={40} />
                    </div>
                  </div>
                  <span className="result-kicker">
                    YOUR FIRST BRIEFING AWAITS
                  </span>
                  <h2>Turn conversations into direction.</h2>
                  <p>
                    Choose one email or bring a few together. Your copilot will
                    surface the summary, connect the themes, and pull out the
                    next steps.
                  </p>
                  <div className="analysis-empty-features">
                    <div>
                      <span>
                        <Icon name="file" size={18} />
                      </span>
                      <strong>Clear summaries</strong>
                      <p>The signal, without the scroll.</p>
                    </div>
                    <div>
                      <span>
                        <Icon name="grid" size={18} />
                      </span>
                      <strong>Connected themes</strong>
                      <p>See patterns across conversations.</p>
                    </div>
                    <div>
                      <span>
                        <Icon name="check" size={18} />
                      </span>
                      <strong>Useful next steps</strong>
                      <p>Know what deserves action.</p>
                    </div>
                  </div>
                  <button
                    className="button analysis-primary-button"
                    onClick={() => setPage("Inbox")}
                  >
                    <Icon name="mail" size={16} />
                    Choose emails to analyze
                    <Icon name="arrow" size={15} />
                  </button>
                  <span className="analysis-empty-note">
                    <Icon name="shield" size={14} />
                    Local demo analysis · Your content stays in this app
                  </span>
                </section>
              )}
            </section>
          ) : (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">A LITTLE CLARITY FOR YOUR INBOX</div>
                  <h1>
                    {page === "Inbox"
                      ? "Your inbox, in focus."
                      : page === "Starred"
                        ? "The emails worth keeping."
                        : "Less reading. More understanding."}
                  </h1>
                  <p>
                    {page === "AI analyses"
                      ? "Turn your conversations into clear insights and next steps."
                      : "Bring your emails together. Let AI connect the dots."}
                  </p>
                </div>
                <button
                  className="button secondary connect-button"
                  onClick={() => setModal("settings")}
                >
                  <GmailMark />
                  <span>Connect Gmail</span>
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
                      type="date"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                  <span className="date-divider">–</span>
                  <label className="date-field">
                    <span>To</span>
                    <input
                      aria-label="End date"
                      type="date"
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
                              const d = new Date("2025-06-16T12:00:00")
                              d.setDate(d.getDate() - days + 1)
                              setStart(d.toISOString().slice(0, 10))
                              setEnd("2025-06-16")
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
                    onClick={fetchEmails}
                    disabled={fetching}
                  >
                    <Icon
                      name={fetching ? "refresh" : "mail"}
                      size={17}
                      className={fetching ? "spinning" : ""}
                    />
                    {fetching ? "Fetching…" : "Fetch emails"}
                  </button>
                </div>
              </section>
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
                  icon="sparkles"
                  label="Emails analyzed"
                  value={analyzed.length}
                  detail="A little less noise, a little more clarity"
                  color="purple"
                />
              </div>
              <div className="inbox-layout">
                <section className="inbox-card">
                  <div className="inbox-title">
                    <div>
                      <h2>
                        {page === "AI analyses"
                          ? "Analyzed emails"
                          : page === "Starred"
                            ? "Starred emails"
                            : "Fetched emails"}{" "}
                        <span className="count-pill">
                          {page === "AI analyses"
                            ? analyzed.length
                            : visible.length}
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
                      onClick={fetchEmails}
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
                          setSelected(
                            allSelected ? [] : visible.map((e) => e.id),
                          )
                        }
                      />
                      <span>
                        {selected.length
                          ? `${selected.length} selected`
                          : "Email"}
                      </span>
                    </label>
                    <button
                      className="bulk-ai"
                      onClick={() =>
                        analyze(
                          selected.length
                            ? fetched.filter((e) => selected.includes(e.id))
                            : visible,
                        )
                      }
                    >
                      <Icon name="sparkles" size={14} />
                      {selected.length ? "Analyze selected" : "Analyze all"}
                      <Icon name="arrow" size={14} />
                    </button>
                  </div>
                  <div className="email-list">
                    {(page === "AI analyses"
                      ? visible.filter((e) =>
                          analyzed.some((a) => a.id === e.id),
                        )
                      : visible
                    ).map((email) => (
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
                            setRead((prev) => [...prev, email.id])
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
                              title="Share this email with AI"
                              onClick={() => analyze([email])}
                            >
                              <Icon name="sparkles" size={16} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {(page === "AI analyses"
                      ? !visible.some((e) =>
                          analyzed.some((a) => a.id === e.id),
                        )
                      : !visible.length) && (
                      <div className="empty-state">
                        <Icon name="mail" size={30} />
                        <h3>
                          {page === "AI analyses"
                            ? "Your insights start with an email"
                            : "No emails found"}
                        </h3>
                        <p>
                          {page === "AI analyses"
                            ? "Click the sparkle beside any email to analyze it."
                            : "Try a different search, category, or date range."}
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="table-footer">
                    <span>
                      Showing{" "}
                      {page === "AI analyses"
                        ? visible.filter((e) =>
                            analyzed.some((a) => a.id === e.id),
                          ).length
                        : visible.length}{" "}
                      of {fetched.length} emails
                    </span>
                    <span>
                      <span className="tiny-dot" />
                      All caught up
                    </span>
                  </div>
                </section>
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
                      <p>Preparing your demo summary and next steps.</p>
                    </div>
                  ) : analyzed.length ? (
                    <div className="analysis-result copilot-ready">
                      <span className="result-kicker">
                        <Icon name="check" size={14} />
                        BRIEFING READY
                      </span>
                      <h3>A clearer picture.</h3>
                      <p className="result-count">
                        Your analysis of {analyzed.length}{" "}
                        {analyzed.length === 1 ? "email is" : "emails is"} ready
                        in its own focused workspace.
                      </p>
                      <button
                        className="button secondary full-width copilot-view-button"
                        onClick={() => setPage("AI analyses")}
                      >
                        View AI briefing
                        <Icon name="arrow" size={15} />
                      </button>
                      <p className="demo-disclaimer">
                        Local demo summary · No content was sent to an AI
                        service.
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
                          Click the <strong>sparkle icon</strong> on any email,
                          or select a few to analyze together.
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
            </>
          )}
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
      {(activeEmail || modal) && (
        <div
          className="modal-backdrop"
          onClick={() => {
            setActiveEmail(null)
            setModal(null)
          }}
        >
          <section
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={
              activeEmail
                ? activeEmail.subject
                : modal === "settings"
                  ? "Account settings"
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
                <div className="email-body">{activeEmail.body}</div>
                <div className="modal-bottom">
                  <span>
                    <Icon name="shield" size={15} />
                    Share only this email
                  </span>
                  <button
                    className="button primary"
                    onClick={() => analyze([activeEmail])}
                  >
                    <Icon name="sparkles" size={17} />
                    Analyze with AI
                  </button>
                </div>
              </>
            ) : modal === "settings" ? (
              <>
                <span className="surface-icon">
                  <GmailMark />
                </span>
                <h2>Connect your Gmail</h2>
                <p className="modal-description">
                  Your workspace is currently using sample emails. A live Gmail
                  connection requires Google OAuth and a secure backend.
                </p>
                <div className="integration-status">
                  <span className="tiny-dot" />
                  Demo mode · No Google account connected
                </div>
                <h3>Designed with your privacy in mind</h3>
                <p className="modal-description">
                  Emails will only be shared with an AI service when you
                  explicitly choose to analyze them. This demo does not fetch
                  real emails or transmit any content.
                </p>
                <button
                  className="button primary full-width"
                  onClick={() => {
                    setModal(null)
                    notify("You can explore all features using the demo inbox.")
                  }}
                >
                  Continue with demo inbox
                  <Icon name="arrow" size={16} />
                </button>
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
                    <h3>Let the copilot help</h3>
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
