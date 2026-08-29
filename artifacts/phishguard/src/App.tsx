import { useMemo, useState, useEffect, type FormEvent, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Code2,
  Eye,
  FileSearch,
  Fingerprint,
  Gauge,
  LayoutDashboard,
  Link2,
  ListFilter,
  LockKeyhole,
  LogOut,
  Menu,
  Monitor,
  Moon,
  Network,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Target,
  Timer,
  UserRound,
  X,
  Zap,
  Terminal,
  Cpu,
  Lock,
  Shield,
  AlertTriangle,
  AlertCircle,
  Info,
  ExternalLink,
  HelpCircle,
  Globe,
  Database,
  Bot,
  type LucideIcon,
} from 'lucide-react';
import {
  getGetCurrentUserQueryKey,
  getGetDashboardStatsQueryKey,
  getGetModelInfoQueryKey,
  getGetScanQueryKey,
  getHealthCheckQueryKey,
  getListScansQueryKey,
  useCreateScan,
  useGetCurrentUser,
  useGetDashboardStats,
  useGetModelInfo,
  useGetScan,
  useHealthCheck,
  useListScans,
  useLogin,
  useLogout,
  useSignup,
} from '@workspace/api-client-react';
import { Link, Route, Switch, useLocation, useParams } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import NotFound from '@/pages/not-found';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip } from 'recharts';

const queryClient = new QueryClient();

// Utility Formatting helpers
const fmtDate = (value?: string) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const fmtTime = (value?: string) => value ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
const pct = (value?: number) => `${Math.round((value ?? 0) * (value && value <= 1 ? 100 : 1))}%`;
const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const isPhishing = (verdict?: string) => verdict === 'phishing';

// Persistent Theme Hook
function useTheme() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') return saved;
    return 'light'; // Default to light mode (Warm Ivory) first
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  return [theme, setTheme] as const;
}

// Reusable custom UI components (Pinterest × Notion Aesthetic)
function Logo() {
  return (
    <Link href="/" data-testid="link-logo" className="focus-ring flex items-center gap-2 text-foreground">
      <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shadow-sm">
        <ShieldCheck size={18} strokeWidth={2.2} />
      </span>
      <span className="font-sans text-base font-bold tracking-tight text-neutral-900 dark:text-neutral-50">
        Phish<span className="text-primary font-semibold">Guard</span>
      </span>
    </Link>
  );
}

function Button({ children, variant = 'primary', className = '', type = 'button', onClick, disabled, testId = 'button-action' }: { children: ReactNode; variant?: 'primary' | 'soft' | 'outline' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean; testId?: string }) {
  const styles = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_4px_12px_rgba(89,133,171,0.1)] hover:shadow-[0_6px_16px_rgba(89,133,171,0.18)] border border-transparent',
    soft: 'bg-secondary text-secondary-foreground hover:bg-neutral-200/80 dark:hover:bg-neutral-800/80 border border-transparent',
    outline: 'border border-border bg-transparent text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800',
    ghost: 'text-muted-foreground hover:text-foreground hover:bg-neutral-100 dark:hover:bg-neutral-800/50 border border-transparent',
    danger: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_4px_12px_rgba(210,92,77,0.12)] border border-transparent',
  };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-xs font-bold uppercase tracking-wider transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-40 active:scale-95 ${styles[variant]} ${className}`}>{children}</button>;
}

function Card({ children, className = '', testId, onClick }: { children: ReactNode; className?: string; testId?: string; onClick?: () => void }) {
  return <div data-testid={testId} onClick={onClick} className={`rounded-3xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(0,0,0,0.02)] dark:hover:shadow-[0_12px_36px_rgba(0,0,0,0.15)] ${onClick ? 'cursor-pointer' : ''} ${className}`}>{children}</div>;
}

function StatusPill({ verdict }: { verdict?: string }) {
  const bad = isPhishing(verdict);
  const suspicious = verdict === 'suspicious';
  let styles = 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-950 dark:bg-emerald-950/20 dark:text-emerald-400';
  let label = 'Safe';
  
  if (bad) {
    styles = 'border-destructive/20 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/10 dark:text-red-400';
    label = 'Phishing';
  } else if (suspicious) {
    styles = 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-950 dark:bg-amber-950/20 dark:text-amber-400';
    label = 'Suspicious';
  }
  
  return <span data-testid={`status-verdict-${verdict ?? 'unknown'}`} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold border uppercase ${styles}`}>
    <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
    {label}
  </span>;
}

function LoadingState({ label = 'Querying cyber intelligence nodes' }: { label?: string }) {
  return <div className="space-y-4 py-12 text-center" data-testid="state-loading">
    <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary animate-pulse">
      <Bot size={20} className="animate-bounce" />
    </div>
    <p className="text-sm font-semibold text-muted-foreground">{label}…</p>
  </div>;
}

function ErrorState({ onRetry, label = 'We could not load this view.' }: { onRetry?: () => void; label?: string }) {
  return <Card className="border-destructive/25 p-10 text-center" testId="state-error">
    <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
      <AlertTriangle size={20} />
    </div>
    <h3 className="text-base font-bold text-neutral-900 dark:text-white">{label}</h3>
    <p className="mt-2 text-xs text-muted-foreground max-w-sm mx-auto">Check system settings or network connectivity. Scan records are preserved.</p>
    {onRetry && <Button variant="outline" onClick={onRetry} className="mt-6" testId="button-retry">Retry Node Connection</Button>}
  </Card>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <Card className="grid place-items-center p-12 text-center" testId="state-empty">
    <div className="mb-4 grid h-12 w-12 place-items-center bg-primary/10 text-primary rounded-2xl">
      <Radar size={22} />
    </div>
    <h3 className="text-base font-bold text-neutral-900 dark:text-white">{title}</h3>
    <p className="mt-2 max-w-sm text-xs text-muted-foreground">{copy}</p>
    {action && <div className="mt-6">{action}</div>}
  </Card>;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/scanner', label: 'Link Scanner', icon: Radar },
  { href: '/logs', label: 'Scan Logs', icon: Clock3 },
];

// Main Dashboard SideBar layout (Arc-like Left Panel)
function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [theme, setTheme] = useTheme();
  const userQuery = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const logout = useLogout();
  const user = userQuery.data;
  const signOut = () => logout.mutate(undefined, { onSuccess: () => setLocation('/') });

  return <div className="min-h-[100dvh] bg-background text-foreground grid-texture flex flex-col md:flex-row">
    {/* Sidebar navigation */}
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[260px] flex-col border-r border-border bg-card px-5 py-6 transition-transform duration-300 md:sticky md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between">
        <Logo />
        <button onClick={() => setMobileOpen(false)} className="text-muted-foreground hover:text-foreground md:hidden" data-testid="button-close-menu">
          <X size={18} />
        </button>
      </div>

      <div className="mt-10">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Core Platform</p>
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`} className={`focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-wider transition ${location === href ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60'}`}>
              <Icon size={16} />
              <span>{label}</span>
              {href === '/scanner' && <span className="ml-auto h-2 w-2 rounded-full bg-primary animate-pulse" />}
            </Link>
          ))}
        </nav>
      </div>

      <div className="mt-8">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Threat Intelligence</p>
        <nav className="space-y-1">
          <Link href="/model-info" data-testid="link-nav-model" className="focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60">
            <BarChart3 size={16} />
            <span>Model notes</span>
          </Link>
          <Link href="/extension-preview" data-testid="link-nav-extension" className="focus-ring flex items-center gap-3 rounded-2xl px-4 py-3 text-xs font-bold uppercase tracking-wider text-neutral-500 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800/60">
            <Monitor size={16} />
            <span>Browser helper</span>
          </Link>
        </nav>
      </div>

      <div className="mt-auto space-y-4">
        {/* Shields status banner */}
        <div className="rounded-2xl border border-border bg-background p-4 shadow-sm">
          <div className="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider">
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" /> 
            Shields active
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground font-sans">
            Explainable neural features mapping active on ports 5000 and 8000.
          </p>
        </div>

        {/* Profile Card */}
        <div className="flex items-center gap-3 border-t border-border pt-4">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-sm font-bold text-primary border border-primary/20">
            {user?.name?.slice(0, 1).toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-neutral-900 dark:text-neutral-100" data-testid="text-user-name">{user?.name ?? 'Analyst'}</p>
            <p className="truncate text-[10px] text-muted-foreground">{user?.email ?? 'Console session'}</p>
          </div>
          <button onClick={signOut} disabled={logout.isPending} className="text-muted-foreground hover:text-primary transition-colors" data-testid="button-logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>

    {mobileOpen && <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm md:hidden" data-testid="button-overlay-menu" />}

    {/* Main panel layout */}
    <div className="flex-1 flex flex-col min-w-0">
      {/* Sticky header */}
      <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md md:px-10">
        <div className="flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="rounded-xl p-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 md:hidden" data-testid="button-open-menu">
            <Menu size={20} />
          </button>
          <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            <span className="mono">SYS_READY // CLASSIFIER_ACTIVE //</span> 
            <span className="text-foreground uppercase font-bold tracking-wider">{location === '/dashboard' ? 'Overview' : location.replace('/', '').replace('-', ' ') || 'Home'}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/scanner" data-testid="link-header-scan" className="focus-ring inline-flex items-center gap-2 border border-border bg-card px-4 py-2 rounded-2xl text-xs font-bold text-foreground hover:border-primary/50 transition">
            <Radar size={14} className="text-primary" />
            <span>Investigate URL</span>
          </Link>
          {/* Quick theme toggle inside header */}
          <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="focus-ring grid h-9 w-9 place-items-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground">
            <Moon size={15} />
          </button>
          <Link href="/settings" data-testid="link-settings" className="focus-ring grid h-9 w-9 place-items-center rounded-2xl border border-border bg-card text-muted-foreground hover:text-foreground">
            <Settings2 size={15} />
          </Link>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1240px] px-6 py-8 flex-1">{children}</main>
    </div>
  </div>;
}

// Public header with scroll background effect
function PublicHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [theme, setTheme] = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return <header className={`fixed top-0 inset-x-0 z-30 transition-all duration-300 px-6 py-4 md:px-10 ${scrolled ? 'bg-white/80 dark:bg-neutral-900/80 backdrop-blur-md border-b border-border shadow-sm rounded-b-3xl' : 'bg-transparent'}`}>
    <div className="mx-auto flex max-w-6xl items-center justify-between">
      <Logo />
      
      <nav className="hidden items-center gap-8 text-xs font-bold uppercase tracking-wider text-muted-foreground md:flex">
        <Link href="/" className="hover:text-primary transition">Home</Link>
        <Link href="/#how" data-testid="link-how-it-works" className="hover:text-primary transition">How it works</Link>
        <Link href="/model-info" data-testid="link-public-model" className="hover:text-primary transition">Technology</Link>
        <Link href="/extension-preview" data-testid="link-public-extension" className="hover:text-primary transition">About</Link>
      </nav>

      <div className="flex items-center gap-3">
        <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} className="focus-ring grid h-8 w-8 place-items-center rounded-xl border border-border bg-card text-muted-foreground hover:text-foreground">
          <Moon size={14} />
        </button>
        <Link href="/login" data-testid="link-login" className="focus-ring rounded-2xl px-4 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-primary transition">Sign in</Link>
        <Link href="/signup" data-testid="link-signup-header" className="focus-ring rounded-2xl border border-primary/20 bg-primary/5 px-4.5 py-2.5 text-xs font-bold uppercase tracking-wider text-primary hover:bg-primary hover:text-white transition">Create account</Link>
      </div>
    </div>
  </header>;
}

function LandingPage() {
  const [, setLocation] = useLocation();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  const [demoUrl, setDemoUrl] = useState('https://accounts.example.com/sign-in');

  const trustBadges = [
    { label: "Hybrid AI Detection", icon: Sparkles },
    { label: "20 URL Features", icon: Network },
    { label: "Explainable Results", icon: Eye },
    { label: "70% ML + 30% Rules", icon: Gauge },
    { label: "FastAPI + Random Forest", icon: Cpu }
  ];

  return <div className="min-h-[100dvh] overflow-hidden bg-background text-foreground grid-texture pt-24">
    <PublicHeader />

    {/* Hero Section */}
    <section className="relative mx-auto max-w-6xl px-6 pb-24 pt-12 md:px-10 md:pb-32">
      {/* Subtle floating paper snippets / cards */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden hidden md:block">
        {/* Element 1: HTTPS Badge */}
        <div className="absolute top-10 left-[10%] p-3.5 bg-card border border-border rounded-2xl shadow-sm animate-float flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          <span className="text-emerald-500"><LockKeyhole size={14} /></span>
          <span>HTTPS: Encrypted</span>
        </div>
        {/* Element 2: URL length */}
        <div className="absolute top-[35%] right-[5%] p-3 bg-card border border-border rounded-xl shadow-sm animate-float-delayed flex items-center gap-2 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          <span className="text-primary"><Cpu size={14} /></span>
          <span>20 Neural Features</span>
        </div>
        {/* Element 3: Impersonation badge */}
        <div className="absolute bottom-[20%] left-[8%] p-3.5 bg-card border border-border rounded-2xl shadow-sm animate-float-slow flex items-center gap-3 text-xs font-semibold text-neutral-800 dark:text-neutral-200">
          <span className="w-6 h-6 rounded-full bg-destructive/15 text-destructive flex items-center justify-center font-bold text-[10px]">96</span>
          <span>Phishing Risk score</span>
        </div>
      </div>

      <div className="relative flex flex-col items-center text-center max-w-3xl mx-auto z-10">
        <div className="mb-6 inline-flex items-center gap-2 border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-bold text-primary uppercase tracking-widest rounded-full">
          <Cpu size={12} /> Explainable Threat Intelligence Console
        </div>
        
        {/* Hero headline */}
        <h1 className="text-4xl font-extrabold leading-[1.1] tracking-tight sm:text-5xl md:text-6xl text-neutral-900 dark:text-white">
          Is this link <span className="text-primary font-bold">really safe?</span>
        </h1>
        
        {/* Subheading */}
        <p className="mt-6 text-base md:text-lg leading-relaxed text-muted-foreground max-w-2xl">
          Analyze suspicious URLs using machine learning and real security heuristics with explainable hybrid risk scoring.
        </p>

        {/* Oversized search component centerpiece */}
        <div className="mt-10 w-full max-w-2xl bg-card border border-border p-2 rounded-3xl shadow-lg hover:shadow-xl hover:border-primary/30 transition-all duration-300">
          <div className="flex flex-col sm:flex-row items-center gap-2">
            <Link2 size={18} className="ml-3 shrink-0 text-muted-foreground hidden sm:block" />
            <input 
              value={demoUrl} 
              onChange={e => setDemoUrl(e.target.value)} 
              data-testid="input-landing-url" 
              className="w-full bg-transparent px-3 py-3.5 text-sm outline-none text-foreground font-sans placeholder:text-muted-foreground" 
              placeholder="https://example.com" 
            />
            <Button 
              onClick={() => setLocation(`/scanner?url=${encodeURIComponent(demoUrl)}`)} 
              className="w-full sm:w-auto shrink-0 px-6 py-3.5 rounded-2xl font-bold uppercase tracking-wider" 
              testId="button-analyze-landing"
            >
              Analyze
            </Button>
          </div>
        </div>

        {/* Trust Badges */}
        <div className="mt-12 flex flex-wrap justify-center gap-3">
          {trustBadges.map(({ label, icon: Icon }) => (
            <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-neutral-700 dark:text-neutral-300 shadow-sm">
              <Icon size={13} className="text-primary" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>

    {/* Live Preview Section (Visual Mockup of the scanning results UI only) */}
    <section className="border-t border-border bg-secondary/30 py-20 px-6 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-12">
          <p className="text-[11px] font-bold text-primary tracking-widest uppercase mb-2">Visualizer Sandbox</p>
          <h2 className="text-2xl font-bold text-neutral-900 dark:text-white">Proactive Security Telemetry</h2>
          <p className="mt-2 text-sm text-muted-foreground">Examine structural indicators before executing dangerous code in your browser.</p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr] items-start">
          {/* Left illustration: URL parsing diagram */}
          <Card className="p-6 md:p-8 flex flex-col justify-between h-full bg-card">
            <div>
              <div className="flex items-center gap-2 mb-4 border-b border-border pb-3">
                <span className="h-2 w-2 rounded-full bg-primary" />
                <h3 className="text-sm font-bold uppercase text-neutral-800 dark:text-neutral-200">URL Anatomy Extraction</h3>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-neutral-50 dark:bg-neutral-950 rounded-2xl border border-border font-mono text-sm leading-relaxed break-all">
                  <span className="text-emerald-600 font-bold">https://</span>
                  <span className="text-amber-600 font-bold">security-login.</span>
                  <span className="text-rose-600 font-bold">amazon-account.</span>
                  <span className="text-neutral-400">update.xyz/verify</span>
                </div>

                <div className="grid gap-2 text-xs">
                  <div className="flex items-center justify-between border-b border-border/60 py-2">
                    <span className="font-semibold text-neutral-500">Actual Domain Target</span>
                    <span className="text-rose-600 font-bold font-mono">update.xyz</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-border/60 py-2">
                    <span className="font-semibold text-neutral-500">Impersonation Target</span>
                    <span className="text-amber-600 font-bold font-mono">amazon.com</span>
                  </div>
                  <div className="flex items-center justify-between py-2">
                    <span className="font-semibold text-neutral-500">Lexical Flags Identified</span>
                    <span className="text-neutral-800 dark:text-neutral-100 font-bold">4 Active Signals</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="mt-8 pt-4 border-t border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-mono">SYSTEM_NODE: ACTIVE</span>
              <Button onClick={() => setLocation('/scanner')} variant="outline" className="px-4 py-2" testId="button-start-scanning">
                Open Sandbox <ArrowRight size={13} />
              </Button>
            </div>
          </Card>

          {/* Right layout: Pinterest Stack Cards mockup */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-4">
              <Card className="p-5 flex flex-col justify-between bg-card">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">ML Confidence</p>
                <h4 className="mt-4 text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">96.8%</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">Calibrated model risk prediction certainty bounds.</p>
              </Card>

              <Card className="p-5 flex flex-col justify-between bg-card">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">HTTPS Status</p>
                <div className="mt-4 flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold">
                  <LockKeyhole size={18} />
                  <span className="text-base uppercase tracking-wider">SSL Secure</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">Encrypted payload mapping active on standard ports.</p>
              </Card>

              <Card className="p-5 flex flex-col justify-between bg-card border-l-4 border-l-destructive">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Risk Score</p>
                <h4 className="mt-4 text-3xl font-extrabold text-destructive tracking-tight">88/100</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">Aggregated threat indicator score rating.</p>
              </Card>
            </div>

            <div className="space-y-4">
              <Card className="p-5 flex flex-col justify-between bg-card border-l-4 border-l-amber-500">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Suspicious Flags</p>
                <h4 className="mt-4 text-3xl font-extrabold text-amber-500 tracking-tight">4 Signals</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">Lookalike domain keywords combined with subdomains.</p>
              </Card>

              <Card className="p-5 flex flex-col justify-between bg-card">
                <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest">Domain Registry</p>
                <h4 className="mt-4 text-sm font-bold text-neutral-800 dark:text-neutral-200 font-mono truncate">unauthorized-host.xyz</h4>
                <p className="mt-1 text-xs text-muted-foreground leading-relaxed">Actual domain registration origin resolves safely.</p>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </section>

    {/* How It Works Section */}
    <section id="how" className="border-t border-border bg-card py-24 px-6 md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <p className="text-[11px] font-bold text-primary tracking-widest uppercase mb-2">Detection Pipeline</p>
          <h2 className="text-3xl font-bold tracking-tight text-neutral-900 dark:text-white">How PhishGuard Works</h2>
          <p className="mt-3 text-sm text-muted-foreground max-w-xl mx-auto">A hybrid classification engine combining calibrated machine learning constraints with deterministic rules.</p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Block 1 */}
          <Card className="p-6 flex flex-col justify-between h-full bg-secondary/20">
            <div>
              <span className="text-xs font-bold text-primary font-mono tracking-widest">STAGE 01</span>
              <h3 className="mt-4 text-base font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Feature Extraction</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">The engine splits raw URL strings into lexical features, scanning domain, subdomain, path, query segments, and special character ratios.</p>
            </div>
            <div className="mt-6 border-t border-border/60 pt-4 flex gap-1 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-card text-[9px] font-bold font-mono">Domain</span>
              <span className="px-2 py-0.5 rounded bg-card text-[9px] font-bold font-mono">Subdomain</span>
              <span className="px-2 py-0.5 rounded bg-card text-[9px] font-bold font-mono">Path</span>
              <span className="px-2 py-0.5 rounded bg-card text-[9px] font-bold font-mono">Length</span>
            </div>
          </Card>

          {/* Block 2 */}
          <Card className="p-6 flex flex-col justify-between h-full bg-secondary/20">
            <div>
              <span className="text-xs font-bold text-primary font-mono tracking-widest">STAGE 02</span>
              <h3 className="mt-4 text-base font-bold text-neutral-900 dark:text-white uppercase tracking-wider">ML Classification</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">A calibrated Random Forest classifier processes the 20 lexical features, producing probability estimations scaling threat risk prediction.</p>
            </div>
            <div className="mt-6 border-t border-border/60 pt-4 font-mono text-[10px] text-muted-foreground space-y-1">
              <div>&gt; Platt Scaling Probability</div>
              <div>&gt; Calibrated RF Model</div>
            </div>
          </Card>

          {/* Block 3 */}
          <Card className="p-6 flex flex-col justify-between h-full bg-secondary/20">
            <div>
              <span className="text-xs font-bold text-primary font-mono tracking-widest">STAGE 03</span>
              <h3 className="mt-4 text-base font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Heuristics Engine</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Deterministic filters check for known lookalike patterns, IP host shortcuts, suspicious TLDs, missing HTTPS encryption, and obscured URL shorteners.</p>
            </div>
            <div className="mt-6 border-t border-border/60 pt-4 flex gap-1 flex-wrap">
              <span className="px-2 py-0.5 rounded bg-card text-[9px] font-bold text-destructive font-mono">No HTTPS</span>
              <span className="px-2 py-0.5 rounded bg-card text-[9px] font-bold text-destructive font-mono">@ Separator</span>
              <span className="px-2 py-0.5 rounded bg-card text-[9px] font-bold text-destructive font-mono">IP Domain</span>
            </div>
          </Card>

          {/* Block 4 */}
          <Card className="p-6 flex flex-col justify-between h-full bg-secondary/20">
            <div>
              <span className="text-xs font-bold text-primary font-mono tracking-widest">STAGE 04</span>
              <h3 className="mt-4 text-base font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Hybrid Score Fusion</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Risk scores merge using a weighted distribution model combining 70% Machine Learning probability and 30% Heuristic triggers for explainable scoring.</p>
            </div>
            <div className="mt-6 border-t border-border/60 pt-4 flex items-center justify-between">
              <div className="flex gap-2 text-[10px] font-bold text-neutral-600 dark:text-neutral-300">
                <span>70% ML</span>
                <span>•</span>
                <span>30% Rules</span>
              </div>
              <ArrowRight size={13} className="text-primary animate-pulse" />
            </div>
          </Card>
        </div>
      </div>
    </section>

    {/* Footer */}
    <footer className="border-t border-border bg-secondary/40 py-12 px-6 md:px-10">
      <div className="mx-auto max-w-6xl flex flex-col sm:flex-row justify-between items-center gap-6">
        <Logo />
        <div className="flex flex-col sm:items-end text-center sm:text-right text-[10px] text-muted-foreground font-mono space-y-1">
          <span>PHISHGUARD SECURE CONSOLE v{FEATURE_SCHEMA.version}</span>
          <span>© {new Date().getFullYear()} PhishGuard. Safe detection is not a guarantee.</span>
        </div>
      </div>
    </footer>
  </div>;
}

function FeatureTile({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return <div className="rounded-3xl border border-border bg-card p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm"><Icon size={20} className="text-primary" /><h3 className="mt-5 text-sm font-bold text-neutral-900 dark:text-neutral-100 uppercase tracking-wider">{title}</h3><p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">{copy}</p></div>;
}

function AuthLayout({ children, eyebrow, title, copy }: { children: ReactNode; eyebrow: string; title: string; copy: string }) {
  return <div className="grid min-h-[100dvh] bg-background lg:grid-cols-[.45fr_.55fr] text-foreground">
    <div className="relative hidden overflow-hidden bg-secondary/40 border-r border-border p-10 lg:flex lg:flex-col justify-between">
      <Logo />
      <div className="relative z-10 max-w-md pb-6">
        <div className="mb-5 grid h-12 w-12 place-items-center bg-primary/10 text-primary border border-primary/20 rounded-2xl">
          <ShieldCheck size={22} />
        </div>
        <p className="mono text-[10px] uppercase tracking-widest text-primary font-bold">Threat intelligence network</p>
        <h2 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight text-neutral-900 dark:text-white">Understand threat profiles before execution.</h2>
        <p className="mt-4 text-xs leading-relaxed text-muted-foreground">PhishGuard parses lookalike characters, digits ratios, and TLD flags to present clean evidence reports.</p>
      </div>
    </div>
    <div className="flex items-center justify-center p-6 md:p-12 bg-background">
      <div className="w-full max-w-[380px]">
        <div className="mb-10 lg:hidden flex justify-center">
          <Logo />
        </div>
        <p className="mono text-[10px] uppercase tracking-widest text-primary font-bold">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white">{title}</h1>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{copy}</p>
        <div className="mt-8 border border-border bg-card p-6 rounded-3xl shadow-sm">{children}</div>
      </div>
    </div>
  </div>;
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); login.mutate({ data: { email, password } }, { onSuccess: () => setLocation('/dashboard') }); };
  return <AuthLayout eyebrow="System login" title="Verify Credentials" copy="Log in to authenticate dashboard metrics and query limits."><form onSubmit={submit} className="space-y-4"><Field label="Email address" value={email} onChange={setEmail} type="email" placeholder="analyst@phishguard.net" testId="input-email" /><Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" testId="input-password" /><div className="flex justify-end"><Link href="/forgot-password" data-testid="link-forgot-password" className="mono text-[10px] text-primary hover:underline font-bold uppercase tracking-wider">Forgot password?</Link></div>{login.isError && <p className="mono border border-destructive/30 bg-destructive/10 px-3 py-2 text-[10px] font-semibold text-destructive rounded-xl" data-testid="status-login-error">AUTH_FAILED: Invalid security credentials.</p>}<Button type="submit" disabled={login.isPending} className="mt-2 w-full" testId="button-submit-login">{login.isPending ? 'Authenticating…' : 'Sign in'} <ArrowRight size={14} /></Button></form><p className="mt-6 text-center text-xs text-muted-foreground">Need console credentials? <Link href="/signup" data-testid="link-create-account" className="font-bold text-primary hover:underline uppercase tracking-wider">Request account</Link></p></AuthLayout>;
}

function SignupPage() {
  const [, setLocation] = useLocation();
  const signup = useSignup();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); signup.mutate({ data: { name, email, password } }, { onSuccess: () => setLocation('/dashboard') }); };
  return <AuthLayout eyebrow="System registration" title="Request Credentials" copy="Create a private security workspace to track URLs and configure detection filters."><form onSubmit={submit} className="space-y-4"><Field label="Analyst name" value={name} onChange={setName} placeholder="Security Analyst" testId="input-name" /><Field label="Email address" value={email} onChange={setEmail} type="email" placeholder="you@phishguard.net" testId="input-signup-email" /><Field label="Console password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" testId="input-signup-password" />{signup.isError && <p className="mono border border-destructive/30 bg-destructive/10 px-3 py-2 text-[10px] font-semibold text-destructive rounded-xl" data-testid="status-signup-error">SIGNUP_FAILED: Invalid email configuration.</p>}<Button type="submit" disabled={signup.isPending} className="mt-2 w-full" testId="button-submit-signup">{signup.isPending ? 'Provisioning account…' : 'Create account'} <ArrowRight size={14} /></Button></form><p className="mt-6 text-center text-xs text-muted-foreground">Already registered? <Link href="/login" data-testid="link-existing-account" className="font-bold text-primary hover:underline uppercase tracking-wider">Sign in</Link></p></AuthLayout>;
}

function Field({ label, value, onChange, placeholder, type = 'text', testId }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; testId: string }) {
  return <label className="block"><span className="mb-2 block mono text-[10px] uppercase text-neutral-500 font-bold tracking-wider">{label}</span><input required type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} className="focus-ring h-11 w-full rounded-2xl border border-border bg-secondary/50 px-4 text-sm outline-none text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50" /></label>;
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <div className="mb-8 flex flex-col justify-between gap-4 border-b border-border pb-6 md:flex-row md:items-end"><div><p className="mono text-[10px] font-bold uppercase tracking-widest text-primary">{eyebrow}</p><h1 className="mt-2 text-2xl font-bold tracking-tight text-neutral-900 dark:text-white uppercase">{title}</h1><p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">{copy}</p></div>{action}</div>;
}

function Metric({ label, value, note, icon: Icon, tone = 'primary' }: { label: string; value: string | number; note: string; icon: LucideIcon; tone?: 'primary' | 'amber' | 'red' }) {
  const color = tone === 'red' ? 'text-destructive border-destructive/20 bg-destructive/10' : tone === 'amber' ? 'text-amber-600 border-amber-500/25 bg-amber-500/10 dark:text-amber-400' : 'text-primary border-primary/20 bg-primary/10';
  return <Card className="p-5 flex flex-col justify-between" testId={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="mono text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{label}</p>
        <p className="font-sans mt-3 text-3xl font-extrabold text-neutral-900 dark:text-white tracking-tight">{value}</p>
      </div>
      <div className={`grid h-9 w-9 place-items-center rounded-xl border ${color}`}>
        <Icon size={16} />
      </div>
    </div>
    <p className="mt-4 text-[10px] text-neutral-400 dark:text-neutral-500 font-mono tracking-wider">{note}</p>
  </Card>;
}

function ScanRow({ scan }: { scan: any }) {
  const bad = isPhishing(scan.verdict);
  return <Link href={`/features/${scan.id}`} data-testid={`link-scan-${scan.id}`} className="group flex items-center gap-4 border-b border-border/60 px-5 py-4 transition last:border-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/40">
    <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border ${bad ? 'border-destructive/20 bg-destructive/10 text-destructive' : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
      {bad ? <ShieldAlert size={16} /> : <CheckCircle2 size={16} />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-sm font-semibold text-neutral-800 dark:text-neutral-200 font-mono">{shortUrl(scan.url)}</p>
      <p className="mt-1 text-[10px] text-muted-foreground font-mono uppercase tracking-wider">{fmtDate(scan.createdAt)} @ {fmtTime(scan.createdAt)}</p>
    </div>
    <div className="hidden text-right sm:block">
      <StatusPill verdict={scan.verdict} />
      <p className="mono mt-1 text-[10px] text-muted-foreground tracking-wider">{Math.round(scan.confidence)}% calibrated confidence</p>
    </div>
    <ChevronRight size={16} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
  </Link>;
}

function DashboardPage() {
  const [, setLocation] = useLocation();
  const stats = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey(), retry: 1 } });
  const data = stats.data;
  return <><PageHeading eyebrow="Threat intelligence center" title="Active Scan Monitor" copy="Telemetry statistics compiled dynamically from rules evaluation and Random Forest checks." action={<Button onClick={() => setLocation('/scanner')} testId="button-dashboard-scan"><Radar size={14} /> Analyze URL</Button>} />{stats.isLoading ? <LoadingState /> : stats.isError ? <ErrorState onRetry={() => stats.refetch()} /> : data ? <><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Links Checked" value={data.totalScanned} note="Aggregate workspace inputs" icon={Activity} /><Metric label="Phishing Signals" value={data.maliciousDetected} note={`${pct(data.phishingPercent)} detected`} icon={ShieldAlert} tone="red" /><Metric label="Safe Verdicts" value={data.safeUrls} note={`${pct(data.safePercent)} safe links`} icon={CheckCircle2} /><Metric label="Model Accuracy" value={pct(data.modelAccuracy)} note="Dynamic test-set verification" icon={Gauge} tone="amber" /></div><div className="mt-8 grid gap-6 xl:grid-cols-[1.24fr_.76fr]"><Card className="overflow-hidden p-0 bg-card"><div className="flex items-center justify-between border-b border-border px-6 py-4.5 bg-secondary/10"><div><h2 className="mono text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Telemetry Scan Logs</h2></div><Link href="/logs" data-testid="link-view-all-scans" className="mono text-[10px] font-bold text-primary uppercase tracking-widest hover:underline">View telemetry</Link></div>{data.recentScans?.length ? data.recentScans.map((scan: any) => <ScanRow key={scan.id} scan={scan} />) : <div className="p-8"><EmptyState title="Telemetry logs empty" copy="Run a security query to populate this monitor." action={<Button onClick={() => setLocation('/scanner')} testId="button-empty-scan">Inspect a URL</Button>} /></div>}</Card><Card className="overflow-hidden bg-card p-6 flex flex-col justify-between"><div className="border-b border-border pb-4 mb-6"><h2 className="mono text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Scanned URLs distribution</h2></div><div className="flex flex-col items-center flex-1 justify-center"><div className="relative mx-auto grid h-40 w-40 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) 0 ${data.safePercent * 100}%, hsl(var(--destructive)) ${data.safePercent * 100}% 100%)` }}><div className="grid h-32 w-32 place-items-center rounded-full bg-card text-center shadow-inner"><div><span className="font-sans text-3xl font-extrabold tracking-tight text-foreground">{pct(data.safePercent)}</span><span className="block text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Legitimate</span></div></div></div><div className="mt-8 w-full space-y-3.5 text-xs font-semibold"><div className="flex justify-between items-center"><span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300"><span className="h-2 w-2 rounded-full bg-primary" /> Legitimate / Safe</span><strong>{pct(data.safePercent)}</strong></div><div className="flex justify-between items-center"><span className="flex items-center gap-2.5 text-neutral-600 dark:text-neutral-300"><span className="h-2 w-2 rounded-full bg-destructive" /> Dangerous / Phishing</span><strong>{pct(data.phishingPercent)}</strong></div></div></div></Card></div></> : <EmptyState title="Monitor unit inactive" copy="Please run an investigation to initialize." />}</>;
}

function ScannerPage() {
  const [, setLocation] = useLocation();
  const create = useCreateScan();
  const [url, setUrl] = useState(() => new URLSearchParams(window.location.search).get('url') ?? '');
  
  // Cinematic progressive scan state machine variables
  const [scanning, setScanning] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [pendingResult, setPendingResult] = useState<any>(null);
  
  const steps = [
    "Scanning URL...",
    "Extracting Features...",
    "Running ML Model...",
    "Checking Security Rules...",
    "Combining Risk Score..."
  ];
  
  const startScan = (e?: FormEvent) => {
    e?.preventDefault();
    if (!url.trim()) return;
    setScanning(true);
    setCurrentStep(0);
    setPendingResult(null);
    
    // Call the backend API immediately
    create.mutate({ data: { url: url.trim() } }, {
      onSuccess: scan => {
        setPendingResult(scan);
      }
    });
    
    // Trigger cinematic step intervals (~150ms per step)
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step < steps.length) {
        setCurrentStep(step);
      } else {
        clearInterval(timer);
        setScanning(false);
      }
    }, 180);
  };

  const useExample = (kind: 'safe' | 'phishing') => { 
    const val = kind === 'safe' ? 'https://www.nationalgeographic.com/' : 'https://secure-account-verification.example.net/login';
    setUrl(val); 
    setPendingResult(null);
    // Automatically trigger scan for ease of demo
    setScanning(true);
    setCurrentStep(0);
    create.mutate({ data: { url: val } }, {
      onSuccess: scan => setPendingResult(scan)
    });
    
    let step = 0;
    const timer = setInterval(() => {
      step++;
      if (step < steps.length) {
        setCurrentStep(step);
      } else {
        clearInterval(timer);
        setScanning(false);
      }
    }, 180);
  };

  return <><PageHeading eyebrow="Cyber investigation console" title="Signal Core Threat Analyzer" copy="Input a domain or URL below to trace characteristics, evaluate ML weights, and inspect security rules." /><div className="grid gap-8 xl:grid-cols-[.82fr_1.18fr]"><Card className="p-6 h-fit bg-card"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center bg-primary/10 text-primary border border-primary/20 rounded-2xl"><Radar size={18} /></div><div><h2 className="mono text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Inspect Threat Vector</h2></div></div><form onSubmit={startScan} className="mt-8"><label className="mono text-[10px] uppercase tracking-widest text-neutral-500 font-bold">Suspicious URL</label><div className="mt-2.5 flex items-center gap-2 border border-border bg-secondary/40 p-2 rounded-2xl"><Link2 size={16} className="ml-2 shrink-0 text-muted-foreground" /><input required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example-security-update.com/login" data-testid="input-scan-url" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none text-foreground placeholder:text-muted-foreground/60" /><Button type="submit" disabled={create.isPending || scanning} className="shrink-0 rounded-xl" testId="button-submit-scan">Run scan</Button></div></form>{create.isError && <div className="mono mt-4 border border-destructive/30 bg-destructive/10 p-3.5 text-[11px] leading-relaxed text-destructive rounded-2xl" data-testid="status-scan-error"><strong>SCAN_CRITICAL: Telemetry aborted.</strong> Verify the URL structure contains a valid hostname and try again.</div>}<div className="mt-8 border-t border-border pt-6"><p className="mono text-[11px] font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest">Preset Telemetry Vectors</p><p className="mt-1.5 text-xs text-muted-foreground">Run preset URLs to test calibrated outputs.</p><div className="mt-4 grid gap-3"><button onClick={() => useExample('safe')} data-testid="button-example-safe" className="focus-ring flex items-center justify-between border border-border bg-secondary/20 px-4 py-3 rounded-2xl hover:border-primary/30 hover:bg-secondary/45 transition"><span className="flex items-center gap-2.5 text-xs font-bold text-neutral-700 dark:text-neutral-300"><CheckCircle2 size={15} className="text-primary" /> Legitimate brand vector</span><ChevronRight size={14} className="text-muted-foreground" /></button><button onClick={() => useExample('phishing')} data-testid="button-example-phishing" className="focus-ring flex items-center justify-between border border-border bg-secondary/20 px-4 py-3 rounded-2xl hover:border-destructive/30 hover:bg-secondary/45 transition"><span className="flex items-center gap-2.5 text-xs font-bold text-destructive"><ShieldAlert size={15} /> Suspicious brand lookalike</span><ChevronRight size={14} className="text-muted-foreground" /></button></div></div></Card><div>{scanning ? <Card className="p-8 border-primary/20 bg-primary/5"><div className="space-y-6"><div className="flex justify-between items-center"><span className="text-xs font-bold text-primary tracking-widest uppercase">ANALYSIS PIPELINE RUNNING</span><span className="text-[10px] text-muted-foreground font-mono uppercase">{currentStep + 1} / {steps.length}</span></div><div className="h-1.5 w-full bg-neutral-200 dark:bg-neutral-800 rounded-full overflow-hidden"><div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} /></div><div className="flex items-center gap-3"><div className="h-4.5 w-4.5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" /><p className="font-sans text-base font-bold text-foreground tracking-tight">{steps[currentStep]}</p></div><div className="mono text-[10px] text-muted-foreground space-y-2 border-t border-border pt-4">{steps.slice(0, currentStep).map((s, i) => <div key={i} className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-2"><span>✓</span> {s} ... COMPLETED</div>)}</div></div></Card> : pendingResult ? <ResultCard scan={pendingResult} onDetails={() => setLocation(`/features/${pendingResult.id}`)} /> : <Card className="grid min-h-[410px] place-items-center p-8 text-center border-dashed border-border"><div className="max-w-xs"><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary border border-primary/25"><ShieldCheck size={24} strokeWidth={1.8} /></div><h2 className="mt-5 text-base font-bold tracking-tight text-neutral-900 dark:text-white uppercase tracking-wider">Ready for Analysis</h2><p className="mt-2 text-xs text-muted-foreground leading-relaxed">Paste a suspicious URL vector and trigger the scanner to map threat characteristics.</p></div></Card>}</div></div></>;
}

function ResultCard({ scan, onDetails }: { scan: any; onDetails: () => void }) {
  const bad = isPhishing(scan.verdict); 
  const confidence = Math.round(scan.confidence * (scan.confidence <= 1 ? 100 : 1)); 
  const risk = Math.round(scan.riskScore);
  
  // SVG dial configurations
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (risk / 100) * circumference;
  const indicatorColor = bad ? "stroke-destructive" : "stroke-emerald-500";
  const indicatorBg = bad ? "stroke-destructive/15" : "stroke-emerald-500/15";
  
  return <Card className={`overflow-hidden border-t-4 p-0 ${bad ? 'border-t-destructive' : 'border-t-emerald-500'}`} testId="card-scan-result">
    <div className="p-6 md:p-8 bg-secondary/15 flex flex-col md:flex-row gap-6 items-center">
      {/* SVG radial threat score gauge */}
      <div className="relative h-28 w-28 flex-shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} className={`fill-none stroke-[8] ${indicatorBg}`} />
          <circle cx="60" cy="60" r={radius} className={`fill-none stroke-[8] ${indicatorColor} transition-all duration-700`} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="round" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="font-sans text-3xl font-extrabold text-neutral-900 dark:text-white leading-none">{risk}</span>
          <span className="mono text-[9px] text-muted-foreground uppercase mt-1.5 font-bold tracking-widest">Risk</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 text-center md:text-left">
        <StatusPill verdict={scan.verdict} />
        <h2 className="mt-4 text-xl font-bold text-neutral-950 dark:text-white tracking-tight leading-snug">{bad ? 'Phishing threat signatures detected.' : 'Minimal threat vector signature.'}</h2>
        <p className="mono mt-2.5 break-all text-[11px] text-muted-foreground">{scan.url}</p>
      </div>
    </div>
    
    <div className="grid gap-5 p-6 sm:grid-cols-2 bg-card border-t border-border">
      <div>
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-muted-foreground uppercase tracking-wider">Confidence (ML Calibrated)</span>
          <strong className="text-primary">{confidence}%</strong>
        </div>
        <div className="mt-2.5 h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${confidence}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-muted-foreground uppercase tracking-wider">Multi-Engine Risk Rating</span>
          <strong className={bad ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}>{risk}/100</strong>
        </div>
        <div className="mt-2.5 h-2 bg-secondary rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${bad ? 'bg-destructive' : 'bg-emerald-500'}`} style={{ width: `${risk}%` }} />
        </div>
      </div>
    </div>

    {/* Threat Correlator Pipeline */}
    <div className="border-t border-border bg-secondary/10 px-6 py-5">
      <div className="mono text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-4">Threat Correlator Fusion Node</div>
      <div className="grid gap-4 text-xs sm:grid-cols-3 font-semibold">
        <div className="border border-border bg-card p-4 rounded-2xl shadow-sm">
          <div className="text-muted-foreground uppercase tracking-wider text-[10px]">ML Weight (70%)</div>
          <div className="mt-2 font-bold text-primary font-mono text-sm">{scan.mlProbability ?? confidence}% ({scan.mlPrediction})</div>
        </div>
        <div className="border border-border bg-card p-4 rounded-2xl shadow-sm">
          <div className="text-muted-foreground uppercase tracking-wider text-[10px]">Heuristics Weight (30%)</div>
          <div className="mt-2 font-bold text-primary font-mono text-sm">{scan.ruleRiskScore ?? risk}/100 ({scan.rulePrediction})</div>
        </div>
        <div className="border border-primary/20 bg-primary/5 p-4 rounded-2xl">
          <div className="text-primary uppercase tracking-wider text-[10px]">Fused Result Verdict</div>
          <div className="mt-2 font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-widest text-sm">{scan.verdict}</div>
        </div>
      </div>
    </div>

    {/* Telemetry Logs in Premium Code Block */}
    <div className="border-t border-border bg-neutral-50 dark:bg-neutral-900/50 p-6 font-mono text-[11px] leading-relaxed text-neutral-800 dark:text-neutral-300">
      <div className="flex items-center gap-2 border-b border-border pb-3 mb-4 text-neutral-500">
        <Terminal size={14} />
        <span className="font-bold tracking-wider">PHISHGUARD AI ANALYST TELEMETRY REPORT v{scan.modelVersion ?? "1.0.0"}</span>
      </div>
      <div>&gt; url_vector_scanned: {scan.url}</div>
      <div>&gt; calibrated_confidence_bound: {confidence}%</div>
      <div>&gt; rules_engine_severity: {scan.ruleRiskScore ?? risk}/100</div>
      <div>&gt; final_verdict: {scan.verdict.toUpperCase()}</div>
      
      <div className="mt-4 text-neutral-900 dark:text-neutral-100 font-bold uppercase tracking-wider border-t border-border/60 pt-3">Indicators Identified:</div>
      {scan.ruleFlags?.length ? (
        <ul className="mt-2 space-y-1.5">
          {scan.ruleFlags.map((flag: string, index: number) => (
            <li key={`${flag}-${index}`} className="flex gap-2.5 items-start">
              <span className="text-destructive shrink-0">✖</span> 
              <span className="font-sans font-semibold text-neutral-700 dark:text-neutral-300">{flag}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-emerald-600 dark:text-emerald-400 mt-2 font-bold flex items-center gap-2">
          <span>✔</span> ZERO_THREATS: Host matches safe signature parameters.
        </div>
      )}
    </div>
    
    <div className="border-t border-border px-6 py-4 bg-secondary/15 text-center">
      <Button variant="outline" onClick={onDetails} className="w-full text-xs font-bold" testId="button-view-scan-details">Inspect Neural Weights Breakdown <ArrowRight size={13} /></Button>
    </div>
  </Card>;
}

function LogsPage() {
  const [search, setSearch] = useState(''); const [verdict, setVerdict] = useState<'all' | 'safe' | 'phishing'>('all'); const [minRisk, setMinRisk] = useState('');
  const params = useMemo(() => ({ search: search || undefined, verdict: verdict === 'all' ? undefined : verdict, minRisk: minRisk ? Number(minRisk) : undefined }), [search, verdict, minRisk]);
  const scans = useListScans(params, { query: { queryKey: getListScansQueryKey(params) } });
  
  return <><PageHeading eyebrow="Telemetry history" title="Threat Telemetry logs" copy="Filter past investigations by risk metrics or query strings to analyze target parameters." action={<Link href="/scanner" data-testid="link-logs-scan" className="focus-ring inline-flex items-center gap-2 border border-border bg-card px-4 py-2.5 rounded-2xl text-xs font-bold text-foreground hover:border-primary/50 transition"><Radar size={14} className="text-primary" /> Inspect URL</Link>} /><Card className="mb-6 p-4"><div className="grid gap-3 md:grid-cols-[1fr_180px_180px]"><label className="relative flex items-center border border-border bg-secondary/30 rounded-2xl px-3"><Search size={15} className="text-muted-foreground mr-2 shrink-0" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search domain..." data-testid="input-search-logs" className="focus-ring h-10 w-full bg-transparent text-sm outline-none text-foreground placeholder:text-muted-foreground/60" /></label><select value={verdict} onChange={e => setVerdict(e.target.value as typeof verdict)} data-testid="select-verdict-filter" className="focus-ring h-11 rounded-2xl border border-border bg-secondary/30 px-4 text-xs font-bold uppercase tracking-wider outline-none text-neutral-600 dark:text-neutral-300"><option value="all">All Verdicts</option><option value="safe">Safe Verdicts</option><option value="phishing">Phishing Signals</option></select><select value={minRisk} onChange={e => setMinRisk(e.target.value)} data-testid="select-risk-filter" className="focus-ring h-11 rounded-2xl border border-border bg-secondary/30 px-4 text-xs font-bold uppercase tracking-wider outline-none text-neutral-600 dark:text-neutral-300"><option value="">Any Risk Ratio</option><option value="25">25+ Risk</option><option value="50">50+ Risk</option><option value="75">75+ Risk</option></select></div></Card>{scans.isLoading ? <LoadingState label="Searching telemetry records" /> : scans.isError ? <ErrorState onRetry={() => scans.refetch()} /> : scans.data?.length ? <Card className="overflow-hidden p-0 bg-card"><div className="flex items-center justify-between border-b border-border px-6 py-4 bg-secondary/15"><div className="flex items-center gap-2 text-xs font-bold text-neutral-700 dark:text-neutral-300"><ListFilter size={14} className="text-primary" /> {scans.data.length} telemetry instances</div><span className="mono text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Newest First</span></div>{scans.data.map((scan: any) => <ScanRow key={scan.id} scan={scan} />)}</Card> : <EmptyState title="No logs match criteria" copy="Broaden filters or run a new inspection to populate." action={<Link href="/scanner" data-testid="link-empty-logs-scan" className="text-xs font-bold text-primary uppercase tracking-widest hover:underline">Open analysis console</Link>} />}</>;
}

// Mapping Rules to descriptive contents for Timeline Section
function getRuleDetails(flag: string): { title: string; desc: string; severity: 'High' | 'Medium' | 'Safe'; icon: LucideIcon } {
  const normalized = flag.toLowerCase();
  
  if (normalized.includes("ip address")) {
    return {
      title: "Raw IP Address Hostname",
      desc: "An IP address is used directly as the hostname instead of a standard domain. Phishing sites frequently bypass DNS lookup listings to avoid hostname blacklists.",
      severity: "High",
      icon: Network
    };
  }
  if (normalized.includes("subdomain")) {
    return {
      title: "Subdomain Obfuscation",
      desc: "Too many subdomain segments are prepended to the URL. This is used by bad actors to hide the actual registrable domain name at the end of the URL and spoof safe brands.",
      severity: "Medium",
      icon: Eye
    };
  }
  if (normalized.includes("no https")) {
    return {
      title: "Insecure Protocol (HTTP)",
      desc: "This site does not use SSL/TLS encryption. All credentials, passwords, or transaction records sent to this server can be sniffed in plaintext by network interceptors.",
      severity: "High",
      icon: LockKeyhole
    };
  }
  if (normalized.includes("keyword:")) {
    const match = flag.match(/keyword:\s*(.*)/i);
    const keyword = match ? match[1] : "sensitive keyword";
    return {
      title: `Credential Keyword Trigger: "${keyword}"`,
      desc: `The URL path or query includes high-risk terms like "${keyword}" linked to security logins or bank credential overrides.`,
      severity: "Medium",
      icon: AlertTriangle
    };
  }
  if (normalized.includes("@ symbol")) {
    return {
      title: "Obfuscation Separator (@)",
      desc: "Contains an '@' character which overrides standard domain routing. Browsers skip all preceding parameters, sending the user to whatever target domain follows it.",
      severity: "High",
      icon: AlertCircle
    };
  }
  if (normalized.includes("shortener")) {
    return {
      title: "Obscured Shortener Domain",
      desc: "A URL shortening redirection service is detected. Shorteners hide final landing URLs, making it impossible to check the target hostname until clicked.",
      severity: "Medium",
      icon: Link2
    };
  }
  if (normalized.includes("hyphen")) {
    return {
      title: "Impersonation Hyphenation",
      desc: "Combines trusted brand terms with hyphens to trick analysts into validating the page. Legit portals rarely combine brand slugs with security buzzwords in unauthorized domains.",
      severity: "High",
      icon: ShieldAlert
    };
  }
  if (normalized.includes("brand impersonation")) {
    return {
      title: "Brand Similarity Match",
      desc: "The second-level domain (SLD) closely mimics a registered brand domain name using typos, character substitutions, or visual lookalikes.",
      severity: "High",
      icon: Fingerprint
    };
  }
  if (normalized.includes("https enabled") || normalized.includes("trusted domain") || normalized.includes("normal domain") || normalized.includes("normal path")) {
    return {
      title: flag,
      desc: "This structural parameter conforms to legitimate, verified domain parameters, indicating safe structural patterns.",
      severity: "Safe",
      icon: ShieldCheck
    };
  }
  
  // Default fallback
  return {
    title: flag,
    desc: "Heuristic pattern evaluated by system rules. Contributes to overall danger and risk assessment weights.",
    severity: normalized.includes("safe") || normalized.includes("enabled") ? "Safe" : "Medium",
    icon: Radar
  };
}

function FeaturesPage() {
  const { id } = useParams<{ id: string }>(); 
  const scan = useGetScan(id ?? '', { query: { enabled: Boolean(id), queryKey: getGetScanQueryKey(id ?? '') } });
  const data = scan.data;

  // Recommendation builder
  const getRecommendation = (verdict: string) => {
    if (isPhishing(verdict)) {
      return {
        title: "Do not open this website",
        desc: "PhishGuard has identified clear threat signatures indicating phishing or identity impersonation. Refrain from clicking links on this site or inputting passwords/emails.",
        tone: "red"
      };
    } else if (verdict === 'suspicious') {
      return {
        title: "Verify before clicking",
        desc: "This site contains suspicious parameters or lookalike indicators. Check the URL registry spelling, SSL status, and sender details carefully before proceeding.",
        tone: "amber"
      };
    } else {
      return {
        title: "Proceed carefully",
        desc: "This URL exhibits standard, clean structural signals. However, safe detection is not a complete guarantee. Maintain usual vigilance on the target page.",
        tone: "green"
      };
    }
  };

  // Recharts Data Mapping
  const chartData = useMemo(() => {
    if (!data) return [];
    const phishingProb = data.mlProbability ?? Math.round(data.confidence);
    const safeProb = data.safeProbability ?? (100 - phishingProb);
    return [
      { name: "Phishing Risk", value: phishingProb, color: "hsl(var(--destructive))" },
      { name: "Safe Vector", value: safeProb, color: "hsl(var(--primary))" }
    ];
  }, [data]);

  return <>{scan.isLoading ? <LoadingState label="Querying scan explanation" /> : scan.isError || !data ? <ErrorState onRetry={() => scan.refetch()} label="That scan could not be found." /> : <>
    <PageHeading 
      eyebrow="Telemetry breakdown" 
      title="Investigative Report" 
      copy="Detailed view of the 20 lexical features, combined score weights, and model parameters." 
      action={<Link href="/logs" data-testid="link-back-logs" className="focus-ring inline-flex items-center gap-2 rounded-2xl border border-border px-4 py-2.5 text-xs font-bold text-muted-foreground hover:text-foreground transition"><ChevronRight size={16} className="rotate-180 text-primary" /> Back to logs</Link>} 
    />

    {/* Section 1 — Result Hero */}
    <Card className="overflow-hidden p-0 bg-card mb-8">
      <div className="flex flex-col lg:flex-row justify-between gap-8 p-6 md:p-8 bg-secondary/15 items-center">
        <div className="min-w-0 text-center lg:text-left">
          <StatusPill verdict={data.verdict} />
          <h2 className="mt-4 break-all text-xl font-extrabold text-neutral-950 dark:text-white leading-tight font-mono">{data.url}</h2>
          <p className="mt-2 text-[10px] text-muted-foreground font-mono uppercase tracking-widest font-semibold">SCANNED_AT: {fmtDate(data.createdAt)} @ {fmtTime(data.createdAt)}</p>
        </div>

        {/* Big circular SVG Risk gauge */}
        <div className="flex items-center gap-6 shrink-0">
          <div className="relative h-28 w-28">
            <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" className="fill-none stroke-[8] stroke-neutral-200 dark:stroke-neutral-800" />
              <circle 
                cx="60" 
                cy="60" 
                r="50" 
                className={`fill-none stroke-[8] transition-all duration-700 ${isPhishing(data.verdict) && data.riskScore >= 60 ? 'stroke-destructive' : isPhishing(data.verdict) ? 'stroke-amber-500' : 'stroke-emerald-500'}`} 
                strokeDasharray={2 * Math.PI * 50} 
                strokeDashoffset={2 * Math.PI * 50 - (data.riskScore / 100) * 2 * Math.PI * 50} 
                strokeLinecap="round" 
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-sans text-3xl font-extrabold text-neutral-900 dark:text-white leading-none">{Math.round(data.riskScore)}</span>
              <span className="mono text-[9px] text-muted-foreground uppercase mt-1 tracking-widest font-bold">RISK</span>
            </div>
          </div>
          <div className="font-mono text-xs font-semibold leading-relaxed text-muted-foreground border-l border-border/80 pl-6 hidden sm:block">
            <div>&gt; CLASSIFIER: CALIBRATED RF</div>
            <div>&gt; CONFIDENCE: {Math.round(data.confidence * (data.confidence <= 1 ? 100 : 1))}%</div>
            <div>&gt; MULTI_INDEX: FUSED</div>
          </div>
        </div>
      </div>

      {/* Section 2 — Hybrid Detection Overview */}
      <div className="grid gap-6 p-6 md:p-8 md:grid-cols-2">
        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border pb-3 mb-4">
            <Cpu size={16} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Machine Learning (70% Weight)</h3>
          </div>
          <div className="flex justify-between items-center mb-2 text-xs">
            <span className="text-muted-foreground font-semibold">Calibrated RF Confidence</span>
            <strong className="text-primary font-mono text-sm">{Math.round(data.confidence * (data.confidence <= 1 ? 100 : 1))}%</strong>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden mb-4">
            <div className="h-full bg-primary rounded-full" style={{ width: `${Math.round(data.confidence * (data.confidence <= 1 ? 100 : 1))}%` }} />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed"> cal_prob: Calibrated Random Forest model version {data.modelVersion ?? "1.0.0"} evaluated 20 extracted lexical features to determine prediction.</p>
        </div>

        <div className="p-5 border border-border rounded-2xl bg-card shadow-sm">
          <div className="flex items-center gap-2.5 border-b border-border pb-3 mb-4">
            <Settings2 size={16} className="text-primary" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200">Heuristics Rules Engine (30% Weight)</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-4">The deterministic heuristics check evaluated target parameters and flagged {data.ruleFlags?.length ?? 0} violations.</p>
          <div className="flex flex-wrap gap-1.5">
            {data.ruleFlags?.map((flag: string, index: number) => {
              const rule = getRuleDetails(flag);
              const toneClass = rule.severity === 'High' ? 'bg-destructive/10 text-destructive border-destructive/20' : rule.severity === 'Medium' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
              return <span key={index} className={`px-2.5 py-0.5 rounded-full border text-[10px] font-semibold uppercase tracking-wider leading-none ${toneClass}`}>{rule.title}</span>;
            })}
          </div>
        </div>
      </div>
    </Card>

    {/* Section 3 — Explainability Tiles (Masonry Pinterest Grid) */}
    <div className="mb-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-4 font-mono">Explainability Tiles</h3>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {/* Tile A: Verdict */}
        <Card className="p-5 flex flex-col justify-between bg-card">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Safety Verdict</p>
            <h4 className="mt-3 text-lg font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{data.verdict}</h4>
          </div>
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">Decision fused via heuristics criteria limits and ML outputs.</p>
        </Card>

        {/* Tile B: Risk Score */}
        <Card className="p-5 flex flex-col justify-between bg-card">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">FUSION RISK SCORE</p>
            <h4 className="mt-3 text-2xl font-extrabold text-neutral-950 dark:text-white tracking-tight">{Math.round(data.riskScore)}/100</h4>
          </div>
          <div className="mt-4 h-2 bg-secondary rounded-full overflow-hidden">
            <div className={`h-full rounded-full ${isPhishing(data.verdict) ? 'bg-destructive' : 'bg-primary'}`} style={{ width: `${data.riskScore}%` }} />
          </div>
        </Card>

        {/* Tile C: HTTPS Card */}
        <Card className="p-5 flex flex-col justify-between bg-card">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Protocol Encryption</p>
            <div className="mt-3 flex items-center gap-2 font-bold text-xs uppercase tracking-wider">
              {data.urlIntelligence?.httpsEnabled ? (
                <span className="text-emerald-600 flex items-center gap-1.5"><Lock size={13} /> Encrypted (HTTPS)</span>
              ) : (
                <span className="text-destructive flex items-center gap-1.5"><AlertCircle size={13} /> Unencrypted (HTTP)</span>
              )}
            </div>
          </div>
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed">Port: {data.urlIntelligence?.port ?? (data.urlIntelligence?.httpsEnabled ? 443 : 80)} // Protocol: {data.urlIntelligence?.protocol ?? 'HTTP'}</p>
        </Card>

        {/* Tile D: Domain Intel */}
        <Card className="p-5 flex flex-col justify-between bg-card">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Domain Intel</p>
            <h4 className="mt-3 text-xs font-bold text-neutral-800 dark:text-neutral-200 font-mono truncate">{data.urlIntelligence?.registrableDomain}</h4>
          </div>
          <div className="mt-4 text-[10px] text-muted-foreground space-y-1 font-mono">
            <div>subdomains: {data.urlIntelligence?.subdomainCount ?? 0}</div>
            <div>ip_address: {data.urlIntelligence?.ipAddress ?? 'N/A'} ({data.urlIntelligence?.ipVersion ?? 'N/A'})</div>
          </div>
        </Card>

        {/* Tile E: Obfuscation Info */}
        <Card className="p-5 flex flex-col justify-between bg-card">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">URL Parameters</p>
            <h4 className="mt-3 text-sm font-bold text-neutral-800 dark:text-neutral-200">{data.urlIntelligence?.urlLength ?? data.url?.length ?? 0} Characters</h4>
          </div>
          <div className="mt-4 text-[10px] text-muted-foreground space-y-1 font-mono">
            <div>path_depth: {data.urlIntelligence?.path?.split("/").filter(Boolean).length ?? 0}</div>
            <div>query_params: {data.urlIntelligence?.queryParameterCount ?? 0}</div>
          </div>
        </Card>

        {/* Tile F: Brand impersonation info */}
        <Card className="p-5 flex flex-col justify-between bg-card">
          <div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Brand Check</p>
            {data.brandImpersonation ? (
              <div className="mt-3 text-destructive font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert size={13} /> {data.impersonatedBrand} Mimicry
              </div>
            ) : (
              <div className="mt-3 text-emerald-600 font-bold text-xs uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck size={13} /> Legit Registry
              </div>
            )}
          </div>
          <p className="mt-4 text-xs text-muted-foreground leading-relaxed truncate">
            {data.brandImpersonation ? `Similarity: ${Math.round(data.similarityScore * 100)}% to ${data.legitimateDomain}` : 'Conforms to safe lookup dictionary records.'}
          </p>
        </Card>
      </div>
    </div>

    {/* Section 4 — Why Was This URL Flagged? (Timeline) */}
    <div className="mb-8">
      <h3 className="text-sm font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-200 mb-6 font-mono">Evidence Log & Heuristics Timeline</h3>
      {data.ruleFlags?.length ? (
        <div className="relative border-l border-border pl-6 ml-4 space-y-8">
          {data.ruleFlags.map((flag: string, index: number) => {
            const rule = getRuleDetails(flag);
            const RuleIcon = rule.icon;
            const severityColors = rule.severity === 'High' ? 'border-destructive bg-destructive/10 text-destructive' : rule.severity === 'Medium' ? 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' : 'border-emerald-500 bg-emerald-500/10 text-emerald-600';
            
            return <div key={`${flag}-${index}`} className="relative">
              {/* Radial bubble dot */}
              <span className={`absolute -left-10 top-0.5 flex h-8 w-8 items-center justify-center rounded-xl border-2 bg-card ${severityColors}`}>
                <RuleIcon size={14} />
              </span>
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <h4 className="text-sm font-bold text-neutral-900 dark:text-white uppercase tracking-wider">{rule.title}</h4>
                  <span className={`px-2 py-0.5 rounded-full border text-[9px] font-bold uppercase tracking-widest ${severityColors}`}>{rule.severity} Risk</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground max-w-2xl">{rule.desc}</p>
              </div>
            </div>;
          })}
        </div>
      ) : (
        <Card className="border-dashed border-border p-8 text-center bg-emerald-500/5">
          <CheckCircle2 size={24} className="text-emerald-500 mx-auto mb-3" />
          <h4 className="text-sm font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-widest font-mono">Zero Telemetry Violations Flagged</h4>
          <p className="mt-2 text-xs text-muted-foreground">The hostname conforms completely to safe dictionary profiles.</p>
        </Card>
      )}
    </div>

    {/* Section 5 — Score Breakdown (Recharts Charts) */}
    <div className="grid gap-6 md:grid-cols-2 mb-8">
      {/* Chart A: Pie Donut */}
      <Card className="p-6 bg-card flex flex-col justify-between">
        <div className="border-b border-border pb-3 mb-6">
          <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest font-mono">ML Probability Split</h4>
        </div>
        <div className="h-56 flex items-center justify-center">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={4}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <ChartTooltip formatter={(value) => `${value}%`} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-8 text-xs font-semibold mt-4">
          <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
            <span className="h-2.5 w-2.5 rounded bg-destructive" /> Phishing: {data.mlProbability ?? Math.round(data.confidence)}%
          </span>
          <span className="flex items-center gap-2 text-neutral-600 dark:text-neutral-300">
            <span className="h-2.5 w-2.5 rounded bg-primary" /> Safe: {data.safeProbability ?? (100 - Math.round(data.confidence))}%
          </span>
        </div>
      </Card>

      {/* Chart B: Horizontal Progress Bars */}
      <Card className="p-6 bg-card flex flex-col justify-between">
        <div className="border-b border-border pb-3 mb-6">
          <h4 className="text-xs font-bold text-neutral-800 dark:text-neutral-200 uppercase tracking-widest font-mono">Multi-Engine Confidence Weights</h4>
        </div>

        <div className="space-y-6 py-4 flex-1 flex flex-col justify-center">
          <div>
            <div className="mb-2 flex justify-between text-xs font-semibold">
              <span className="text-neutral-600 dark:text-neutral-300">Calibrated ML Confidence</span>
              <strong className="text-primary font-mono">{Math.round(data.confidence * (data.confidence <= 1 ? 100 : 1))}%</strong>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.round(data.confidence * (data.confidence <= 1 ? 100 : 1))}%` }} />
            </div>
          </div>

          <div>
            <div className="mb-2 flex justify-between text-xs font-semibold">
              <span className="text-neutral-600 dark:text-neutral-300">Heuristics Raw Risk Score</span>
              <strong className="text-destructive font-mono">{data.ruleRiskScore ?? Math.round(data.riskScore)}/100</strong>
            </div>
            <div className="h-2.5 bg-secondary rounded-full overflow-hidden">
              <div className="h-full bg-destructive rounded-full transition-all duration-500" style={{ width: `${data.ruleRiskScore ?? Math.round(data.riskScore)}%` }} />
            </div>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3 text-[10px] text-muted-foreground font-mono text-center">
          INF_ENGINE // DYNAMIC_ROUTING_ACTIVE
        </div>
      </Card>
    </div>

    {/* Section 6 — Recommendation Box */}
    {(() => {
      const rec = getRecommendation(data.verdict);
      const toneClass = rec.tone === 'red' ? 'border-destructive/30 bg-destructive/5 text-destructive' : rec.tone === 'amber' ? 'border-amber-500/30 bg-amber-500/5 text-amber-800 dark:text-amber-400' : 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800 dark:text-emerald-400';
      return <Card className={`p-6 border rounded-3xl ${toneClass} mb-8`}>
        <div className="flex gap-4 items-start">
          <HelpCircle size={24} className="shrink-0 text-current" />
          <div>
            <h4 className="font-bold text-sm uppercase tracking-wider text-neutral-900 dark:text-white">{rec.title}</h4>
            <p className="mt-2 text-xs leading-relaxed text-neutral-700 dark:text-neutral-300 max-w-3xl">{rec.desc}</p>
          </div>
        </div>
      </Card>;
    })()}

    {/* Section 7 — Active Neural Features (Table/Dictionary style) */}
    <Card className="overflow-hidden p-0 bg-card">
      <div className="border-b border-border px-6 py-4.5 bg-secondary/15">
        <h3 className="mono text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">20 Active Neural Features Dictionary</h3>
        <p className="mt-1 text-xs text-muted-foreground">Lexical features extracted from the analyzed URL character sequence.</p>
      </div>
      <div className="grid gap-0 sm:grid-cols-2">
        {Object.keys(data.features ?? {}).length ? Object.entries(data.features).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between gap-4 border-b border-border/50 px-6 py-3 bg-card hover:bg-neutral-50 dark:hover:bg-neutral-850 transition">
            <span className="mono text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{key}</span>
            <span className="mono text-[11px] text-primary font-bold">{String(value)}</span>
          </div>
        )) : (
          <p className="p-6 text-xs text-muted-foreground col-span-2 text-center">Neural features unavailable for this scan.</p>
        )}
      </div>
    </Card>
  </>}</>;
}

function ContextLine({ label, value }: { label: string; value: string }) {
  const bad = isPhishing(value); 
  return <div className="flex items-center justify-between rounded-sm border border-slate-900 px-3.5 py-2.5 bg-slate-950/10"><span className="text-slate-500">{label}</span><span className={`font-bold ${bad ? 'text-red-400' : 'text-emerald-400'}`}>{bad ? 'PHISHING_SIGNAL' : 'SAFE_CLEAN'}</span></div>;
}

function ModelInfoPage() {
  const model = useGetModelInfo({ query: { queryKey: getGetModelInfoQueryKey(), retry: 1 } }); 
  const data = model.data;
  return <><PageHeading eyebrow="Neural model telemetry" title="Model notes" copy="Calibrated test metrics, dataset snapshots, and active features registry." />{model.isLoading ? <LoadingState label="Loading model notes" /> : model.isError ? <ErrorState onRetry={() => model.refetch()} /> : data ? <><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Accuracy" value={pct(data.accuracy)} note="Dynamic test-set accuracy" icon={Target} /><Metric label="Precision" value={pct(data.precision)} note="Calibrated precision rating" icon={Target} /><Metric label="Recall" value={pct(data.recall)} note="Phishing capture ratio" icon={Radar} /><Metric label="F1 score" value={pct(data.f1Score)} note="F1 classification metrics" icon={Gauge} tone="amber" /></div><div className="mt-8 grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><Card className="p-6 bg-secondary/15"><p className="mono text-[10px] font-bold uppercase tracking-widest text-primary">Classifier snapshot</p><h2 className="mt-3 text-lg font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Training constraints</h2><div className="mt-6 space-y-4 font-mono text-xs"><DataLine label="Clean dataset size" value={data.datasetSize.toLocaleString()} /><DataLine label="Phishing instances" value={data.phishingCount.toLocaleString()} /><DataLine label="Benign instances" value={data.legitimateCount.toLocaleString()} /><DataLine label="Model version" value={data.modelVersion ?? "1.0.0"} /><DataLine label="Calibrated ROC-AUC" value={data.rocAuc ? pct(data.rocAuc) : "—"} /><DataLine label="Training date" value={fmtDate(data.trainedAt)} /></div><div className="mt-6 border border-border bg-card p-4 rounded-2xl text-xs text-muted-foreground"><BookOpen size={14} className="mb-2 text-primary" /><strong className="text-neutral-800 dark:text-neutral-200">Interpretation guide:</strong> Test statistics reflect model performance against held-out verification blocks. Calibrated probability ratings ensure reliable inference values.</div></Card><Card className="p-6 bg-card"><div className="flex items-start justify-between border-b border-border pb-4 mb-6"><div><p className="mono text-[10px] font-bold uppercase tracking-widest text-primary">Random Forest importances</p><h2 className="mt-3 text-lg font-bold text-neutral-900 dark:text-white uppercase tracking-wider">Neural feature weights</h2></div><Sparkles size={16} className="text-primary animate-pulse" /></div><div className="space-y-4">{data.featureImportance?.slice(0, 8).map((item: any) => <div key={item.name} className="font-mono text-xs"><div className="mb-1.5 flex justify-between font-semibold"><span className="text-neutral-600 dark:text-neutral-300">{item.name}</span><span className="font-bold text-primary">{Math.round(item.importance * 100)}%</span></div><div className="h-2 bg-secondary rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${Math.min(100, item.importance * 100)}%` }} /></div></div>)}</div></Card></div><Card className="mt-8 overflow-hidden p-0 bg-card"><div className="border-b border-border px-6 py-4.5 bg-secondary/15"><h2 className="mono text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Active Features Dictionary</h2><p className="mt-1 text-xs text-muted-foreground">Registry mappings for active feature vectors.</p></div>{data.features?.map((item: any) => <div key={item.name} className="grid gap-2 border-b border-border px-6 py-4.5 last:border-0 sm:grid-cols-[.32fr_1fr] bg-card hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition"><span className="mono text-[10px] font-bold text-primary uppercase tracking-wider">{item.name}</span><span className="text-xs text-muted-foreground leading-relaxed font-sans font-semibold">{item.description}</span></div>)}</Card></> : <EmptyState title="Model details offline" copy="No active snap logs discovered." />}</>;
}

function DataLine({ label, value }: { label: string; value: string }) { 
  return <div className="flex items-center justify-between border-b border-border/60 pb-3 text-xs last:border-0"><span className="text-neutral-500 font-bold uppercase tracking-wider">{label}</span><strong className="text-neutral-800 dark:text-neutral-100">{value}</strong></div>; 
}

function SettingsPage() {
  const [, setLocation] = useLocation(); 
  const user = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } }); 
  const logout = useLogout(); 
  const [theme, setTheme] = useTheme(); 
  const [saved, setSaved] = useState(false);
  
  const toggleTheme = () => { 
    const next = theme === 'light' ? 'dark' : 'light'; 
    setTheme(next); 
    setSaved(true); 
    setTimeout(() => setSaved(false), 1800); 
  };
  
  return <><PageHeading eyebrow="Workspace settings" title="Console preferences" copy="Configure interface theme profiles and session validation values." />{user.isLoading ? <LoadingState /> : <div className="grid gap-6 lg:grid-cols-[.38fr_.62fr]"><Card className="p-6 bg-card"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-base font-extrabold text-primary border border-primary/20">{user.data?.name?.slice(0, 1).toUpperCase() ?? 'U'}</div><div><h2 className="font-sans text-base font-bold text-neutral-900 dark:text-white" data-testid="text-settings-name">{user.data?.name ?? 'Analyst'}</h2><p className="mt-1 text-xs text-muted-foreground" data-testid="text-settings-email">{user.data?.email ?? 'Console user'}</p></div></div><div className="mt-8 rounded-2xl border border-border bg-secondary/35 p-4.5 text-xs text-muted-foreground leading-relaxed"><UserRound size={15} className="mb-2 text-primary" />Account credentials maintain logs and telemetry scans across platform sessions.</div></Card><div className="space-y-6"><Card className="p-6 bg-card"><div><h2 className="mono text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Appearance</h2><p className="mt-1 text-xs text-muted-foreground">Toggle dark / light console backgrounds.</p></div><button onClick={toggleTheme} data-testid="button-toggle-theme" className="focus-ring mt-6 flex w-full items-center justify-between rounded-2xl border border-border p-4.5 text-left transition bg-secondary/15 hover:border-primary/45"><span className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center bg-primary/10 text-primary rounded-xl"><Monitor size={15} /></span><span><span className="block text-xs font-bold uppercase tracking-wider text-neutral-800 dark:text-neutral-100">{theme === 'dark' ? 'Dark Console' : 'Light Console'}</span><span className="mt-1 block text-[10px] text-muted-foreground font-mono">{theme === 'dark' ? 'Deep grey HSL dark-mode active' : 'Warm parchment light-mode active'}</span></span></span><span className={`h-6 w-11 rounded-full p-0.5 transition duration-300 flex items-center ${theme === 'dark' ? 'bg-primary justify-end' : 'bg-neutral-300 justify-start'}`}><span className="block h-5 w-5 rounded-full bg-card shadow-sm transition-all duration-300" /></span></button>{saved && <p className="mt-3 text-[10px] font-bold text-primary font-mono tracking-wider uppercase" data-testid="status-theme-saved">Appearance saved for this session.</p>}</Card><Card className="p-6 bg-card"><h2 className="mono text-xs font-bold uppercase tracking-widest text-neutral-800 dark:text-neutral-200">Session</h2><p className="mt-1 text-xs text-muted-foreground">Terminate secure login cookies on this machine.</p><Button variant="danger" onClick={() => logout.mutate(undefined, { onSuccess: () => setLocation('/') })} disabled={logout.isPending} className="mt-6" testId="button-settings-logout"><LogOut size={13} /> {logout.isPending ? 'Terminating…' : 'Sign out'}</Button></Card></div></div>}</>;
}

function ForgotPasswordPage() {
  const [, setLocation] = useLocation(); const [email, setEmail] = useState('');
  return <AuthLayout eyebrow="System recovery · 01" title="Request OTP" copy="Enter your registered security email to obtain an OTP link."><form onSubmit={e => { e.preventDefault(); setLocation(`/verify-otp?email=${encodeURIComponent(email)}`); }} className="space-y-4"><Field label="Registered email" value={email} onChange={setEmail} type="email" placeholder="you@phishguard.net" testId="input-forgot-email" /><Button type="submit" className="w-full font-bold" testId="button-send-otp">Send recovery OTP <ArrowRight size={14} /></Button></form><p className="mt-6 text-center text-xs text-muted-foreground"><Link href="/login" data-testid="link-back-login" className="font-bold text-primary hover:underline uppercase tracking-wider">Back to credentials</Link></p></AuthLayout>;
}

function VerifyOtpPage() {
  const [, setLocation] = useLocation(); const [otp, setOtp] = useState('');
  return <AuthLayout eyebrow="System recovery · 02" title="Verify OTP" copy="Enter the six-digit telemetry OTP code sent to your email."><form onSubmit={e => { e.preventDefault(); setLocation('/reset-password'); }} className="space-y-4"><label className="block"><span className="mb-2.5 block mono text-[10px] uppercase text-neutral-500 font-bold tracking-wider">Verification code</span><input required minLength={6} maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="000000" data-testid="input-otp" className="focus-ring mono h-12 w-full rounded-2xl border border-border bg-secondary/50 px-4 text-center text-xl tracking-[0.6em] outline-none text-foreground focus:border-primary/50" /></label><Button type="submit" disabled={otp.length !== 6} className="w-full font-bold" testId="button-verify-otp">Verify code <Check size={14} /></Button></form><p className="mt-6 text-center text-xs text-muted-foreground">Didn’t receive? <button onClick={() => setOtp('')} data-testid="button-resend-otp" className="font-bold text-primary hover:underline uppercase tracking-wider">Resend code</button></p></AuthLayout>;
}

function ResetPasswordPage() {
  const [, setLocation] = useLocation(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const valid = password.length >= 6 && password === confirm;
  return <AuthLayout eyebrow="System recovery · 03" title="New Password" copy="Define a fresh credentials secret for security console signins."><form onSubmit={e => { e.preventDefault(); setLocation('/login'); }} className="space-y-4"><Field label="New secret" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" testId="input-reset-password" /><Field label="Confirm secret" value={confirm} onChange={setConfirm} type="password" placeholder="Repeat password" testId="input-confirm-password" />{confirm && password !== confirm && <p className="mono text-[10px] font-semibold text-destructive mt-1 bg-destructive/10 px-3 py-1.5 rounded-xl border border-destructive/20" data-testid="status-password-mismatch">Mismatch: Secret values do not align.</p>}<Button type="submit" disabled={!valid} className="w-full font-bold" testId="button-reset-password">Save new password <Check size={14} /></Button></form></AuthLayout>;
}

function ExtensionPreviewPage() {
  const [enabled, setEnabled] = useState(false); const [url, setUrl] = useState('https://paypaI-account-check.com/verify');
  return <><PageHeading eyebrow="Security integration concepts" title="Browser companion preview" copy="Sleek inline companion simulation demonstrating active warning states directly inside the navigation experience." action={<Button onClick={() => setEnabled(!enabled)} variant={enabled ? 'soft' : 'primary'} testId="button-toggle-extension">{enabled ? <Check size={14} /> : <Zap size={14} />} {enabled ? 'Enabled' : 'Activate companion preview'}</Button>} /><div className="mx-auto max-w-4xl"><div className="overflow-hidden border border-border bg-card shadow-lg rounded-3xl"><div className="flex items-center gap-3 border-b border-border bg-secondary/15 px-5 py-4.5"><div className="flex gap-1.5 shrink-0"><span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" /><span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" /><span className="h-2.5 w-2.5 rounded-full bg-neutral-300 dark:bg-neutral-700" /></div><div className="mx-auto flex h-9 max-w-xl flex-1 items-center gap-2 rounded-2xl border border-border bg-background px-4 text-xs text-muted-foreground font-mono leading-none"><LockKeyhole size={13} className="text-emerald-500 shrink-0" />{url}<span className="ml-auto shrink-0"><RefreshCw size={12} /></span></div><span className="grid h-8 w-8 place-items-center rounded-2xl bg-primary/10 border border-primary/25 text-primary"><ShieldCheck size={15} /></span></div><div className="grid min-h-[440px] place-items-center bg-secondary/20 p-8"><div className="w-full max-w-[400px] border border-border bg-card p-6 shadow-xl rounded-3xl"><div className="flex items-center gap-3 border-b border-border pb-4"><span className="grid h-9 w-9 place-items-center bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl"><ShieldAlert size={16} /></span><div><p className="mono text-[11px] font-bold text-neutral-800 dark:text-neutral-100 uppercase tracking-widest leading-none">PhishGuard shields</p><p className="text-[9px] text-muted-foreground font-mono uppercase tracking-widest mt-1">Proactive Warning</p></div><span className="ml-auto h-2 w-2 rounded-full bg-amber-500 animate-pulse" /></div><div className="mt-5 border border-destructive/25 bg-destructive/5 p-4 rounded-2xl text-destructive"><div className="flex items-center gap-2 font-bold uppercase tracking-wider text-xs"><ShieldAlert size={14} /><span>Threat detected</span></div><p className="mt-2 text-xs leading-relaxed text-neutral-750 dark:text-neutral-300">This URL matches structural lookalike patterns commonly used in brand impersonation.</p></div><div className="mt-5 space-y-2.5 font-mono text-[10px] text-muted-foreground"><div className="flex gap-2"><span className="text-destructive">✖</span> Character substitution detected in hostname.</div><div className="flex gap-2"><span className="text-destructive">✖</span> Request contains suspicious keywords.</div></div><button onClick={() => setUrl('https://www.example.com/')} data-testid="button-extension-safe-example" className="mt-6 w-full rounded-2xl border border-primary/30 bg-primary/5 py-3 text-xs font-bold text-primary uppercase tracking-widest hover:bg-primary hover:text-white transition-all duration-300">Redirect to safe destination</button></div></div></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><FeatureTile icon={Eye} title="Low telemetry footprint" copy="Inspects inputs silently and triggers warning dialogues only when threat ratios cross limits." /><FeatureTile icon={Timer} title="Calibrated latency" copy="Evaluates 20 feature nodes under ~30ms, preventing browser delays." /><FeatureTile icon={Code2} title="Fully explainable logs" copy="Provides instant lookup access to raw heuristics arrays and classification weights." /></div></div></>;
}

function Router() {
  return <ErrorBoundary><Switch><Route path="/" component={LandingPage} /><Route path="/login" component={LoginPage} /><Route path="/signup" component={SignupPage} /><Route path="/forgot-password" component={ForgotPasswordPage} /><Route path="/verify-otp" component={VerifyOtpPage} /><Route path="/reset-password" component={ResetPasswordPage} /><Route path="/extension-preview" component={ExtensionPreviewPage} /><Route path="/dashboard"><AppShell><DashboardPage /></AppShell></Route><Route path="/scanner"><AppShell><ScannerPage /></AppShell></Route><Route path="/logs"><AppShell><LogsPage /></AppShell></Route><Route path="/features/:id"><AppShell><FeaturesPage /></AppShell></Route><Route path="/model-info"><AppShell><ModelInfoPage /></AppShell></Route><Route path="/settings"><AppShell><SettingsPage /></AppShell></Route><Route component={NotFound} /></Switch></ErrorBoundary>;
}

function App() {
  return <QueryClientProvider client={queryClient}><Router /></QueryClientProvider>;
}

export default App;

const FEATURE_SCHEMA = {
  version: "1.0.0"
};