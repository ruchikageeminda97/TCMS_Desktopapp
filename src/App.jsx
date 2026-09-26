import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Clock3,
  CreditCard,
  Download,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Tag,
  Users,
  Wallet,
  X,
  DoorOpen,
} from "lucide-react";

const api = window.tuition;
const today = () => new Date().toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const monthRange = (from, through) => {
  if (!from || from > through) return [];
  const [year, month] = from.split("-").map(Number);
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(
    Number(through.slice(0, 4)),
    Number(through.slice(5, 7)) - 1,
    1,
  );
  const months = [];
  for (
    let date = start;
    date <= end;
    date = Date.UTC(
      new Date(date).getUTCFullYear(),
      new Date(date).getUTCMonth() + 1,
      1,
    )
  ) {
    months.push(new Date(date).toISOString().slice(0, 7));
  }
  return months;
};
const ageFromBirthday = (birthday) => {
  if (!birthday) return null;
  const birth = new Date(`${birthday}T00:00:00`);
  const now = new Date();
  if (Number.isNaN(birth.getTime()) || birth > now) return null;
  return (
    now.getFullYear() -
    birth.getFullYear() -
    (now.getMonth() < birth.getMonth() ||
    (now.getMonth() === birth.getMonth() && now.getDate() < birth.getDate())
      ? 1
      : 0)
  );
};
const money = (amount) =>
  new Intl.NumberFormat(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(amount || 0));
const roundMoney = (amount) =>
  Math.round((Number(amount) + Number.EPSILON) * 100) / 100;
const prettyDate = (date) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "—";
const initials = (name = "") =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
const availabilityLabel = (slots) =>
  slots?.length
    ? slots
        .map(
          (slot) =>
            `${slot.day_of_week.slice(0, 3)} ${slot.start_time}–${slot.end_time}`,
        )
        .join(", ")
    : "No availability set";
const navGroups = [
  {
    label: "Workspace",
    items: [
      ["Overview", "overview", LayoutDashboard],
      ["Students", "students", Users],
      ["Teachers", "teachers", GraduationCap],
      ["Classes", "classes", BookOpen],
      ["Halls", "halls", DoorOpen],
    ],
  },
  {
    label: "Manage",
    items: [
      ["Attendance", "attendance", CheckCheck],
      ["Payments", "payments", CreditCard],
      ["Reports", "reports", Activity],
    ],
  },
];

function App() {
  const [user, setUser] = useState(null);
  const [setup, setSetup] = useState(false);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState("overview");
  const [sidebar, setSidebar] = useState(false);
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState(null);
  const [version, setVersion] = useState(0);
  const refresh = useCallback(() => setVersion((value) => value + 1), []);
  const notify = useCallback((message, kind = "success") => {
    setToast({ message, kind });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    api.auth
      .status()
      .then((result) => {
        setUser(result.user);
        setSetup(result.needsSetup);
      })
      .catch((error) => notify(error.message, "error"))
      .finally(() => setLoading(false));
  }, []);

  const signIn = async (values) => {
    const account = setup
      ? await api.auth.setup(values)
      : await api.auth.login(values);
    setUser(account);
    setSetup(false);
    setPage("overview");
  };

  if (loading)
    return (
      <div className="splash">
        <div className="brand-mark">
          <GraduationCap size={23} />
        </div>
        <span>Loading your workspace…</span>
      </div>
    );
  if (!user) return <AuthScreen setup={setup} onSubmit={signIn} />;

  const pageNames = {
    overview: "Overview",
    students: "Students",
    teachers: "Teachers",
    classes: "Classes",
    halls: "Halls",
    attendance: "Attendance",
    payments: "Payments",
    reports: "Reports",
    settings: "Settings",
  };
  const openPage = (destination) => {
    setPage(destination);
    setSidebar(false);
  };
  const doLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setPage("overview");
  };

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebar ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <GraduationCap size={22} />
          </div>
          <div>
            <div className="brand-name">Classroom</div>
            <div className="brand-caption">TUITION MANAGER</div>
          </div>
          <button
            className="icon-button sidebar-close"
            onClick={() => setSidebar(false)}
            aria-label="Close menu"
          >
            <X size={18} />
          </button>
        </div>
        <div className="org-switcher">
          <div className="org-avatar">{initials(user.organization)}</div>
          <div className="org-copy">
            <b>{user.organization}</b>
            <span>
              {user.role === "admin" ? "Administrator" : "Staff account"}
            </span>
          </div>
          <ChevronDown size={15} className="muted" />
        </div>
        <nav className="nav-list">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <div className="nav-label">{group.label}</div>
              {group.items.map(([label, key, Icon]) => (
                <button
                  className={`nav-item ${page === key ? "active" : ""}`}
                  key={key}
                  onClick={() => openPage(key)}
                >
                  <Icon size={18} strokeWidth={1.9} />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          {/* <div className="sidebar-prompt">
            <div className="prompt-icon">
              <Sparkles size={16} />
            </div>
            <b>Everything in one place</b>
            <p>Students, classes and payments, organized simply.</p>
            <button onClick={() => openPage("settings")}>
              Explore settings <ArrowRight size={13} />
            </button>
          </div> */}
          <button
            className={`nav-item ${page === "settings" ? "active" : ""}`}
            onClick={() => openPage("settings")}
          >
            <Settings size={18} />
            <span>Settings</span>
          </button>
          <button className="profile-row" onClick={doLogout}>
            <div className="avatar avatar-purple">
              {initials(user.username)}
            </div>
            <div className="profile-text">
              <b>{user.username}</b>
              <span>Sign out of account</span>
            </div>
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      {sidebar && (
        <button
          className="backdrop"
          aria-label="Close navigation"
          onClick={() => setSidebar(false)}
        />
      )}
      <main className="main-area">
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setSidebar(true)}
            aria-label="Open menu"
          >
            <Menu size={19} />
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <ChevronRight size={14} />
            <b>{pageNames[page]}</b>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={16} />
              <input
                aria-label="Search"
                placeholder="Search students, RFID…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={async (event) => {
                  if (event.key === "Enter" && query.trim()) {
                    try {
                      const result = await api.students.byRfid(query.trim());
                      if (result) {
                        setPage("students");
                        setModal({ type: "student-detail", student: result });
                      } else
                        notify(
                          "No student found for that card number.",
                          "error",
                        );
                    } catch (error) {
                      notify(error.message, "error");
                    }
                  }
                }}
              />
              <kbd>↵</kbd>
            </div>
            <div className="topbar-date">
              <CalendarDays size={15} />
              {new Date().toLocaleDateString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
              })}
            </div>
            <button
              className="avatar avatar-purple header-avatar"
              title={user.username}
              onClick={doLogout}
            >
              {initials(user.username)}
            </button>
          </div>
        </header>
        <div className="page-container" key={page}>
          <ErrorBoundary>
            <PageContent
              page={page}
              version={version}
              refresh={refresh}
              notify={notify}
              setModal={setModal}
              user={user}
              setUser={setUser}
            />
          </ErrorBoundary>
        </div>
      </main>
      {modal && (
        <ModalHost
          modal={modal}
          close={() => setModal(null)}
          refresh={refresh}
          version={version}
          notify={notify}
          setModal={setModal}
          navigate={openPage}
        />
      )}
      {toast && (
        <div className={`toast toast-${toast.kind}`}>
          <span className="toast-icon">
            {toast.kind === "error" ? (
              <CircleHelp size={17} />
            ) : (
              <Check size={17} />
            )}
          </span>
          {toast.message}
          <button onClick={() => setToast(null)} aria-label="Dismiss">
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

function ErrorBoundary({ children }) {
  const [error, setError] = useState(null);
  if (error)
    return (
      <div className="error-panel">
        <div className="empty-symbol">
          <CircleHelp size={22} />
        </div>
        <h2>We couldn’t load this page</h2>
        <p>{error.message}</p>
        <button
          className="button button-primary"
          onClick={() => {
            setError(null);
            window.location.reload();
          }}
        >
          Try again
        </button>
      </div>
    );
  return <Boundary onError={setError}>{children}</Boundary>;
}
class Boundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error) {
    this.props.onError(error);
  }
  render() {
    return this.state.error ? null : this.props.children;
  }
}

function AuthScreen({ setup, onSubmit }) {
  const [form, setForm] = useState({
    organization: "",
    username: "",
    password: "",
    contact: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const update = (key) => (event) =>
    setForm((old) => ({ ...old, [key]: event.target.value }));
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSubmit(form);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <main className="auth-page">
      <div className="auth-decoration decoration-one" />
      <div className="auth-decoration decoration-two" />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="brand-mark">
            <GraduationCap size={24} />
          </div>
          <span>Classroom</span>
        </div>
        <div className="auth-heading">
          <span className="eyebrow">
            {setup ? "LET’S GET STARTED" : "WELCOME BACK"}
          </span>
          <h1>
            {setup ? "Set up your workspace" : "Sign in to your workspace"}
          </h1>
          <p>
            {setup
              ? "Create your tuition centre account to get started. Your data stays safely on this device."
              : "Enter your account details to continue managing your classes."}
          </p>
        </div>
        <form onSubmit={submit} className="auth-form">
          {setup && (
            <>
              <Field
                label="Tuition centre name"
                required
                value={form.organization}
                onChange={update("organization")}
                placeholder="e.g. Bright Future Academy"
              />
              <Field
                label="Contact number"
                value={form.contact}
                onChange={update("contact")}
                placeholder="Optional"
              />
            </>
          )}
          <Field
            label="Username"
            required
            autoComplete="username"
            value={form.username}
            onChange={update("username")}
            placeholder="Your username"
          />
          <Field
            label="Password"
            required
            type="password"
            autoComplete={setup ? "new-password" : "current-password"}
            minLength={setup ? 8 : undefined}
            value={form.password}
            onChange={update("password")}
            placeholder={setup ? "At least 8 characters" : "Your password"}
          />
          {error && <div className="form-error">{error}</div>}
          <button className="button button-primary auth-submit" disabled={busy}>
            {busy ? "Please wait…" : setup ? "Create workspace" : "Sign in"}
            <ArrowRight size={16} />
          </button>
        </form>
        <div className="auth-security">
          <ShieldCheck size={16} />
          <span>Your data is stored securely on this device</span>
        </div>
      </div>
      <div className="auth-footer">
        A thoughtful workspace for better learning <span>·</span> Tuition
        Manager
      </div>
    </main>
  );
}

function Field({ label, required, children, className = "", ...props }) {
  return (
    <label className={`field ${className}`}>
      <span className="field-label">
        {label}
        {required && <i>*</i>}
      </span>
      {children || <input {...props} required={required} />}
    </label>
  );
}
function SelectField({
  label,
  value,
  onChange,
  options,
  required,
  className = "",
}) {
  return (
    <Field label={label} required={required} className={className}>
      <select value={value} onChange={onChange} required={required}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
function PageHeading({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {action}
    </div>
  );
}
function Button({
  children,
  kind = "primary",
  icon: Icon,
  onClick,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={`button button-${kind}`}
      onClick={onClick}
      {...props}
    >
      {Icon && <Icon size={16} strokeWidth={2} />}
      {children}
    </button>
  );
}
function Status({ value }) {
  const label = value === "not_marked" ? "Not marked" : value;
  return (
    <span className={`status status-${String(value).replaceAll("_", "-")}`}>
      <span />
      {label?.replace(/^./, (letter) => letter.toUpperCase())}
    </span>
  );
}
function Avatar({ name, color = "blue" }) {
  return <div className={`avatar avatar-${color}`}>{initials(name)}</div>;
}
function EmptyState({ title, detail, action }) {
  return (
    <div className="empty-state">
      <div className="empty-symbol">
        <BookOpen size={22} />
      </div>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  );
}
function TableToolbar({
  count,
  placeholder = "Search…",
  query,
  setQuery,
  children,
}) {
  return (
    <div className="table-toolbar">
      <div className="table-search">
        <Search size={16} />
        <input
          placeholder={placeholder}
          aria-label={placeholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <div className="toolbar-right">
        <span className="record-count">
          {count} {count === 1 ? "record" : "records"}
        </span>
        {children}
      </div>
    </div>
  );
}
function useLoad(loader, deps = []) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    loader()
      .then((result) => {
        if (alive) {
          setData(result);
          setError("");
        }
      })
      .catch((err) => {
        if (alive) setError(err.message);
      });
    return () => {
      alive = false;
    };
  }, deps);
  return { data, setData, error };
}

function PageContent({
  page,
  version,
  refresh,
  notify,
  setModal,
  user,
  setUser,
}) {
  if (page === "overview")
    return (
      <Dashboard
        version={version}
        refresh={refresh}
        setModal={setModal}
        notify={notify}
      />
    );
  if (page === "students")
    return (
      <StudentsPage
        version={version}
        refresh={refresh}
        setModal={setModal}
        notify={notify}
      />
    );
  if (page === "teachers")
    return (
      <TeachersPage
        version={version}
        refresh={refresh}
        setModal={setModal}
        notify={notify}
      />
    );
  if (page === "classes")
    return (
      <ClassesPage
        version={version}
        refresh={refresh}
        setModal={setModal}
        notify={notify}
      />
    );
  if (page === "halls")
    return (
      <HallsPage version={version} refresh={refresh} setModal={setModal} />
    );
  if (page === "attendance")
    return (
      <AttendancePage
        version={version}
        refresh={refresh}
        setModal={setModal}
        notify={notify}
      />
    );
  if (page === "payments")
    return (
      <PaymentsPage
        refresh={refresh}
        notify={notify}
        version={version}
        setModal={setModal}
      />
    );
  if (page === "reports")
    return (
      <ReportsPage
        version={version}
        refresh={refresh}
        setModal={setModal}
        notify={notify}
      />
    );
  return (
    <SettingsPage
      user={user}
      setUser={setUser}
      notify={notify}
      refresh={refresh}
    />
  );
}

function Dashboard({ version, refresh, setModal, notify }) {
  const { data, error } = useLoad(() => api.dashboard.get(), [version]);
  if (!data && !error)
    return <div className="loading-panel">Loading your overview…</div>;
  if (error) return <div className="error-inline">{error}</div>;
  const stats = [
    ["Active students", data.students, Users, "blue"],
    ["Teaching staff", data.teachers, GraduationCap, "purple"],
    ["Active classes", data.classes, BookOpen, "orange"],
    ["Collected this month", money(data.collected), Wallet, "green"],
  ];
  const weekday = new Date()
    .toLocaleDateString(undefined, { weekday: "long" })
    .toUpperCase();
  return (
    <div className="page-content">
      <PageHeading
        eyebrow={`${weekday}, YOUR WORKSPACE AT A GLANCE`}
        title="Good day 👋"
        subtitle="Here’s what’s happening at your tuition centre."
        action={
          <Button
            icon={Plus}
            onClick={() => setModal({ type: "student-form" })}
          >
            Add a student
          </Button>
        }
      />
      <div className="stats-grid">
        {stats.map(([label, value, Icon, color]) => (
          <div className="stat-card" key={label}>
            <div className={`stat-icon stat-${color}`}>
              <Icon size={18} />
            </div>
            <div className="stat-label">{label}</div>
            <div className="stat-value">{value}</div>
            <div className="stat-foot">
              {label === "Collected this month"
                ? "For the current month"
                : "Across your workspace"}
            </div>
          </div>
        ))}
      </div>
      <div className="overview-grid">
        <section className="panel sessions-panel">
          <div className="panel-heading">
            <div>
              <h2>Today’s sessions</h2>
              <p>Your classes on the timetable today</p>
            </div>
            <button
              className="text-link"
              onClick={() => setModal({ type: "go-page", page: "attendance" })}
            >
              Attendance <ArrowRight size={14} />
            </button>
          </div>
          {data.sessions.length ? (
            <div className="session-list">
              {data.sessions.map((session) => (
                <div className="session-row" key={session.session_id}>
                  <div className="session-time">
                    <Clock3 size={14} />
                    {session.start_time || "—"}
                  </div>
                  <div className="session-color-bar" />
                  <div className="session-info">
                    <b>{session.class_name}</b>
                    <span>
                      {session.subject || "Class session"}
                      {session.end_time ? ` · until ${session.end_time}` : ""}
                    </span>
                  </div>
                  <Status value={session.status} />
                  <button
                    className="icon-button row-action"
                    onClick={() => setModal({ type: "session", session })}
                    aria-label="Open session"
                  >
                    <ArrowRight size={16} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="session-empty">
              <div className="empty-symbol">
                <CalendarDays size={19} />
              </div>
              <div>
                <b>Nothing on the timetable today</b>
                <span>
                  Head to Attendance to generate sessions from class schedules.
                </span>
              </div>
              <Button
                kind="secondary"
                onClick={() =>
                  setModal({ type: "go-page", page: "attendance" })
                }
              >
                View attendance
              </Button>
            </div>
          )}
        </section>
        <section className="panel collection-panel">
          <div className="panel-heading">
            <div>
              <h2>This month</h2>
              <p>Tuition fee overview</p>
            </div>
            <div className="month-pill">
              <CalendarDays size={13} />
              {new Date().toLocaleDateString(undefined, {
                month: "short",
                year: "numeric",
              })}
            </div>
          </div>
          <div className="collection-amount">{money(data.collected)}</div>
          <div className="collection-caption">collected this month</div>
          <div className="collection-track">
            <div
              style={{
                width: `${data.collected + data.pending === 0 ? 0 : Math.min(100, (data.collected / (data.collected + data.pending)) * 100)}%`,
              }}
            />
          </div>
          <div className="collection-legend">
            <span>
              <i className="legend-green" />
              Collected <b>{money(data.collected)}</b>
            </span>
            <span>
              <i className="legend-gray" />
              Pending <b>{money(data.pending)}</b>
            </span>
          </div>
          <button
            className="collection-link"
            onClick={() => setModal({ type: "go-page", page: "payments" })}
          >
            View payment details <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <section className="panel backup-reminder">
        <div className="backup-art">
          <ShieldCheck size={21} />
        </div>
        <div>
          <b>Keep your records safe</b>
          <span>
            {data.lastBackup
              ? `Last backup: ${prettyDate(data.lastBackup.created_at?.slice(0, 10))}`
              : "You haven’t backed up your records yet. It only takes a moment."}
          </span>
        </div>
        <Button
          kind="secondary"
          icon={ArrowDownToLine}
          onClick={async () => {
            try {
              const result = await api.backup.create();
              if (!result.canceled) {
                notify("Your database backup is ready.");
                refresh();
              }
            } catch (error) {
              notify(error.message, "error");
            }
          }}
        >
          Back up data
        </Button>
      </section>
    </div>
  );
}

function StudentsPage({ version, setModal }) {
  const { data, error } = useLoad(() => api.students.list(), [version]);
  const [query, setQuery] = useState("");
  const rows = useMemo(
    () =>
      (data || []).filter((student) =>
        `${student.name} ${student.school || ""} ${student.contact1} ${student.rfid || ""}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [data, query],
  );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="YOUR LEARNERS"
        title="Students"
        subtitle="Keep student details and class memberships in one easy place."
        action={
          <div className="heading-actions">
            <Button
              kind="secondary"
              icon={Users}
              onClick={() => setModal({ type: "enrollment-form" })}
            >
              Enroll in a class
            </Button>
            <Button
              icon={Plus}
              onClick={() => setModal({ type: "student-form" })}
            >
              Add student
            </Button>
          </div>
        }
      />
      <div className="panel data-panel">
        <TableToolbar
          count={rows.length}
          placeholder="Find a student…"
          query={query}
          setQuery={setQuery}
        />
        {error && <div className="error-inline">{error}</div>}
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>STUDENT</th>
                  <th>SCHOOL</th>
                  <th>CONTACT</th>
                  <th>RFID CARD</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((student) => (
                  <tr
                    key={student.stid}
                    onClick={() =>
                      setModal({ type: "student-detail", student })
                    }
                  >
                    <td>
                      <div className="person-cell">
                        <Avatar name={student.name} />
                        <div>
                          <b>{student.name}</b>
                          <span>
                            {ageFromBirthday(student.birthday) === null
                              ? "Student"
                              : `Age ${ageFromBirthday(student.birthday)}`}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>
                      {student.school || <span className="muted">—</span>}
                    </td>
                    <td>{student.contact1}</td>
                    <td>
                      {student.rfid ? (
                        <span className="rfid-chip">
                          <Activity size={12} />
                          {student.rfid}
                        </span>
                      ) : (
                        <span className="muted">Not assigned</span>
                      )}
                    </td>
                    <td>
                      <Status value={student.status} />
                    </td>
                    <td>
                      <button
                        className="icon-button row-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModal({ type: "student-form", student });
                        }}
                        aria-label="Edit student"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : error ? null : (
          <EmptyState
            title={
              query
                ? "No students match your search"
                : "Your student list is ready"
            }
            detail={
              query
                ? "Try a different name, school, contact or RFID."
                : "Add your first student to start building your tuition centre’s records."
            }
            action={
              !query && (
                <Button
                  icon={Plus}
                  onClick={() => setModal({ type: "student-form" })}
                >
                  Add your first student
                </Button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function TeachersPage({ version, setModal }) {
  const { data, error } = useLoad(() => api.teachers.list(), [version]);
  const [query, setQuery] = useState("");
  const rows = (data || []).filter((row) =>
    `${row.name} ${row.contact || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="THE PEOPLE WHO TEACH"
        title="Teachers"
        subtitle="Manage your teaching team and see who leads each class."
        action={
          <Button
            icon={Plus}
            onClick={() => setModal({ type: "teacher-form" })}
          >
            Add teacher
          </Button>
        }
      />
      <div className="panel data-panel">
        <TableToolbar
          count={rows.length}
          placeholder="Find a teacher…"
          query={query}
          setQuery={setQuery}
        />
        {error && <div className="error-inline">{error}</div>}
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TEACHER</th>
                  <th>CONTACT</th>
                  <th>ADDRESS</th>
                  <th>ABOUT</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.tid}>
                    <td>
                      <div className="person-cell">
                        <Avatar
                          name={row.name}
                          color={
                            ["blue", "purple", "orange", "green"][index % 4]
                          }
                        />
                        <div>
                          <b>{row.name}</b>
                          <span>Teaching staff</span>
                        </div>
                      </div>
                    </td>
                    <td>{row.contact || "—"}</td>
                    <td>{row.address || "—"}</td>
                    <td className="cell-truncate">{row.description || "—"}</td>
                    <td>
                      <button
                        className="icon-button row-action"
                        onClick={() =>
                          setModal({ type: "teacher-form", teacher: row })
                        }
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={query ? "No teachers found" : "Meet your teaching team"}
            detail={
              query
                ? "Try another search."
                : "Add a teacher and assign them to a class."
            }
            action={
              !query && (
                <Button
                  icon={Plus}
                  onClick={() => setModal({ type: "teacher-form" })}
                >
                  Add your first teacher
                </Button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function ClassesPage({ version, setModal }) {
  const { data, error } = useLoad(() => api.classes.list(), [version]);
  const [query, setQuery] = useState("");
  const rows = (data || []).filter((row) =>
    `${row.class_name} ${row.teacher_name} ${row.subject || ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="YOUR PROGRAMME"
        title="Classes"
        subtitle="Set up subjects, timetables, fees and student enrolments."
        action={
          <div className="heading-actions">
            <Button
              kind="secondary"
              icon={Users}
              onClick={() => setModal({ type: "enrollment-form" })}
            >
              Enroll students
            </Button>
            <Button
              icon={Plus}
              onClick={() => setModal({ type: "class-form" })}
            >
              Create class
            </Button>
          </div>
        }
      />
      <div className="panel data-panel">
        <TableToolbar
          count={rows.length}
          placeholder="Find a class…"
          query={query}
          setQuery={setQuery}
        >
          <button
            className="filter-button"
            onClick={() => setModal({ type: "hall-form" })}
          >
            <Plus size={14} /> Add a hall
          </button>
        </TableToolbar>
        {error && <div className="error-inline">{error}</div>}
        {rows.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CLASS</th>
                  <th>TEACHER</th>
                  <th>STUDENTS</th>
                  <th>MONTHLY FEE</th>
                  <th>TEACHER SHARE</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr
                    key={row.class_id}
                    onClick={() =>
                      setModal({ type: "class-detail", classItem: row })
                    }
                  >
                    <td>
                      <div className="class-cell">
                        <div className={`class-icon class-color-${index % 4}`}>
                          <BookOpen size={16} />
                        </div>
                        <div>
                          <b>{row.class_name}</b>
                          <span>
                            {row.subject || "General class"}
                            {row.hall_name ? ` · ${row.hall_name}` : ""}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td>{row.teacher_name}</td>
                    <td>
                      <button
                        className="enroll-link"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModal({ type: "class-detail", classItem: row });
                        }}
                      >
                        <Users size={13} />
                        {row.student_count} · Enroll
                      </button>
                    </td>
                    <td>
                      <b className="table-money">{money(row.fee)}</b>
                    </td>
                    <td>{row.teacher_commission_percentage}%</td>
                    <td>
                      <Status value={row.status} />
                    </td>
                    <td>
                      <button
                        className="icon-button row-action"
                        onClick={(event) => {
                          event.stopPropagation();
                          setModal({ type: "class-form", classItem: row });
                        }}
                        aria-label="Edit class"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={query ? "No classes found" : "Make space for learning"}
            detail={
              query
                ? "Try another search."
                : "Create a class, add a teacher and set your monthly fee."
            }
            action={
              !query && (
                <Button
                  icon={Plus}
                  onClick={() => setModal({ type: "class-form" })}
                >
                  Create your first class
                </Button>
              )
            }
          />
        )}
      </div>
    </div>
  );
}

function HallsPage({ version, setModal }) {
  const { data, error } = useLoad(() => api.halls.list(), [version]);
  const [query, setQuery] = useState("");
  const halls = (data || []).filter((hall) =>
    `${hall.name} ${hall.availability.map((slot) => slot.day_of_week).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const availabilityText = (slots) =>
    slots.length
      ? slots
          .map(
            (slot) =>
              `${slot.day_of_week[0].toUpperCase() + slot.day_of_week.slice(1, 3)} ${new Date(`2000-01-01T${slot.start_time}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}–${new Date(`2000-01-01T${slot.end_time}`).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`,
          )
          .join(" · ")
      : "No times available";
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="ROOMS & TIMETABLES"
        title="Halls"
        subtitle="Manage rooms and the days and times they’re available for classes."
        action={
          <Button icon={Plus} onClick={() => setModal({ type: "hall-form" })}>
            Add hall
          </Button>
        }
      />
      <div className="panel data-panel">
        <TableToolbar
          count={halls.length}
          placeholder="Find a hall…"
          query={query}
          setQuery={setQuery}
        >
          <button
            className="filter-button"
            onClick={() => setModal({ type: "class-form" })}
          >
            <Plus size={14} /> Create class
          </button>
        </TableToolbar>
        {error && <div className="error-inline">{error}</div>}
        {halls.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>HALL</th>
                  <th>CAPACITY</th>
                  <th>WEEKLY AVAILABILITY</th>
                  <th>CLASSES</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {halls.map((hall) => (
                  <tr key={hall.hall_id}>
                    <td>
                      <div className="class-cell">
                        <div className="hall-icon">
                          <DoorOpen size={16} />
                        </div>
                        <div>
                          <b>{hall.name}</b>
                          <span>Teaching space</span>
                        </div>
                      </div>
                    </td>
                    <td>{hall.capacity || "Not set"}</td>
                    <td className="availability-cell">
                      {availabilityText(hall.availability)}
                    </td>
                    <td>{hall.class_count}</td>
                    <td>
                      <button
                        className="small-action"
                        onClick={() => setModal({ type: "hall-form", hall })}
                      >
                        Edit hall
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title={
              query
                ? "No halls match your search"
                : "Add your first teaching space"
            }
            detail={
              query
                ? "Try a different hall name or day."
                : "Set when each room is available. Classes can only use halls at available times."
            }
            action={
              !query && (
                <Button
                  icon={Plus}
                  onClick={() => setModal({ type: "hall-form" })}
                >
                  Add a hall
                </Button>
              )
            }
          />
        )}
      </div>
      <div className="hall-guidance">
        <DoorOpen size={16} />
        <span>
          Class times are checked against hall availability. Two classes can’t
          use the same hall at overlapping times.
        </span>
      </div>
    </div>
  );
}

function AttendancePage({ version, refresh, setModal, notify }) {
  const [date, setDate] = useState(today());
  const { data, error } = useLoad(
    () => api.sessions.list(date),
    [date, version],
  );
  const [generating, setGenerating] = useState(false);
  const generate = async () => {
    setGenerating(true);
    try {
      const result = await api.sessions.generate(date);
      notify(
        result.created
          ? `${result.created} session${result.created === 1 ? "" : "s"} added to the timetable.`
          : "The timetable is already up to date.",
      );
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setGenerating(false);
    }
  };
  const changeDate = (amount) => {
    const next = new Date(`${date}T12:00:00`);
    next.setDate(next.getDate() + amount);
    setDate(next.toISOString().slice(0, 10));
  };
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="EVERY STUDENT, ACCOUNTED FOR"
        title="Attendance"
        subtitle="Start a session, mark who’s here and let the register do the rest."
        action={
          <Button icon={Plus} onClick={generate} disabled={generating}>
            {generating ? "Checking timetable…" : "Generate sessions"}
          </Button>
        }
      />
      <div className="date-toolbar panel">
        <div>
          <div className="date-title">
            {date === today() ? "Today" : prettyDate(date)}
          </div>
          <span>
            {new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        </div>
        <div className="date-actions">
          <button
            className="icon-button"
            onClick={() => changeDate(-1)}
            aria-label="Previous day"
          >
            <ChevronLeft size={18} />
          </button>
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Attendance date"
          />
          <button className="today-button" onClick={() => setDate(today())}>
            Today
          </button>
          <button
            className="icon-button"
            onClick={() => changeDate(1)}
            aria-label="Next day"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      {error && <div className="error-inline">{error}</div>}
      {data?.length ? (
        <div className="attendance-grid">
          {data.map((session) => (
            <article className="attendance-card panel" key={session.session_id}>
              <div className="attendance-card-top">
                <div className="class-icon class-color-0">
                  <BookOpen size={17} />
                </div>
                <Status value={session.status} />
              </div>
              <h3>{session.class_name}</h3>
              <p>{session.subject || "Class session"}</p>
              <div className="attendance-meta">
                <span>
                  <Clock3 size={14} />
                  {session.start_time || "Time not set"}
                  {session.end_time ? ` – ${session.end_time}` : ""}
                </span>
                <span>
                  <Users size={14} />
                  {session.present_count} / {session.roster_count} present
                </span>
              </div>
              <div className="attendance-card-footer">
                <span>
                  {session.status === "ongoing"
                    ? "Register is open"
                    : session.status === "completed"
                      ? "Register completed"
                      : "Ready for roll call"}
                </span>
                <Button
                  kind={session.status === "ongoing" ? "primary" : "secondary"}
                  onClick={() => setModal({ type: "session", session })}
                >
                  {session.status === "ongoing"
                    ? "Take attendance"
                    : session.status === "completed"
                      ? "View register"
                      : "Start session"}
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        !error && (
          <div className="panel empty-attendance">
            <div className="empty-symbol">
              <CalendarDays size={22} />
            </div>
            <h3>No sessions for this day</h3>
            <p>
              Generate sessions from your class schedules to prepare the
              attendance register.
            </p>
            <Button icon={Plus} onClick={generate} disabled={generating}>
              {generating ? "Checking timetable…" : "Generate today’s sessions"}
            </Button>
          </div>
        )
      )}
    </div>
  );
}

function PaymentsPage({ refresh, notify, version, setModal }) {
  const [month, setMonth] = useState(thisMonth());
  const { data, error } = useLoad(
    () => api.payments.overview(month),
    [month, version],
  );
  const [query, setQuery] = useState("");
  const filtered = (data?.rows || []).filter((row) =>
    `${row.name} ${row.class_name}`.toLowerCase().includes(query.toLowerCase()),
  );
  const [selected, setSelected] = useState([]);
  useEffect(() => {
    setSelected([]);
  }, [month, data]);
  const unpaid = filtered.filter((row) => !row.payment_id);
  const pay = async (ids) => {
    if (!ids.length) return;
    try {
      await api.payments.pay({ enrollment_ids: ids, month });
      notify(`${ids.length} payment${ids.length === 1 ? "" : "s"} recorded.`);
      setSelected([]);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    }
  };
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="CLEAR, SIMPLE FEE TRACKING"
        title="Payments"
        subtitle="See what’s been collected and record monthly tuition fees."
        action={
          <Button
            icon={CreditCard}
            onClick={() => pay(selected)}
            disabled={!selected.length}
          >
            Record selected{selected.length ? ` (${selected.length})` : ""}
          </Button>
        }
      />
      <div className="payment-summary-grid">
        <div className="payment-summary panel">
          <div className="payment-summary-icon paid-icon">
            <CheckCheck size={18} />
          </div>
          <span>
            Collected in{" "}
            {new Date(`${month}-02`).toLocaleDateString(undefined, {
              month: "long",
            })}
          </span>
          <b>{money(data?.collected)}</b>
          <small>Payments received</small>
        </div>
        <div className="payment-summary panel">
          <div className="payment-summary-icon due-icon">
            <Clock3 size={18} />
          </div>
          <span>Outstanding this month</span>
          <b>{money(data?.due)}</b>
          <small>Based on enrolled students and discounts</small>
        </div>
        <div className="payment-summary panel">
          <div className="payment-summary-icon total-icon">
            <Wallet size={18} />
          </div>
          <span>Fees to collect</span>
          <b>{money(Number(data?.collected || 0) + Number(data?.due || 0))}</b>
          <small>Collected plus outstanding</small>
        </div>
      </div>
      <div className="panel data-panel">
        <TableToolbar
          count={filtered.length}
          placeholder="Find a student or class…"
          query={query}
          setQuery={setQuery}
        >
          <input
            type="month"
            max={thisMonth()}
            className="month-input"
            aria-label="Payment month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
          {selected.length > 0 && (
            <Button onClick={() => pay(selected)}>
              Collect {selected.length} selected
            </Button>
          )}
        </TableToolbar>
        {error && <div className="error-inline">{error}</div>}
        {filtered.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      aria-label="Select all unpaid"
                      checked={
                        unpaid.length > 0 &&
                        unpaid.every((row) =>
                          selected.includes(row.enrollment_id),
                        )
                      }
                      onChange={(event) =>
                        setSelected(
                          event.target.checked
                            ? unpaid.map((row) => row.enrollment_id)
                            : [],
                        )
                      }
                    />
                  </th>
                  <th>STUDENT</th>
                  <th>CLASS</th>
                  <th>MONTHLY FEE</th>
                  <th>DISCOUNT</th>
                  <th>AMOUNT DUE</th>
                  <th>STATUS</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {filtered.map((row) => (
                  <tr key={row.enrollment_id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Select ${row.name} ${row.class_name}`}
                        disabled={Boolean(row.payment_id)}
                        checked={selected.includes(row.enrollment_id)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, row.enrollment_id]
                              : ids.filter((id) => id !== row.enrollment_id),
                          )
                        }
                      />
                    </td>
                    <td>
                      <div className="person-cell">
                        <Avatar name={row.name} />
                        <div>
                          <b>{row.name}</b>
                          <span>Monthly tuition</span>
                        </div>
                      </div>
                    </td>
                    <td>{row.class_name}</td>
                    <td>{money(row.fee)}</td>
                    <td>
                      <span className="discount-chip">
                        <Tag size={12} />
                        {row.discount_percentage}%
                      </span>
                    </td>
                    <td>
                      <b className="table-money">
                        {money(
                          row.payment_id ? row.amount_paid : row.due_amount,
                        )}
                      </b>
                    </td>
                    <td>
                      {row.payment_id ? (
                        <Status value="paid" />
                      ) : (
                        <Status value="pending" />
                      )}
                    </td>
                    <td>
                      {!row.payment_id && (
                        <button
                          className="small-action"
                          onClick={() => pay([row.enrollment_id])}
                        >
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && (
            <EmptyState
              title={query ? "No matching fees" : "No enrolled students yet"}
              detail={
                query
                  ? "Try another search."
                  : "Enroll students in an active class to see their monthly fees here."
              }
              action={
                <Button
                  kind="secondary"
                  onClick={() => setModal({ type: "go-page", page: "classes" })}
                >
                  View classes
                </Button>
              }
            />
          )
        )}
      </div>
    </div>
  );
}

function ReportsPage({ version, refresh, setModal, notify }) {
  const [month, setMonth] = useState(thisMonth());
  const { data, error } = useLoad(
    () => api.reports.classEarnings(month),
    [month, version],
  );
  const balances = useLoad(() => api.reports.teacherBalances(), [version]);
  const collected = (data || []).reduce(
    (sum, row) => sum + Number(row.collected),
    0,
  );
  const pending = (data || []).reduce(
    (sum, row) => sum + Number(row.pending),
    0,
  );
  const teacherTotal = (data || []).reduce(
    (sum, row) => sum + Number(row.teacher_earnings),
    0,
  );
  const orgTotal = (data || []).reduce(
    (sum, row) => sum + Number(row.org_earnings),
    0,
  );
  const pendingTeacher = (data || []).reduce(
    (sum, row) => sum + Number(row.pending_teacher),
    0,
  );
  const pendingOrg = (data || []).reduce(
    (sum, row) => sum + Number(row.pending_org),
    0,
  );
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="UNDERSTAND YOUR NUMBERS"
        title="Reports"
        subtitle="A straightforward view of tuition income, outstanding fees and teacher shares."
        action={
          <input
            type="month"
            className="month-input"
            aria-label="Report month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        }
      />
      <div className="report-metrics">
        <div>
          <span>Total collected</span>
          <b>{money(collected)}</b>
          <small>Payments recorded for {month}</small>
        </div>
        <div>
          <span>Outstanding tuition</span>
          <b>{money(pending)}</b>
          <small>After individual student discounts</small>
        </div>
        <div>
          <span>Teacher share</span>
          <b>{money(teacherTotal)}</b>
          <small>{money(pendingTeacher)} share of outstanding fees</small>
        </div>
        <div>
          <span>Organization share</span>
          <b>{money(orgTotal)}</b>
          <small>{money(pendingOrg)} share of outstanding fees</small>
        </div>
      </div>
      <div className="panel data-panel report-table">
        <div className="report-heading">
          <div>
            <h2>Class earnings</h2>
            <p>Per-class breakdown for {month}</p>
          </div>
        </div>
        {error && <div className="error-inline">{error}</div>}
        {data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>CLASS &amp; TEACHER</th>
                  <th>ENROLLED</th>
                  <th>PAID / DUE</th>
                  <th>COLLECTED</th>
                  <th>OUTSTANDING</th>
                  <th>TEACHER EARNED / DUE</th>
                  <th>ORG. EARNED / DUE</th>
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr key={row.class_id}>
                    <td>
                      <div>
                        <b>{row.class_name}</b>
                        <div className="sub-cell">
                          {row.teacher_name} ·{" "}
                          {row.teacher_commission_percentage}% commission
                        </div>
                      </div>
                    </td>
                    <td>{row.enrolled_count}</td>
                    <td>
                      <span className="paid-due">
                        {row.paid_students} paid <i>·</i>{" "}
                        {row.not_paid_students} due
                      </span>
                    </td>
                    <td>
                      <b className="table-money">{money(row.collected)}</b>
                    </td>
                    <td>{money(row.pending)}</td>
                    <td>
                      {money(row.teacher_earnings)}{" "}
                      <div className="sub-cell">
                        {money(row.pending_teacher)} pending
                      </div>
                    </td>
                    <td>
                      {money(row.org_earnings)}{" "}
                      <div className="sub-cell">
                        {money(row.pending_org)} pending
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !error && (
            <EmptyState
              title="Your reports will appear here"
              detail="Create a class and enrol students to start tracking monthly earnings."
            />
          )
        )}
      </div>
      <section className="panel data-panel payout-panel">
        <div className="report-heading">
          <div>
            <h2>Teacher payout balances</h2>
            <p>Total earned from recorded tuition minus all payouts to date</p>
          </div>
          <Button
            kind="secondary"
            icon={Plus}
            onClick={() => setModal({ type: "payout-form" })}
          >
            Add payout
          </Button>
        </div>
        {balances.error && <div className="error-inline">{balances.error}</div>}
        {balances.data?.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>TEACHER</th>
                  <th>EARNED TO DATE</th>
                  <th>PAID OUT</th>
                  <th>REMAINING BALANCE</th>
                </tr>
              </thead>
              <tbody>
                {balances.data.map((row) => (
                  <tr key={row.tid}>
                    <td>
                      <b>{row.name}</b>
                    </td>
                    <td>{money(row.earned)}</td>
                    <td>{money(row.paid_out)}</td>
                    <td>
                      <b>{money(row.outstanding)}</b>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          !balances.error && (
            <div className="payout-empty">
              Teacher balances will appear after you add a teacher and class.
            </div>
          )
        )}
      </section>
      <PayoutList version={version} />
    </div>
  );
}
function PayoutList({ version }) {
  const { data, error } = useLoad(() => api.payouts.list(), [version]);
  return (
    <section className="panel data-panel payout-panel">
      <div className="report-heading">
        <div>
          <h2>Recent teacher payouts</h2>
          <p>Recorded payments to your teaching team</p>
        </div>
      </div>
      {error && <div className="error-inline">{error}</div>}
      {data?.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TEACHER</th>
                <th>DATE</th>
                <th>CLASSES / MONTHS</th>
                <th>NOTES</th>
                <th>AMOUNT</th>
              </tr>
            </thead>
            <tbody>
              {data.slice(0, 8).map((row) => (
                <tr key={row.payout_id}>
                  <td>
                    <b>{row.teacher_name}</b>
                  </td>
                  <td>{prettyDate(row.payout_date)}</td>
                  <td>{row.details || "—"}</td>
                  <td>{row.notes || "—"}</td>
                  <td>
                    <b>{money(row.amount)}</b>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        !error && (
          <div className="payout-empty">No teacher payouts recorded yet.</div>
        )
      )}
    </section>
  );
}

function SettingsPage({ user, setUser, notify, refresh }) {
  const { data, error } = useLoad(() => api.settings.organization(), []);
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (data) setForm(data);
  }, [data]);
  const [busy, setBusy] = useState(false);
  const save = async (event) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.settings.saveOrganization(form);
      setUser({ ...user, organization: form.name });
      notify("Organization details saved.");
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const backup = async () => {
    try {
      const result = await api.backup.create();
      if (!result.canceled) notify(`Backup saved to ${result.path}`);
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const restore = async () => {
    try {
      const result = await api.backup.restore();
      if (result.restored) {
        notify("Backup restored. Refreshing your workspace…");
        window.location.reload();
      }
    } catch (err) {
      notify(err.message, "error");
    }
  };
  return (
    <div className="page-content">
      <PageHeading
        eyebrow="MAKE IT YOURS"
        title="Settings"
        subtitle="Manage your tuition centre details and protect your records."
      />
      <div className="settings-grid">
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon">
              <GraduationCap size={19} />
            </div>
            <div>
              <h2>Organization details</h2>
              <p>Shown throughout your workspace</p>
            </div>
          </div>
          {error && <div className="error-inline">{error}</div>}
          {form && (
            <form onSubmit={save} className="settings-form">
              <Field
                label="Organization name"
                required
                value={form.name}
                onChange={(event) =>
                  setForm({ ...form, name: event.target.value })
                }
                placeholder="Your tuition centre"
              />
              <Field
                label="Contact number"
                value={form.contact || ""}
                onChange={(event) =>
                  setForm({ ...form, contact: event.target.value })
                }
                placeholder="Optional"
              />
              <div className="settings-actions">
                <Button type="submit" disabled={busy}>
                  {busy ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </section>
        <section className="panel settings-card">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-green">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h2>Backup &amp; restore</h2>
              <p>Your records belong to you. Keep a copy somewhere safe.</p>
            </div>
          </div>
          <div className="backup-info">
            <div>
              <Download size={17} />
              <div>
                <b>Download a backup</b>
                <span>Save a SQLite copy to a folder you choose.</span>
              </div>
            </div>
            <Button kind="secondary" icon={ArrowDownToLine} onClick={backup}>
              Back up now
            </Button>
          </div>
          <div className="backup-info">
            <div>
              <ArrowDownToLine size={17} />
              <div>
                <b>Restore a backup</b>
                <span>
                  Restore a verified database copy. A safety copy is made first.
                </span>
              </div>
            </div>
            <Button kind="secondary" onClick={restore}>
              Choose file
            </Button>
          </div>
        </section>
        <section className="panel settings-card account-settings">
          <div className="settings-card-heading">
            <div className="settings-icon settings-icon-purple">
              <Users size={19} />
            </div>
            <div>
              <h2>Your account</h2>
              <p>The signed-in account for this workspace</p>
            </div>
          </div>
          <div className="account-details">
            <div className="account-detail">
              <span>Username</span>
              <b>{user.username}</b>
            </div>
            <div className="account-detail">
              <span>Access level</span>
              <b>{user.role === "admin" ? "Administrator" : "Staff"}</b>
            </div>
            <div className="account-detail">
              <span>Workspace</span>
              <b>{user.organization}</b>
            </div>
          </div>
        </section>
        <div className="local-note">
          <ShieldCheck size={16} />
          <span>
            Workspace data is stored locally on this computer. Sign in
            credentials never leave this device.
          </span>
        </div>
      </div>
    </div>
  );
}

function ModalHost({
  modal,
  close,
  refresh,
  version,
  notify,
  setModal,
  navigate,
}) {
  const finish = () => {
    close();
    refresh();
  };
  const body =
    modal.type === "student-form" ? (
      <StudentForm
        student={modal.student}
        close={close}
        finish={finish}
        notify={notify}
      />
    ) : modal.type === "teacher-form" ? (
      <TeacherForm
        teacher={modal.teacher}
        close={close}
        finish={finish}
        notify={notify}
      />
    ) : modal.type === "class-form" ? (
      <ClassForm
        classItem={modal.classItem}
        close={close}
        finish={finish}
        notify={notify}
      />
    ) : modal.type === "enrollment-form" ? (
      <EnrollmentForm
        version={version}
        close={close}
        finish={finish}
        notify={notify}
      />
    ) : modal.type === "class-detail" ? (
      <ClassDetail
        classItem={modal.classItem}
        version={version}
        close={close}
        setModal={setModal}
        refresh={refresh}
        notify={notify}
      />
    ) : modal.type === "student-detail" ? (
      <StudentDetail
        student={modal.student}
        version={version}
        close={close}
        setModal={setModal}
        refresh={refresh}
        notify={notify}
      />
    ) : modal.type === "session" ? (
      <SessionModal
        session={modal.session}
        close={close}
        refresh={refresh}
        notify={notify}
      />
    ) : modal.type === "payout-form" ? (
      <PayoutForm close={close} finish={finish} notify={notify} />
    ) : modal.type === "hall-form" ? (
      <HallForm
        hall={modal.hall}
        close={close}
        finish={finish}
        notify={notify}
      />
    ) : modal.type === "go-page" ? (
      <PageJump page={modal.page} close={close} navigate={navigate} />
    ) : null;
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div className="modal-window" role="dialog" aria-modal="true">
        {body}
      </div>
    </div>
  );
}
function ModalTitle({ eyebrow, title, description, close, back }) {
  return (
    <div className="modal-title">
      {back && (
        <button
          className="icon-button modal-back"
          onClick={back}
          aria-label="Go back"
        >
          <ArrowLeft size={18} />
        </button>
      )}
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
      <button
        className="icon-button modal-close"
        onClick={close}
        aria-label="Close dialog"
      >
        <X size={18} />
      </button>
    </div>
  );
}
function ModalActions({ close, saving, label = "Save changes" }) {
  return (
    <div className="modal-actions">
      <Button kind="secondary" onClick={close}>
        Cancel
      </Button>
      <Button type="submit" disabled={saving}>
        {saving ? "Saving…" : label}
        <ArrowRight size={15} />
      </Button>
    </div>
  );
}

function StudentForm({ student, close, finish, notify }) {
  const [form, setForm] = useState({
    name: student?.name || "",
    school: student?.school || "",
    contact1: student?.contact1 || "",
    contact2: student?.contact2 || "",
    birthday: student?.birthday || "",
    address: student?.address || "",
    status: student?.status || "active",
  });
  const [saving, setSaving] = useState(false);
  const change = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.students.save({ ...form, stid: student?.stid });
      notify(
        student ? "Student details updated." : "Student added successfully.",
      );
      finish();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ModalTitle
        eyebrow="STUDENT PROFILE"
        title={student ? "Edit student" : "Add a student"}
        description="Keep the details that help your centre stay connected."
        close={close}
      />
      <form className="modal-form" onSubmit={submit}>
        <Field
          label="Student’s full name"
          required
          value={form.name}
          onChange={change("name")}
          placeholder="e.g. Aisha Perera"
        />
        <div className="form-two">
          <Field
            label="School"
            value={form.school}
            onChange={change("school")}
            placeholder="School name"
          />
          <Field
            label="Date of birth"
            type="date"
            value={form.birthday}
            onChange={change("birthday")}
          />
        </div>
        <div className="form-two">
          <Field
            label="Primary contact"
            required
            type="tel"
            value={form.contact1}
            onChange={change("contact1")}
            placeholder="Parent or guardian"
          />
          <Field
            label="Other contact"
            type="tel"
            value={form.contact2}
            onChange={change("contact2")}
            placeholder="Optional"
          />
        </div>
        <Field
          label="Home address"
          value={form.address}
          onChange={change("address")}
          placeholder="Optional"
        />
        {student && (
          <SelectField
            label="Student status"
            value={form.status}
            onChange={change("status")}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        )}
        <ModalActions
          close={close}
          saving={saving}
          label={student ? "Save student" : "Add student"}
        />
      </form>
    </>
  );
}

function TeacherForm({ teacher, close, finish, notify }) {
  const [form, setForm] = useState({
    name: teacher?.name || "",
    contact: teacher?.contact || "",
    address: teacher?.address || "",
    description: teacher?.description || "",
  });
  const [saving, setSaving] = useState(false);
  const change = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.teachers.save({ ...form, tid: teacher?.tid });
      notify(
        teacher ? "Teacher details updated." : "Teacher added successfully.",
      );
      finish();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Remove ${teacher.name}?`)) return;
    try {
      await api.teachers.delete(teacher.tid);
      notify("Teacher removed.");
      finish();
    } catch (err) {
      notify(err.message, "error");
    }
  };
  return (
    <>
      <ModalTitle
        eyebrow="TEACHING TEAM"
        title={teacher ? "Edit teacher" : "Add a teacher"}
        description="Add someone new to your tuition centre."
        close={close}
      />
      <form className="modal-form" onSubmit={submit}>
        <Field
          label="Teacher’s name"
          required
          value={form.name}
          onChange={change("name")}
          placeholder="Full name"
        />
        <Field
          label="Contact number"
          type="tel"
          value={form.contact}
          onChange={change("contact")}
          placeholder="Phone or WhatsApp"
        />
        <Field
          label="Address"
          value={form.address}
          onChange={change("address")}
          placeholder="Optional"
        />
        <Field
          label="About the teacher"
          value={form.description}
          onChange={change("description")}
          placeholder="Subjects, experience or a short note"
        />
        <div className="modal-actions">
          {teacher && (
            <button
              type="button"
              className="button button-danger-text"
              onClick={remove}
            >
              Remove
            </button>
          )}
          <span className="action-spacer" />
          <Button kind="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : teacher ? "Save teacher" : "Add teacher"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </>
  );
}

const weekdays = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
];
function ClassForm({ classItem, close, finish, notify }) {
  const { data: teachers } = useLoad(() => api.teachers.list(), []);
  const { data: halls } = useLoad(() => api.halls.list(), []);
  const { data: detail } = useLoad(
    () =>
      classItem
        ? api.classes.detail(classItem.class_id)
        : Promise.resolve(null),
    [],
  );
  const [form, setForm] = useState({
    class_name: classItem?.class_name || "",
    tid: classItem?.tid ? String(classItem.tid) : "",
    subject: classItem?.subject || "",
    fee: classItem?.fee ?? "",
    teacher_commission_percentage:
      classItem?.teacher_commission_percentage ?? 0,
    hall_id: classItem?.hall_id ? String(classItem.hall_id) : "",
    status: classItem?.status || "active",
    schedules: [],
  });
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (detail)
      setForm((current) => ({ ...current, schedules: detail.schedules }));
  }, [detail]);
  const change = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const setSchedule = (index, key, value) =>
    setForm({
      ...form,
      schedules: form.schedules.map((row, i) =>
        i === index ? { ...row, [key]: value } : row,
      ),
    });
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.classes.save({
        ...form,
        class_id: classItem?.class_id,
        tid: Number(form.tid),
        fee: Number(form.fee),
        teacher_commission_percentage: Number(
          form.teacher_commission_percentage,
        ),
        hall_id: form.hall_id ? Number(form.hall_id) : null,
      });
      notify(classItem ? "Class updated." : "Class created.");
      finish();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ModalTitle
        eyebrow="CLASS DETAILS"
        title={classItem ? "Edit class" : "Create a class"}
        description="Set up a class, its fee and weekly timetable."
        close={close}
      />
      <form className="modal-form modal-form-scroll" onSubmit={submit}>
        <Field
          label="Class name"
          required
          value={form.class_name}
          onChange={change("class_name")}
          placeholder="e.g. Grade 10 Mathematics"
        />
        <div className="form-two">
          <SelectField
            label="Teacher"
            required
            value={form.tid}
            onChange={change("tid")}
            options={[
              {
                value: "",
                label: teachers?.length
                  ? "Choose a teacher"
                  : "Add a teacher first",
              },
              ...(teachers || []).map((t) => ({
                value: String(t.tid),
                label: t.name,
              })),
            ]}
          />
          <Field
            label="Subject"
            value={form.subject}
            onChange={change("subject")}
            placeholder="e.g. Mathematics"
          />
        </div>
        <div className="form-two">
          <Field
            label="Monthly fee"
            required
            type="number"
            min="0"
            step="0.01"
            value={form.fee}
            onChange={change("fee")}
            placeholder="0.00"
          />
          <Field
            label="Teacher commission"
            required
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={form.teacher_commission_percentage}
            onChange={change("teacher_commission_percentage")}
            placeholder="0"
          />
        </div>
        <SelectField
          label="Hall (optional)"
          value={form.hall_id}
          onChange={change("hall_id")}
          options={[
            { value: "", label: "No hall selected" },
            ...(halls || []).map((h) => ({
              value: String(h.hall_id),
              label: `${h.name} · ${availabilityLabel(h.availability)}`,
            })),
          ]}
        />
        <div className="schedule-editor">
          <div className="schedule-heading">
            <div>
              <b>Weekly schedule</b>
              <span>Add one or more class times</span>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setForm({
                  ...form,
                  schedules: [
                    ...form.schedules,
                    {
                      day_of_week: "monday",
                      start_time: "09:00",
                      end_time: "10:00",
                    },
                  ],
                })
              }
            >
              <Plus size={14} /> Add time
            </button>
          </div>
          {form.schedules.map((row, index) => (
            <div className="schedule-row" key={index}>
              <select
                aria-label="Day of week"
                value={row.day_of_week}
                onChange={(event) =>
                  setSchedule(index, "day_of_week", event.target.value)
                }
              >
                {weekdays.map((day) => (
                  <option value={day} key={day}>
                    {day[0].toUpperCase() + day.slice(1)}
                  </option>
                ))}
              </select>
              <input
                aria-label="Start time"
                type="time"
                value={row.start_time}
                onChange={(event) =>
                  setSchedule(index, "start_time", event.target.value)
                }
              />
              <span>to</span>
              <input
                aria-label="End time"
                type="time"
                value={row.end_time}
                onChange={(event) =>
                  setSchedule(index, "end_time", event.target.value)
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Remove schedule"
                onClick={() =>
                  setForm({
                    ...form,
                    schedules: form.schedules.filter((_, i) => i !== index),
                  })
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
        </div>
        {classItem && (
          <SelectField
            label="Class status"
            value={form.status}
            onChange={change("status")}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
            ]}
          />
        )}
        <ModalActions
          close={close}
          saving={saving}
          label={classItem ? "Save class" : "Create class"}
        />
      </form>
    </>
  );
}

function EnrollmentForm({ version, close, finish, notify }) {
  const { data: classes, error: classesError } = useLoad(
    () => api.classes.list(),
    [version],
  );
  const { data: students, error: studentsError } = useLoad(
    () => api.students.list(),
    [version],
  );
  const [classId, setClassId] = useState("");
  const { data: detail, error: detailError } = useLoad(
    () =>
      classId ? api.classes.detail(Number(classId)) : Promise.resolve(null),
    [classId, version],
  );
  const [selected, setSelected] = useState([]);
  const [discounts, setDiscounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const classItem = (classes || []).find(
    (item) => String(item.class_id) === classId,
  );
  const available = (students || []).filter(
    (student) =>
      student.status === "active" &&
      !detail?.enrollments.some(
        (enrollment) =>
          enrollment.stid === student.stid && enrollment.status === "active",
      ),
  );
  const fee = (discount) =>
    roundMoney(Number(classItem?.fee || 0) * (1 - Number(discount || 0) / 100));
  const teacherShare = (discount) =>
    roundMoney(
      (fee(discount) * Number(classItem?.teacher_commission_percentage || 0)) /
        100,
    );
  const submit = async (event) => {
    event.preventDefault();
    if (!selected.length) {
      setError("Select one or more students to enrol.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await api.classes.enroll({
        class_id: Number(classId),
        students: selected.map((stid) => ({
          stid,
          discount_percentage: Number(discounts[stid] || 0),
        })),
      });
      notify(
        `${selected.length} student${selected.length === 1 ? "" : "s"} enrolled in ${classItem.class_name}.`,
      );
      finish();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ModalTitle
        eyebrow="CLASS ENROLMENT"
        title="Enroll students"
        description="Choose a class and students, then set an optional discount for each student."
        close={close}
      />
      <form className="modal-form modal-form-scroll" onSubmit={submit}>
        <SelectField
          label="Class"
          required
          value={classId}
          onChange={(event) => {
            setClassId(event.target.value);
            setSelected([]);
            setDiscounts({});
            setError("");
          }}
          options={[
            {
              value: "",
              label: classes?.length
                ? "Choose a class"
                : "Create a class first",
            },
            ...(classes || [])
              .filter((item) => item.status === "active")
              .map((item) => ({
                value: String(item.class_id),
                label: `${item.class_name} · ${money(item.fee)} monthly`,
              })),
          ]}
        />
        {(classesError || studentsError || detailError) && (
          <div className="form-error">
            {classesError || studentsError || detailError}
          </div>
        )}
        {classItem && (
          <>
            <div className="enrollment-fee-note">
              <b>{classItem.class_name}</b>
              <span>
                Full fee {money(classItem.fee)} · Teacher share{" "}
                {classItem.teacher_commission_percentage}%
              </span>
              <small>
                Discounts reduce the tuition first; commission is calculated on
                the amount the student pays.
              </small>
            </div>
            <div className="enroll-options enrollment-form-options">
              {available.length ? (
                available.map((student) => {
                  const discount = Number(discounts[student.stid] || 0);
                  const payable = fee(discount);
                  const teacher = teacherShare(discount);
                  return (
                    <div
                      className={`enroll-option ${selected.includes(student.stid) ? "enroll-option-selected" : ""}`}
                      key={student.stid}
                    >
                      <label className="enroll-choice">
                        <input
                          type="checkbox"
                          checked={selected.includes(student.stid)}
                          onChange={(event) =>
                            setSelected((ids) =>
                              event.target.checked
                                ? [...ids, student.stid]
                                : ids.filter((id) => id !== student.stid),
                            )
                          }
                        />
                        <span>{student.name}</span>
                      </label>
                      <div className="enroll-fee-editor">
                        <label>
                          <input
                            type="number"
                            aria-label={`Discount percentage for ${student.name}`}
                            min="0"
                            max="100"
                            step="0.1"
                            placeholder="0"
                            value={discounts[student.stid] ?? ""}
                            onChange={(event) =>
                              setDiscounts({
                                ...discounts,
                                [student.stid]: event.target.value,
                              })
                            }
                          />
                          <span>% off</span>
                        </label>
                        <b className="enroll-fee-amount">{money(payable)}</b>
                      </div>
                      {selected.includes(student.stid) && (
                        <div className="enroll-split">
                          <span>
                            Student pays <b>{money(payable)}</b>
                          </span>
                          <span>
                            Teacher <b>{money(teacher)}</b>
                          </span>
                          <span>
                            Organization <b>{money(payable - teacher)}</b>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="roster-empty">
                  {students?.length
                    ? "Every active student is already enrolled in this class."
                    : "Add students before enrolling them in a class."}
                </p>
              )}
            </div>
          </>
        )}
        {error && <div className="form-error">{error}</div>}
        <ModalActions
          close={close}
          saving={saving}
          label={
            selected.length
              ? `Enroll ${selected.length} student${selected.length === 1 ? "" : "s"}`
              : "Enroll students"
          }
        />
      </form>
    </>
  );
}

function ClassDetail({ classItem, version, close, setModal, refresh, notify }) {
  const { data: detail, error } = useLoad(
    () => api.classes.detail(classItem.class_id),
    [version],
  );
  const { data: students } = useLoad(() => api.students.list(), [version]);
  const [discounts, setDiscounts] = useState({});
  const [saving, setSaving] = useState(false);
  const [editingDiscount, setEditingDiscount] = useState(null);
  const [editValue, setEditValue] = useState("");
  const available = (students || []).filter(
    (student) =>
      student.status === "active" &&
      !detail?.enrollments.some(
        (e) => e.stid === student.stid && e.status === "active",
      ),
  );
  const [selected, setSelected] = useState([]);
  const feeFor = (discount) =>
    roundMoney(Number(classItem.fee) * (1 - Number(discount || 0) / 100));
  const shareFor = (discount, commission) =>
    roundMoney((feeFor(discount) * Number(commission || 0)) / 100);
  const saveEnrollments = async () => {
    setSaving(true);
    try {
      await api.classes.enroll({
        class_id: classItem.class_id,
        students: selected.map((stid) => ({
          stid,
          discount_percentage: Number(discounts[stid] || 0),
        })),
      });
      notify("Students enrolled in this class.");
      setSelected([]);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };
  const drop = async (enrollment) => {
    if (!window.confirm(`Remove ${enrollment.name} from this class?`)) return;
    try {
      await api.classes.dropEnrollment(enrollment.enrollment_id);
      notify("Student removed from class.");
      refresh();
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const saveDiscount = async (enrollment) => {
    setSaving(true);
    try {
      await api.classes.updateDiscount({
        enrollment_id: enrollment.enrollment_id,
        discount_percentage: Number(editValue),
      });
      notify(`Discount updated for ${enrollment.name}.`);
      setEditingDiscount(null);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ModalTitle
        eyebrow={classItem.subject || "CLASS ROSTER"}
        title={classItem.class_name}
        description={`${classItem.teacher_name} · ${money(classItem.fee)} per month · ${classItem.teacher_commission_percentage}% teacher share`}
        close={close}
      />
      {error && <div className="error-inline">{error}</div>}
      <div className="class-detail-content">
        <div className="roster-heading">
          <b>
            Enrolled students{" "}
            <span className="roster-count">
              {detail?.enrollments.filter((e) => e.status === "active")
                .length || 0}
            </span>
          </b>
          <button
            className="text-link"
            onClick={() => setModal({ type: "class-form", classItem })}
          >
            Edit class
          </button>
        </div>
        <div className="roster-list">
          {detail?.enrollments
            .filter((e) => e.status === "active")
            .map((enrollment) => (
              <div
                className="roster-row roster-discount-row"
                key={enrollment.enrollment_id}
              >
                <Avatar name={enrollment.name} />
                <div className="roster-name">
                  <b>{enrollment.name}</b>
                  <span>
                    {enrollment.discount_percentage}% discount · pays{" "}
                    {money(feeFor(enrollment.discount_percentage))} · teacher{" "}
                    {money(
                      shareFor(
                        enrollment.discount_percentage,
                        classItem.teacher_commission_percentage,
                      ),
                    )}{" "}
                    · centre{" "}
                    {money(
                      feeFor(enrollment.discount_percentage) -
                        shareFor(
                          enrollment.discount_percentage,
                          classItem.teacher_commission_percentage,
                        ),
                    )}
                  </span>
                  {editingDiscount === enrollment.enrollment_id && (
                    <div className="edit-discount">
                      <label>
                        Discount{" "}
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={editValue}
                          onChange={(event) => setEditValue(event.target.value)}
                        />
                        %
                      </label>
                      <b>
                        Student pays {money(feeFor(editValue))} · teacher{" "}
                        {money(
                          shareFor(
                            editValue,
                            classItem.teacher_commission_percentage,
                          ),
                        )}{" "}
                        · organization{" "}
                        {money(
                          feeFor(editValue) -
                            shareFor(
                              editValue,
                              classItem.teacher_commission_percentage,
                            ),
                        )}
                      </b>
                      <Button
                        kind="secondary"
                        onClick={() => saveDiscount(enrollment)}
                        disabled={saving}
                      >
                        {saving ? "Saving…" : "Save discount"}
                      </Button>
                    </div>
                  )}
                </div>
                <button
                  className="small-action"
                  onClick={() => {
                    setEditingDiscount(
                      editingDiscount === enrollment.enrollment_id
                        ? null
                        : enrollment.enrollment_id,
                    );
                    setEditValue(String(enrollment.discount_percentage));
                  }}
                >
                  {editingDiscount === enrollment.enrollment_id
                    ? "Cancel"
                    : "Edit discount"}
                </button>
                <button
                  className="icon-button"
                  title="Remove from class"
                  onClick={() => drop(enrollment)}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
        </div>
        {!detail?.enrollments.filter((e) => e.status === "active").length && (
          <p className="roster-empty">No students are enrolled yet.</p>
        )}
        <div className="enroll-box">
          <div className="enroll-box-heading">
            <div>
              <b>Enroll students</b>
              <span>
                Choose students below. No discount means they pay the full
                monthly fee.
              </span>
            </div>
            <span className="base-fee">Full fee {money(classItem.fee)}</span>
          </div>
          {available.length ? (
            <div className="enroll-options">
              {available.map((student) => {
                const discount = Number(discounts[student.stid] || 0);
                const fee = feeFor(discount);
                const teacher = shareFor(
                  discount,
                  classItem.teacher_commission_percentage,
                );
                return (
                  <div
                    className={`enroll-option ${selected.includes(student.stid) ? "enroll-option-selected" : ""}`}
                    key={student.stid}
                  >
                    <label className="enroll-choice">
                      <input
                        type="checkbox"
                        checked={selected.includes(student.stid)}
                        onChange={(event) =>
                          setSelected((ids) =>
                            event.target.checked
                              ? [...ids, student.stid]
                              : ids.filter((id) => id !== student.stid),
                          )
                        }
                      />
                      <span>{student.name}</span>
                    </label>
                    <div className="enroll-fee-editor">
                      <label>
                        <input
                          type="number"
                          aria-label={`Discount percentage for ${student.name}`}
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={discounts[student.stid] ?? ""}
                          onChange={(event) =>
                            setDiscounts({
                              ...discounts,
                              [student.stid]: event.target.value,
                            })
                          }
                        />
                        <span>% off</span>
                      </label>
                      <b className="enroll-fee-amount">{money(fee)}</b>
                    </div>
                    {selected.includes(student.stid) && (
                      <div className="enroll-split">
                        <span>
                          Teacher ({classItem.teacher_commission_percentage}%){" "}
                          <b>{money(teacher)}</b>
                        </span>
                        <span>
                          Organization <b>{money(fee - teacher)}</b>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="roster-empty">
              All active students are enrolled, or there are no students yet.
            </p>
          )}
          <Button
            onClick={saveEnrollments}
            disabled={!selected.length || saving}
          >
            {saving ? "Enrolling…" : `Enroll ${selected.length || ""} selected`}
          </Button>
        </div>
      </div>
    </>
  );
}

function StudentDetail({
  student: initial,
  version,
  close,
  setModal,
  refresh,
  notify,
}) {
  const [student, setStudent] = useState(initial);
  const [card, setCard] = useState("");
  const [error, setError] = useState("");
  const { data: enrollments } = useLoad(
    () => api.students.fees(student.stid),
    [student.stid, version],
  );
  const [selectedFees, setSelectedFees] = useState([]);
  const feeRows = (enrollments || [])
    .flatMap((enrollment) =>
      monthRange(enrollment.enrolled_date.slice(0, 7), thisMonth()).map(
        (month) => ({
          enrollment_id: enrollment.enrollment_id,
          month,
          paid: enrollment.paid_months.includes(month),
          class_name: enrollment.class_name,
          amount:
            Number(enrollment.fee) *
            (1 - Number(enrollment.discount_percentage) / 100),
        }),
      ),
    )
    .sort(
      (a, b) =>
        b.month.localeCompare(a.month) ||
        a.class_name.localeCompare(b.class_name),
    );
  const unpaidFees = feeRows.filter((row) => !row.paid);
  const assign = async () => {
    setError("");
    try {
      let result = await api.students.assignRfid({
        stid: student.stid,
        rfid: card,
      });
      if (result.conflict) {
        if (
          !window.confirm(
            `${result.conflict} already has this card. Reassign it?`,
          )
        )
          return;
        result = await api.students.assignRfid({
          stid: student.stid,
          rfid: card,
          reassign: true,
        });
      }
      if (result.success) {
        setStudent({ ...student, rfid: card });
        setCard("");
      }
    } catch (err) {
      setError(err.message);
    }
  };
  const remove = async () => {
    try {
      await api.students.removeRfid(student.stid);
      setStudent({ ...student, rfid: null });
    } catch (err) {
      setError(err.message);
    }
  };
  const paySelected = async () => {
    try {
      await api.students.payFees(
        selectedFees.map((key) => {
          const [enrollment_id, month] = key.split(":");
          return { enrollment_id: Number(enrollment_id), month };
        }),
      );
      notify("Selected tuition payments recorded.");
      setSelectedFees([]);
      refresh();
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const monthLabel = (month) =>
    new Date(`${month}-02`).toLocaleDateString(undefined, {
      month: "long",
      year: "numeric",
    });
  return (
    <>
      <ModalTitle
        eyebrow="STUDENT PROFILE"
        title={student.name}
        description={student.school || "Student details and class fees"}
        close={close}
      />
      <div className="student-detail">
        <div className="student-detail-top">
          <Avatar name={student.name} />
          <div>
            <b>{student.name}</b>
            <span>
              {student.contact1}
              {student.contact2 ? ` · ${student.contact2}` : ""}
            </span>
          </div>
          <button
            className="text-link"
            onClick={() => setModal({ type: "student-form", student })}
          >
            Edit details
          </button>
        </div>
        <div className="detail-summary">
          <div>
            <span>School</span>
            <b>{student.school || "Not added"}</b>
          </div>
          <div>
            <span>Date of birth</span>
            <b>{prettyDate(student.birthday)}</b>
          </div>
          <div>
            <span>Status</span>
            <Status value={student.status} />
          </div>
        </div>
        {student.address && (
          <div className="address-detail">
            <span>Home address</span>
            <p>{student.address}</p>
          </div>
        )}
        <div className="detail-section-title">
          <b>RFID attendance card</b>
          <span>Scan a card or type its number</span>
        </div>
        {error && <div className="form-error">{error}</div>}
        <div className="rfid-assign">
          {student.rfid ? (
            <>
              <span className="rfid-chip">
                <Activity size={12} />
                {student.rfid}
              </span>
              <button className="text-link danger-link" onClick={remove}>
                Remove card
              </button>
            </>
          ) : (
            <>
              <input
                value={card}
                onChange={(event) => setCard(event.target.value)}
                placeholder="Scan or enter card number"
                onKeyDown={(event) => event.key === "Enter" && assign()}
              />
              <Button kind="secondary" onClick={assign}>
                Assign card
              </Button>
            </>
          )}
        </div>
        <div className="detail-section-title fee-heading">
          <div>
            <b>Tuition payment history</b>
            <span>Unpaid class months since enrolment</span>
          </div>
          {unpaidFees.length > 0 && (
            <button
              className="text-link"
              onClick={() =>
                setSelectedFees(
                  selectedFees.length === unpaidFees.length
                    ? []
                    : unpaidFees.map(
                        (row) => `${row.enrollment_id}:${row.month}`,
                      ),
                )
              }
            >
              {selectedFees.length === unpaidFees.length
                ? "Clear selection"
                : "Select all unpaid"}
            </button>
          )}
        </div>
        {feeRows.length ? (
          <div className="student-fee-list">
            {feeRows.map((row) => {
              const key = `${row.enrollment_id}:${row.month}`;
              return (
                <label
                  className={`student-fee-row ${row.paid ? "fee-paid" : ""}`}
                  key={key}
                >
                  {!row.paid && (
                    <input
                      type="checkbox"
                      aria-label={`Select ${row.class_name}, ${monthLabel(row.month)}`}
                      checked={selectedFees.includes(key)}
                      onChange={(event) =>
                        setSelectedFees((keys) =>
                          event.target.checked
                            ? [...keys, key]
                            : keys.filter((item) => item !== key),
                        )
                      }
                    />
                  )}
                  <span className="fee-description">
                    <b>{row.class_name}</b>
                    <small>{monthLabel(row.month)}</small>
                  </span>
                  <b>
                    {row.paid ? (
                      <Status value="paid" />
                    ) : (
                      <span>{money(row.amount)}</span>
                    )}
                  </b>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="roster-empty">
            {enrollments?.length
              ? "No monthly fees due yet."
              : "No active class enrolments yet."}
          </p>
        )}
        <div className="student-profile-pay">
          <span>
            {selectedFees.length
              ? `${selectedFees.length} month${selectedFees.length === 1 ? "" : "s"} selected`
              : unpaidFees.length
                ? `${unpaidFees.length} unpaid month${unpaidFees.length === 1 ? "" : "s"}`
                : "All payments are up to date"}
          </span>
          <Button onClick={paySelected} disabled={!selectedFees.length}>
            <CreditCard size={15} />
            Record selected
          </Button>
        </div>
      </div>
    </>
  );
}

function SessionModal({ session, close, refresh, notify }) {
  const [rows, setRows] = useState(null);
  const [status, setStatus] = useState(session.status);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    const result = await api.sessions.attendance(session.session_id);
    setRows(result);
  }, [session.session_id]);
  useEffect(() => {
    load().catch((err) => notify(err.message, "error"));
  }, [load]);
  const start = async () => {
    setBusy(true);
    try {
      await api.sessions.start(session.session_id);
      setStatus("ongoing");
      await load();
      refresh();
      notify("Session started. The attendance register is ready.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const mark = async (row, next) => {
    try {
      await api.sessions.mark({
        session_id: session.session_id,
        stid: row.stid,
        status: next,
      });
      await load();
      return true;
    } catch (err) {
      notify(err.message, "error");
      return false;
    }
  };
  const scanCard = async () => {
    try {
      const student = await api.students.byRfid(query.trim());
      if (!student) {
        notify("No active student has that RFID card.", "error");
        return;
      }
      const attendee = (rows || []).find((row) => row.stid === student.stid);
      if (!attendee) {
        notify(`${student.name} is not enrolled in this class.`, "error");
        return;
      }
      if (status !== "ongoing") {
        notify(
          `${student.name} is on the register. Start the session to mark attendance.`,
        );
        return;
      }
      if (attendee.status !== "present" && (await mark(attendee, "present")))
        notify(`${student.name} marked present.`);
      setQuery("");
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const pay = async (row) => {
    try {
      await api.payments.pay({
        enrollment_ids: [row.enrollment_id],
        month: thisMonth(),
        session_id: session.session_id,
      });
      await load();
      refresh();
      notify(`Payment recorded for ${row.name}.`);
    } catch (err) {
      notify(err.message, "error");
    }
  };
  const end = async () => {
    if (
      !window.confirm(
        "End this session? Any students not yet marked will be recorded as absent.",
      )
    )
      return;
    setBusy(true);
    try {
      await api.sessions.end(session.session_id);
      setStatus("completed");
      await load();
      refresh();
      notify("Session complete. Unmarked students were recorded as absent.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setBusy(false);
    }
  };
  const filtered = (rows || []).filter((row) =>
    `${row.name} ${row.rfid || ""}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <ModalTitle
        eyebrow={prettyDate(session.session_date)}
        title={session.class_name}
        description={`${session.subject || "Class session"}${session.start_time ? ` · ${session.start_time}` : ""}${session.end_time ? `–${session.end_time}` : ""}`}
        close={close}
      />
      <div className="session-modal-content">
        {status === "scheduled" && (
          <div className="session-start-banner">
            <div className="session-start-icon">
              <CheckCheck size={19} />
            </div>
            <div>
              <b>Ready for roll call</b>
              <span>
                Starting the session opens the register for active students.
              </span>
            </div>
            <Button onClick={start} disabled={busy}>
              Start session
            </Button>
          </div>
        )}
        {status === "completed" && (
          <div className="session-complete-banner">
            <CheckCheck size={16} />
            This session is complete. The register is read-only.
          </div>
        )}
        <div className="session-roster-top">
          <div>
            <b>Attendance register</b>
            <span>
              {rows?.filter((row) => row.status === "present").length || 0} of{" "}
              {rows?.length || 0} present
            </span>
          </div>
          <div className="table-search">
            <Search size={15} />
            <input
              placeholder="Search name or scan RFID…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.key === "Enter" && scanCard()}
            />
          </div>
        </div>
        {rows?.length ? (
          <div className="session-roster">
            {filtered.map((row) => (
              <div className="session-student" key={row.stid}>
                <Avatar name={row.name} />
                <div className="session-student-name">
                  <b>{row.name}</b>
                  <span>
                    {row.rfid ? `Card ${row.rfid}` : "No card assigned"}
                  </span>
                </div>
                {status === "ongoing" ? (
                  <div className="attendance-controls">
                    <button
                      className={`attendance-mark ${row.status === "present" ? "mark-present" : ""}`}
                      onClick={() =>
                        mark(
                          row,
                          row.status === "present" ? "absent" : "present",
                        )
                      }
                      title={
                        row.status === "present"
                          ? "Mark absent"
                          : "Mark present"
                      }
                    >
                      <Check size={14} />
                      <span>
                        {row.status === "present"
                          ? "Present"
                          : row.status === "absent"
                            ? "Absent"
                            : "Mark present"}
                      </span>
                    </button>
                    {row.status === "present" && (
                      <button
                        className={`payment-quick ${row.payment_id ? "payment-done" : ""}`}
                        onClick={() => !row.payment_id && pay(row)}
                        title={
                          row.payment_id
                            ? "Paid this month"
                            : "Record monthly fee"
                        }
                      >
                        {row.payment_id ? (
                          <Check size={14} />
                        ) : (
                          <CreditCard size={14} />
                        )}
                        <span>
                          {row.payment_id
                            ? "Paid"
                            : money(
                                row.fee *
                                  (1 - (row.discount_percentage || 0) / 100),
                              )}
                        </span>
                      </button>
                    )}
                  </div>
                ) : (
                  <Status value={row.status} />
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="session-no-roster">
            <Users size={19} />
            <span>
              {status === "scheduled"
                ? "Start the session to prepare the attendance register."
                : "No active students are enrolled in this class."}
            </span>
          </div>
        )}
        {status === "ongoing" && (
          <div className="session-modal-footer">
            <span>
              Unmarked students are set to absent when you end the session.
            </span>
            <Button kind="secondary" onClick={end} disabled={busy}>
              End session <CheckCheck size={15} />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

function PayoutForm({ close, finish, notify }) {
  const { data: teachers } = useLoad(() => api.teachers.list(), []);
  const { data: classes } = useLoad(() => api.classes.list(), []);
  const [form, setForm] = useState({
    tid: "",
    amount: "",
    payout_date: today(),
    notes: "",
    details: [],
  });
  const [saving, setSaving] = useState(false);
  const ownClasses = (classes || []).filter(
    (item) => String(item.tid) === form.tid,
  );
  const change = (key) => (event) =>
    setForm({ ...form, [key]: event.target.value });
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.payouts.add({
        ...form,
        tid: Number(form.tid),
        amount: Number(form.amount),
        details: form.details,
      });
      notify("Teacher payout recorded.");
      finish();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <ModalTitle
        eyebrow="TEACHER PAYMENTS"
        title="Record a payout"
        description="Keep a clear record of the payments you make to teachers."
        close={close}
      />
      <form className="modal-form" onSubmit={submit}>
        <SelectField
          label="Teacher"
          required
          value={form.tid}
          onChange={change("tid")}
          options={[
            { value: "", label: "Choose a teacher" },
            ...(teachers || []).map((t) => ({
              value: String(t.tid),
              label: t.name,
            })),
          ]}
        />
        <div className="form-two">
          <Field
            label="Amount paid"
            required
            type="number"
            min="0.01"
            step="0.01"
            value={form.amount}
            onChange={change("amount")}
            placeholder="0.00"
          />
          <Field
            label="Payment date"
            required
            type="date"
            value={form.payout_date}
            onChange={change("payout_date")}
          />
        </div>
        {ownClasses.length > 0 && (
          <div className="payout-class-picker">
            <span className="field-label">
              Optional: which class / month does this cover?
            </span>
            {ownClasses.map((item) => {
              const existing = form.details.find(
                (d) => d.class_id === item.class_id,
              );
              return (
                <div className="payout-class-row" key={item.class_id}>
                  <label>
                    <input
                      type="checkbox"
                      checked={Boolean(existing)}
                      onChange={(event) =>
                        setForm({
                          ...form,
                          details: event.target.checked
                            ? [
                                ...form.details,
                                {
                                  class_id: item.class_id,
                                  amount_for_class: 0,
                                  for_month: thisMonth(),
                                },
                              ]
                            : form.details.filter(
                                (d) => d.class_id !== item.class_id,
                              ),
                        })
                      }
                    />
                    {item.class_name}
                  </label>
                  {existing && (
                    <>
                      <input
                        type="month"
                        aria-label={`Month for ${item.class_name}`}
                        value={existing.for_month}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            details: form.details.map((d) =>
                              d.class_id === item.class_id
                                ? { ...d, for_month: event.target.value }
                                : d,
                            ),
                          })
                        }
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        aria-label={`Payout amount for ${item.class_name}`}
                        placeholder="Amount"
                        value={existing.amount_for_class || ""}
                        onChange={(event) =>
                          setForm({
                            ...form,
                            details: form.details.map((d) =>
                              d.class_id === item.class_id
                                ? {
                                    ...d,
                                    amount_for_class: Number(
                                      event.target.value,
                                    ),
                                  }
                                : d,
                            ),
                          })
                        }
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
        <Field
          label="Notes"
          value={form.notes}
          onChange={change("notes")}
          placeholder="Optional payment reference"
        />
        <ModalActions close={close} saving={saving} label="Record payout" />
      </form>
    </>
  );
}
function HallForm({ hall, close, finish, notify }) {
  const [name, setName] = useState(hall?.name || "");
  const [capacity, setCapacity] = useState(hall?.capacity || "");
  const [availability, setAvailability] = useState(hall?.availability || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const setSlot = (index, key, value) =>
    setAvailability((slots) =>
      slots.map((slot, i) => (i === index ? { ...slot, [key]: value } : slot)),
    );
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.halls.save({
        hall_id: hall?.hall_id,
        name,
        capacity: capacity ? Number(capacity) : null,
        availability,
      });
      notify(
        hall
          ? "Hall availability updated."
          : "Hall added with weekly availability.",
      );
      finish();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };
  const remove = async () => {
    if (!window.confirm(`Delete ${hall.name}?`)) return;
    setSaving(true);
    try {
      await api.halls.delete(hall.hall_id);
      notify("Hall deleted.");
      finish();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };
  return (
    <>
      <ModalTitle
        eyebrow="ROOMS & TIMETABLES"
        title={hall ? "Edit hall availability" : "Add a hall"}
        description="Set when this room is open. Classes can only be scheduled during these times."
        close={close}
      />
      <form className="modal-form modal-form-scroll" onSubmit={submit}>
        <Field
          label="Hall name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="e.g. Main classroom"
        />
        <Field
          label="Seating capacity"
          type="number"
          min="1"
          step="1"
          value={capacity}
          onChange={(event) => setCapacity(event.target.value)}
          placeholder="Optional"
        />
        <div className="schedule-editor hall-availability-editor">
          <div className="schedule-heading">
            <div>
              <b>Weekly availability</b>
              <span>Add every day and time this hall is open.</span>
            </div>
            <button
              type="button"
              className="text-link"
              onClick={() =>
                setAvailability((slots) => [
                  ...slots,
                  {
                    day_of_week: "monday",
                    start_time: "09:00",
                    end_time: "12:00",
                  },
                ])
              }
            >
              <Plus size={14} /> Add time
            </button>
          </div>
          {availability.map((slot, index) => (
            <div className="schedule-row" key={slot.availability_id || index}>
              <select
                aria-label="Available day"
                value={slot.day_of_week}
                onChange={(event) =>
                  setSlot(index, "day_of_week", event.target.value)
                }
              >
                {weekdays.map((day) => (
                  <option value={day} key={day}>
                    {day[0].toUpperCase() + day.slice(1)}
                  </option>
                ))}
              </select>
              <input
                aria-label="Available from"
                type="time"
                value={slot.start_time}
                onChange={(event) =>
                  setSlot(index, "start_time", event.target.value)
                }
              />
              <span>to</span>
              <input
                aria-label="Available until"
                type="time"
                value={slot.end_time}
                onChange={(event) =>
                  setSlot(index, "end_time", event.target.value)
                }
              />
              <button
                type="button"
                className="icon-button"
                aria-label="Remove availability"
                onClick={() =>
                  setAvailability((slots) =>
                    slots.filter((_, i) => i !== index),
                  )
                }
              >
                <X size={16} />
              </button>
            </div>
          ))}
          {!availability.length && (
            <p className="roster-empty">
              No availability added yet. A hall needs available times before a
              class can use it.
            </p>
          )}
        </div>
        {hall?.class_count > 0 && (
          <div className="hall-assignment-note">
            <BookOpen size={15} />
            <span>
              This hall is assigned to {hall.class_count} class
              {hall.class_count === 1 ? "" : "es"}. Availability changes must
              continue to cover all their class times.
            </span>
          </div>
        )}
        {error && <div className="form-error">{error}</div>}
        <div className="modal-actions">
          {hall && (
            <button
              type="button"
              className="button button-danger-text"
              onClick={remove}
              disabled={saving}
            >
              Delete hall
            </button>
          )}
          <span className="action-spacer" />
          <Button kind="secondary" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : hall ? "Save hall" : "Add hall"}
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </>
  );
}
function PageJump({ page, close, navigate }) {
  useEffect(() => {
    navigate(page);
    close();
  }, []);
  return null;
}

export default App;
