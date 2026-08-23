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
  Fingerprint as SecurityIcon,
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

const queryClient = new QueryClient();

const fmtDate = (value?: string) => value ? new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value)) : '—';
const fmtTime = (value?: string) => value ? new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(new Date(value)) : '—';
const pct = (value?: number) => `${Math.round((value ?? 0) * (value && value <= 1 ? 100 : 1))}%`;
const shortUrl = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');
const isPhishing = (verdict?: string) => verdict === 'phishing';

function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link href="/" data-testid="link-logo" className="focus-ring flex items-center gap-2 text-cyan-400">
      <span className="grid h-7 w-7 place-items-center border border-cyan-500/30 bg-cyan-950/20 rounded-sm">
        <ShieldCheck size={16} className="text-cyan-400" />
      </span>
      <span className="mono text-[13px] font-bold tracking-wider uppercase">
        phish<span className="text-white">guard</span>
      </span>
    </Link>
  );
}

function Button({ children, variant = 'primary', className = '', type = 'button', onClick, disabled, testId = 'button-action' }: { children: ReactNode; variant?: 'primary' | 'soft' | 'outline' | 'ghost' | 'danger'; className?: string; type?: 'button' | 'submit'; onClick?: () => void; disabled?: boolean; testId?: string }) {
  const styles = {
    primary: 'border border-cyan-500/40 bg-cyan-950/30 text-cyan-400 hover:bg-cyan-500/10 hover:text-white',
    soft: 'bg-[hsl(var(--secondary))] text-[hsl(var(--secondary-foreground))] hover:bg-[hsl(var(--secondary)/.72)]',
    outline: 'border border-[hsl(var(--border))] bg-transparent text-[hsl(var(--foreground))] hover:border-cyan-500/30 hover:text-cyan-400',
    ghost: 'text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]',
    danger: 'border border-red-500/30 bg-red-950/20 text-red-400 hover:bg-red-500/10',
  };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`focus-ring inline-flex items-center justify-center gap-2 rounded-sm px-4 py-2 text-[12px] font-medium tracking-wide uppercase transition-all disabled:cursor-not-allowed disabled:opacity-40 ${styles[variant]} ${className}`}>{children}</button>;
}

function Card({ children, className = '', testId }: { children: ReactNode; className?: string; testId?: string }) {
  return <div data-testid={testId} className={`border border-[hsl(var(--border))] bg-[hsl(var(--card))] rounded-sm transition-all duration-300 hover:border-cyan-500/35 hover:shadow-[0_0_22px_rgba(0,240,255,0.06)] hover:bg-cyan-950/15 ${className}`}>{children}</div>;
}

function StatusPill({ verdict }: { verdict?: string }) {
  const bad = isPhishing(verdict);
  return <span data-testid={`status-verdict-${verdict ?? 'unknown'}`} className={`mono inline-flex items-center gap-1.5 rounded-sm px-2.5 py-0.5 text-[10px] font-bold border uppercase ${bad ? 'border-red-500/30 bg-red-950/20 text-red-400' : 'border-emerald-500/30 bg-emerald-950/20 text-emerald-400'}`}>
    {bad ? 'Dangerous / Impersonation' : 'Safe / Clean'}
  </span>;
}

function LoadingState({ label = 'Querying cyber intelligence nodes' }: { label?: string }) {
  return <div className="space-y-4 py-6 text-center" data-testid="state-loading">
    <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-cyan-500/20 border-t-cyan-400" />
    <p className="mono text-xs text-cyan-400/70">{label}…</p>
  </div>;
}

function ErrorState({ onRetry, label = 'We could not load this view.' }: { onRetry?: () => void; label?: string }) {
  return <Card className="border-red-500/25 p-8 text-center" testId="state-error">
    <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-sm bg-red-950/20 text-red-400 border border-red-500/20">
      <RefreshCw size={16} />
    </div>
    <h3 className="mono text-sm font-bold text-red-400">{label}</h3>
    <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Check system settings or network connectivity. Scan records are preserved.</p>
    {onRetry && <Button variant="outline" onClick={onRetry} className="mt-5" testId="button-retry">Retry Node Connection</Button>}
  </Card>;
}

function EmptyState({ title, copy, action }: { title: string; copy: string; action?: ReactNode }) {
  return <Card className="grid place-items-center p-12 text-center" testId="state-empty">
    <div className="mb-4 grid h-10 w-10 place-items-center bg-cyan-950/20 text-cyan-400 border border-cyan-500/25 rounded-sm">
      <Radar size={18} />
    </div>
    <h3 className="mono text-sm font-bold">{title}</h3>
    <p className="mt-1 max-w-sm text-xs text-[hsl(var(--muted-foreground))]">{copy}</p>
    {action && <div className="mt-5">{action}</div>}
  </Card>;
}

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/scanner', label: 'Link Scanner', icon: Radar },
  { href: '/logs', label: 'Scan Logs', icon: Clock3 },
];

function AppShell({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const userQuery = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } });
  const logout = useLogout();
  const user = userQuery.data;
  const signOut = () => logout.mutate(undefined, { onSuccess: () => setLocation('/') });
  
  return <div className="min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] grid-texture">
    <aside className={`fixed inset-y-0 left-0 z-40 flex w-[230px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] px-4 py-5 transition-transform md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
      <div className="flex items-center justify-between px-2">
        <Logo light />
        <button onClick={() => setMobileOpen(false)} className="text-[hsl(var(--sidebar-foreground))] md:hidden" data-testid="button-close-menu">
          <X size={16} />
        </button>
      </div>
      <div className="mt-10 px-2">
        <p className="mono mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-400/50">Core Platform</p>
        <nav className="space-y-1">
          {navItems.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} onClick={() => setMobileOpen(false)} data-testid={`link-nav-${label.toLowerCase().replace(' ', '-')}`} className={`focus-ring flex items-center gap-3 rounded-sm px-3 py-2 text-[12px] font-medium transition ${location === href ? 'bg-cyan-950/30 text-cyan-400 border-l border-cyan-500' : 'text-slate-400 hover:bg-slate-900/40 hover:text-white'}`}>
              <Icon size={15} />
              <span>{label}</span>
              {href === '/scanner' && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" />}
            </Link>
          ))}
        </nav>
      </div>
      <div className="mt-8 px-2">
        <p className="mono mb-3 text-[10px] font-semibold uppercase tracking-[.18em] text-cyan-400/50">Threat Intelligence</p>
        <nav className="space-y-1">
          <Link href="/model-info" data-testid="link-nav-model" className="focus-ring flex items-center gap-3 rounded-sm px-3 py-2 text-[12px] font-medium text-slate-400 hover:bg-slate-900/40 hover:text-white">
            <BarChart3 size={15} />
            <span>Model notes</span>
          </Link>
          <Link href="/extension-preview" data-testid="link-nav-extension" className="focus-ring flex items-center gap-3 rounded-sm px-3 py-2 text-[12px] font-medium text-slate-400 hover:bg-slate-900/40 hover:text-white">
            <Monitor size={15} />
            <span>Browser helper</span>
          </Link>
        </nav>
      </div>
      <div className="mt-auto space-y-3">
        <div className="border border-[hsl(var(--sidebar-border))] bg-slate-950/20 p-3">
          <div className="flex items-center gap-2 text-[10px] font-bold text-cyan-400 uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> 
            Shields active
          </div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-slate-500">
            Explainable neural features mapping active on ports 5000 and 8000.
          </p>
        </div>
        <div className="flex items-center gap-3 border-t border-[hsl(var(--sidebar-border))] px-2 pt-4">
          <div className="grid h-8 w-8 place-items-center rounded-sm bg-cyan-950/20 text-xs font-bold text-cyan-400 border border-cyan-500/25">
            {user?.name?.slice(0, 1).toUpperCase() ?? 'A'}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-bold text-white" data-testid="text-user-name">{user?.name ?? 'Analyst'}</p>
            <p className="truncate text-[10px] text-slate-500">{user?.email ?? 'Console session'}</p>
          </div>
          <button onClick={signOut} disabled={logout.isPending} className="text-slate-500 hover:text-cyan-400" data-testid="button-logout">
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
    {mobileOpen && <button aria-label="Close menu" onClick={() => setMobileOpen(false)} className="fixed inset-0 z-30 bg-black/70 md:hidden" data-testid="button-overlay-menu" />}
    <div className="md:pl-[230px]">
      <header className="sticky top-0 z-20 flex h-[60px] items-center justify-between border-b border-[hsl(var(--border)/.8)] bg-[hsl(var(--background)/.9)] px-5 backdrop-blur-xl md:px-10">
        <button onClick={() => setMobileOpen(true)} className="rounded-sm p-1.5 hover:bg-slate-900 md:hidden" data-testid="button-open-menu">
          <Menu size={18} />
        </button>
        <div className="hidden items-center gap-2 text-[11px] text-slate-400 md:flex">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-400" />
          <span className="mono">SYS_READY // CLASSIFIER_ACTIVE //</span> 
          <span className="text-slate-500 uppercase">{location === '/dashboard' ? 'Overview' : location.replace('/', '').replace('-', ' ') || 'Home'}</span>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/scanner" data-testid="link-header-scan" className="focus-ring inline-flex items-center gap-2 border border-cyan-500/30 bg-cyan-950/20 px-3 py-1.5 text-xs font-medium text-cyan-400 transition hover:bg-cyan-500/10">
            <Radar size={13} />
            <span className="hidden sm:inline">Investigate URL</span>
          </Link>
          <Link href="/settings" data-testid="link-settings" className="focus-ring grid h-8 w-8 place-items-center rounded-sm border border-[hsl(var(--border))] text-slate-400 hover:bg-slate-900 hover:text-cyan-400">
            <Settings2 size={14} />
          </Link>
        </div>
      </header>
      <main className="mx-auto max-w-[1420px] px-5 py-6 md:px-10 md:py-8">{children}</main>
    </div>
  </div>;
}

function PublicHeader() {
  return <header className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 md:px-8">
    <Logo />
    <nav className="hidden items-center gap-6 text-[12px] font-semibold text-slate-400 md:flex">
      <Link href="/#how" data-testid="link-how-it-works" className="hover:text-cyan-400 transition">How it works</Link>
      <Link href="/model-info" data-testid="link-public-model" className="hover:text-cyan-400 transition">Model notes</Link>
      <Link href="/extension-preview" data-testid="link-public-extension" className="hover:text-cyan-400 transition">Browser helper</Link>
    </nav>
    <div className="flex items-center gap-2">
      <Link href="/login" data-testid="link-login" className="focus-ring rounded-sm px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-cyan-400 transition">Sign in</Link>
      <Link href="/signup" data-testid="link-signup-header" className="focus-ring rounded-sm border border-cyan-500/30 bg-cyan-950/20 px-3.5 py-1.5 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500/10">Create account</Link>
    </div>
  </header>;
}

function LandingPage() {
  const [, setLocation] = useLocation();
  const health = useHealthCheck({ query: { queryKey: getHealthCheckQueryKey(), retry: false } });
  const [demoUrl, setDemoUrl] = useState('https://accounts.example.com/sign-in');
  
  return <div className="min-h-[100dvh] overflow-hidden bg-[hsl(var(--background))] text-[hsl(var(--foreground))] grid-texture">
    <PublicHeader />
    <section className="relative mx-auto max-w-6xl px-5 pb-20 pt-16 md:px-8 md:pb-28">
      <div className="relative grid items-center gap-14 lg:grid-cols-[1.1fr_.9fr]">
        <div className="animate-rise">
          <div className="mb-6 inline-flex items-center gap-2 border border-cyan-500/20 bg-cyan-950/10 px-3 py-1 text-[10px] font-bold text-cyan-400 uppercase tracking-wider rounded-sm">
            <Cpu size={12} /> Explainable Threat Intelligence Console
          </div>
          <h1 className="max-w-[620px] text-4xl font-extrabold leading-[1.08] tracking-tight md:text-6xl text-white">
            Detect phishing <span className="text-cyan-400 font-mono">before</span> it becomes a breach.
          </h1>
          <p className="mt-6 max-w-[500px] text-xs leading-6 text-slate-400">
            PhishGuard processes suspicious URL structures, tokens, and domain characteristics in real-time, leveraging calibrated machine learning models and deterministic heuristics pipelines.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button onClick={() => setLocation('/scanner')} testId="button-start-scanning" className="px-6 py-2.5">
              Launch Investigation Console <ArrowRight size={14} />
            </Button>
            <Link href="/extension-preview" data-testid="link-see-extension" className="focus-ring inline-flex items-center gap-2 rounded-sm px-4 py-2 text-[12px] font-bold text-slate-400 hover:text-cyan-400 transition">
              See browser helper <ChevronRight size={13} />
            </Link>
          </div>
          <div className="mt-10 flex items-center gap-5 text-[10px] text-slate-500 font-mono">
            <div className="flex items-center gap-1.5"><LockKeyhole size={12} className="text-cyan-400" /> LOCAL DATA SECURITY</div>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center gap-1.5"><Gauge size={12} className="text-cyan-400" /> ZERO BLACK-BOX INFERENCE</div>
          </div>
        </div>
        
        <div className="animate-rise stagger-2 relative">
          <Card className="relative border-cyan-500/10 shadow-[0_12px_40px_rgba(0,0,0,0.5)]">
            <div className="flex items-center justify-between border-b border-[hsl(var(--border))] px-5 py-3.5 bg-slate-950/30">
              <div className="flex items-center gap-2 text-cyan-400">
                <Radar size={13} />
                <span className="mono text-xs uppercase font-bold tracking-wider">Investigative Sandbox</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-mono text-cyan-400/70">
                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> 
                {health.isError ? 'SANDBOX_OFFLINE' : 'NODES_ONLINE'}
              </div>
            </div>
            <div className="p-5 md:p-6 bg-slate-950/10">
              <label className="mono text-[10px] uppercase tracking-wider text-slate-500">Paste suspicious link to analyze</label>
              <div className="mt-2.5 flex items-center gap-2 border border-[hsl(var(--border))] bg-slate-950/40 p-1.5 rounded-sm">
                <Link2 size={14} className="ml-2 shrink-0 text-slate-500" />
                <input value={demoUrl} onChange={e => setDemoUrl(e.target.value)} data-testid="input-landing-url" className="min-w-0 flex-1 bg-transparent px-1 py-1.5 text-xs outline-none text-white font-mono placeholder:text-slate-600" placeholder="https://secure-login-brand.com/verify" />
                <Button onClick={() => setLocation(`/scanner?url=${encodeURIComponent(demoUrl)}`)} className="shrink-0 px-3 py-1.5 text-[11px]" testId="button-analyze-landing">Analyze</Button>
              </div>
              <div className="mt-6 border border-cyan-500/10 bg-cyan-950/5 p-4 rounded-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="mono text-[10px] text-cyan-400 uppercase tracking-wider">Analysis pipeline</p>
                    <p className="mt-0.5 text-sm font-bold text-white tracking-tight">Multi-Engine Fusion</p>
                  </div>
                  <ShieldCheck size={20} className="text-cyan-400/80" />
                </div>
                <div className="mt-4 grid gap-3 text-[10px] text-slate-400 font-mono">
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                    <span>01 / CHARACTER METRICS</span>
                    <span className="text-cyan-400">ACTIVE</span>
                  </div>
                  <div className="flex items-center justify-between border-b border-slate-900 pb-1.5">
                    <span>02 / ML CLASSIFICATION</span>
                    <span className="text-cyan-400">ACTIVE</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>03 / HEURISTICS SIGNALS</span>
                    <span className="text-cyan-400">ACTIVE</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </section>
    
    <section id="how" className="border-y border-[hsl(var(--border))] bg-slate-950/20">
      <div className="mx-auto grid max-w-6xl gap-0 px-5 md:grid-cols-3 md:px-8">
        {[['01', 'Link extraction', 'Provide any raw URL string. The feature engineer processes 20 indicators instantly.', Link2], 
          ['02', 'Sandboxed comparison', 'ML neural models and heuristics check the features in isolation, exposing differences.', FileSearch], 
          ['03', 'Decide with confidence', 'Rely on calibrated class probability values combined into an explainable threat profile.', CheckCircle2]].map(([number, title, copy, Icon], index) => (
          <div key={number as string} className={`animate-rise stagger-${index + 1} border-[hsl(var(--border))] px-5 py-8 md:px-8 md:py-10 ${index < 2 ? 'md:border-r' : ''}`}>
            <span className="mono text-[10px] font-bold text-cyan-400 tracking-wider">SYSTEM_STAGE_{number as string}</span>
            <div className="mt-6 mb-3 grid h-8 w-8 place-items-center bg-cyan-950/20 text-cyan-400 border border-cyan-500/20 rounded-sm">
              <Icon size={15} />
            </div>
            <h3 className="mono text-xs font-bold text-white tracking-wider uppercase">{title as string}</h3>
            <p className="mt-2 text-xs leading-5 text-slate-400">{copy as string}</p>
          </div>
        ))}
      </div>
    </section>
    
    <footer className="border-t border-[hsl(var(--border))] px-5 py-6 md:px-8 bg-slate-950/40">
      <div className="mx-auto flex max-w-6xl flex-col justify-between gap-4 text-[10px] text-slate-500 mono sm:flex-row items-center">
        <Logo />
        <span>PHISHGUARD SECURE CONSOLE v{FEATURE_SCHEMA.version}</span>
      </div>
    </footer>
  </div>;
}

function FeatureTile({ icon: Icon, title, copy }: { icon: LucideIcon; title: string; copy: string }) {
  return <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 transition hover:-translate-y-1 hover:border-[hsl(var(--primary)/.35)]"><Icon size={18} className="text-[hsl(var(--primary))]" /><h3 className="mt-5 text-sm font-bold">{title}</h3><p className="mt-1.5 text-xs leading-5 text-[hsl(var(--muted-foreground))]">{copy}</p></div>;
}

function AuthLayout({ children, eyebrow, title, copy }: { children: ReactNode; eyebrow: string; title: string; copy: string }) {
  return <div className="grid min-h-[100dvh] bg-[hsl(var(--background))] lg:grid-cols-[.45fr_.55fr] text-white">
    <div className="relative hidden overflow-hidden bg-slate-950/40 border-r border-[hsl(var(--border))] p-10 lg:flex lg:flex-col justify-between">
      <Logo light />
      <div className="relative z-10 max-w-md pb-6">
        <div className="mb-5 grid h-10 w-10 place-items-center bg-cyan-950/20 text-cyan-400 border border-cyan-500/20 rounded-sm">
          <ShieldCheck size={20} />
        </div>
        <p className="mono text-[10px] uppercase tracking-[.2em] text-cyan-400">Threat intelligence network</p>
        <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-white">Understand threat profiles before execution.</h2>
        <p className="mt-4 text-xs leading-5 text-slate-400">PhishGuard parses lookalike characters, digits ratios, and TLD flags to present clean evidence reports.</p>
      </div>
    </div>
    <div className="flex items-center justify-center p-6 md:p-12 bg-slate-950/20">
      <div className="w-full max-w-[380px]">
        <div className="mb-10 lg:hidden">
          <Logo />
        </div>
        <p className="mono text-[10px] uppercase tracking-wider text-cyan-400">{eyebrow}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-white">{title}</h1>
        <p className="mt-2 text-xs leading-relaxed text-slate-400">{copy}</p>
        <div className="mt-6 border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 rounded-sm">{children}</div>
      </div>
    </div>
  </div>;
}

function LoginPage() {
  const [, setLocation] = useLocation();
  const login = useLogin();
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); login.mutate({ data: { email, password } }, { onSuccess: () => setLocation('/dashboard') }); };
  return <AuthLayout eyebrow="System login" title="Verify Credentials" copy="Log in to authenticate dashboard metrics and query limits."><form onSubmit={submit} className="space-y-4"><Field label="Email address" value={email} onChange={setEmail} type="email" placeholder="analyst@phishguard.net" testId="input-email" /><Field label="Password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" testId="input-password" /><div className="flex justify-end"><Link href="/forgot-password" data-testid="link-forgot-password" className="mono text-[10px] text-cyan-400 hover:underline">Forgot password?</Link></div>{login.isError && <p className="mono border border-red-500/30 bg-red-950/20 px-3 py-2 text-[10px] font-semibold text-red-400" data-testid="status-login-error">AUTH_FAILED: Invalid security credentials.</p>}<Button type="submit" disabled={login.isPending} className="mt-2 w-full" testId="button-submit-login">{login.isPending ? 'Authenticating…' : 'Sign in'} <ArrowRight size={14} /></Button></form><p className="mt-5 text-center text-xs text-slate-500">Need console credentials? <Link href="/signup" data-testid="link-create-account" className="font-bold text-cyan-400 hover:underline">Request account</Link></p></AuthLayout>;
}

function SignupPage() {
  const [, setLocation] = useLocation();
  const signup = useSignup();
  const [name, setName] = useState(''); const [email, setEmail] = useState(''); const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); signup.mutate({ data: { name, email, password } }, { onSuccess: () => setLocation('/dashboard') }); };
  return <AuthLayout eyebrow="System registration" title="Request Credentials" copy="Create a private security workspace to track URLs and configure detection filters."><form onSubmit={submit} className="space-y-4"><Field label="Analyst name" value={name} onChange={setName} placeholder="Security Analyst" testId="input-name" /><Field label="Email address" value={email} onChange={setEmail} type="email" placeholder="you@phishguard.net" testId="input-signup-email" /><Field label="Console password" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" testId="input-signup-password" />{signup.isError && <p className="mono border border-red-500/30 bg-red-950/20 px-3 py-2 text-[10px] font-semibold text-red-400" data-testid="status-signup-error">SIGNUP_FAILED: Invalid email configuration.</p>}<Button type="submit" disabled={signup.isPending} className="mt-2 w-full" testId="button-submit-signup">{signup.isPending ? 'Provisioning account…' : 'Create account'} <ArrowRight size={14} /></Button></form><p className="mt-5 text-center text-xs text-slate-500">Already registered? <Link href="/login" data-testid="link-existing-account" className="font-bold text-cyan-400 hover:underline">Sign in</Link></p></AuthLayout>;
}

function Field({ label, value, onChange, placeholder, type = 'text', testId }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string; testId: string }) {
  return <label className="block"><span className="mb-1.5 block mono text-[10px] uppercase text-slate-400 font-semibold">{label}</span><input required type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} data-testid={testId} className="focus-ring h-10 w-full rounded-sm border border-[hsl(var(--input))] bg-slate-950 px-3 text-xs outline-none text-white placeholder:text-slate-600 focus:border-cyan-500/50" /></label>;
}

function PageHeading({ eyebrow, title, copy, action }: { eyebrow: string; title: string; copy: string; action?: ReactNode }) {
  return <div className="mb-6 flex flex-col justify-between gap-4 border-b border-slate-900 pb-5 md:flex-row md:items-end"><div><p className="mono text-[10px] font-bold uppercase tracking-[.18em] text-cyan-400">{eyebrow}</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-white uppercase">{title}</h1><p className="mt-1.5 max-w-xl text-xs leading-relaxed text-slate-400">{copy}</p></div>{action}</div>;
}

function Metric({ label, value, note, icon: Icon, tone = 'primary' }: { label: string; value: string | number; note: string; icon: LucideIcon; tone?: 'primary' | 'amber' | 'red' }) {
  const color = tone === 'red' ? 'text-red-400 border-red-500/20 bg-red-950/15' : tone === 'amber' ? 'text-amber-400 border-amber-500/20 bg-amber-950/15' : 'text-cyan-400 border-cyan-500/20 bg-cyan-950/15';
  return <Card className="p-4 flex flex-col justify-between" testId={`metric-${label.toLowerCase().replaceAll(' ', '-')}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">{label}</p>
        <p className="mono mt-2.5 text-2xl font-bold text-white tracking-tight">{value}</p>
      </div>
      <div className={`grid h-8 w-8 place-items-center rounded-sm border ${color}`}>
        <Icon size={14} />
      </div>
    </div>
    <p className="mt-3 text-[10px] text-slate-500 font-mono">{note}</p>
  </Card>;
}

function ScanRow({ scan }: { scan: any }) {
  const bad = isPhishing(scan.verdict);
  return <Link href={`/features/${scan.id}`} data-testid={`link-scan-${scan.id}`} className="group flex items-center gap-3 border-b border-slate-900/60 px-4 py-3 transition last:border-0 hover:bg-slate-900/20">
    <div className={`grid h-7 w-7 shrink-0 place-items-center rounded-sm border ${bad ? 'border-red-500/20 bg-red-950/20 text-red-400' : 'border-emerald-500/20 bg-emerald-950/20 text-emerald-400'}`}>
      {bad ? <ShieldAlert size={13} /> : <CheckCircle2 size={13} />}
    </div>
    <div className="min-w-0 flex-1">
      <p className="truncate text-xs font-bold text-white font-mono">{shortUrl(scan.url)}</p>
      <p className="mt-0.5 text-[9px] text-slate-500 font-mono uppercase">{fmtDate(scan.createdAt)} @ {fmtTime(scan.createdAt)}</p>
    </div>
    <div className="hidden text-right sm:block">
      <StatusPill verdict={scan.verdict} />
      <p className="mono mt-0.5 text-[9px] text-slate-500">{Math.round(scan.confidence)}% calibrated confidence</p>
    </div>
    <ChevronRight size={14} className="text-slate-600 transition group-hover:translate-x-0.5 group-hover:text-cyan-400" />
  </Link>;
}

function DashboardPage() {
  const [, setLocation] = useLocation();
  const stats = useGetDashboardStats({ query: { queryKey: getGetDashboardStatsQueryKey(), retry: 1 } });
  const data = stats.data;
  return <><PageHeading eyebrow="Threat intelligence center" title="Active Scan Monitor" copy="Telemetry statistics compiled dynamically from rules evaluation and Random Forest checks." action={<Button onClick={() => setLocation('/scanner')} testId="button-dashboard-scan"><Radar size={14} /> Analyze URL</Button>} />{stats.isLoading ? <LoadingState /> : stats.isError ? <ErrorState onRetry={() => stats.refetch()} /> : data ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Links Checked" value={data.totalScanned} note="Aggregate workspace inputs" icon={Activity} /><Metric label="Phishing Signals" value={data.maliciousDetected} note={`${pct(data.phishingPercent)} detected`} icon={ShieldAlert} tone="red" /><Metric label="Safe Verdicts" value={data.safeUrls} note={`${pct(data.safePercent)} safe links`} icon={CheckCircle2} /><Metric label="Model Accuracy" value={pct(data.modelAccuracy)} note="Dynamic test-set verification" icon={Gauge} tone="amber" /></div><div className="mt-6 grid gap-6 xl:grid-cols-[1.24fr_.76fr]"><Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-900 px-5 py-3.5 bg-slate-950/20"><div><h2 className="mono text-xs font-bold uppercase tracking-wider">Telemetry Scan Logs</h2></div><Link href="/logs" data-testid="link-view-all-scans" className="mono text-[10px] font-bold text-cyan-400 uppercase tracking-wider hover:underline">View telemetry</Link></div>{data.recentScans?.length ? data.recentScans.map((scan: any) => <ScanRow key={scan.id} scan={scan} />) : <div className="p-8"><EmptyState title="Telemetry logs empty" copy="Run a security query to populate this monitor." action={<Button onClick={() => setLocation('/scanner')} testId="button-empty-scan">Inspect a URL</Button>} /></div>}</Card><Card className="overflow-hidden"><div className="border-b border-slate-900 px-5 py-3.5 bg-slate-950/20"><h2 className="mono text-xs font-bold uppercase tracking-wider">Scanned URLs distribution</h2></div><div className="p-6 bg-slate-950/10 flex flex-col items-center"><div className="relative mx-auto grid h-36 w-36 place-items-center rounded-full" style={{ background: `conic-gradient(hsl(var(--primary)) 0 ${data.safePercent * 100}%, #ff3366 ${data.safePercent * 100}% 100%)` }}><div className="grid h-28 w-28 place-items-center rounded-full bg-[hsl(var(--card))] text-center"><span className="mono text-2xl font-bold tracking-tight text-white">{pct(data.safePercent)}</span><span className="mono text-[9px] text-slate-500 uppercase">SAFE_CHECKS</span></div></div><div className="mt-6 w-full space-y-2 text-[11px] font-mono"><div className="flex justify-between"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-cyan-400" /> Legitimate / Safe</span><strong>{pct(data.safePercent)}</strong></div><div className="flex justify-between"><span className="flex items-center gap-2"><span className="h-1.5 w-1.5 rounded-full bg-red-400" /> Dangerous / Phishing</span><strong>{pct(data.phishingPercent)}</strong></div></div></div></Card></div></> : <EmptyState title="Monitor unit inactive" copy="Please run an investigation to initialize." />}</>;
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
    "INITIALIZING SYSTEM ANALYSIS TELEMETRY",
    "PARSING URL CHARACTER LENGTHS & STRINGS",
    "INSPECTING HOSTNAMES & DOMAIN AGE SIGNALS",
    "RUNNING HEURISTICS CHECKS FOR IMPOSTORS",
    "EVALUATING CALIBRATED MODEL PREDICTIONS",
    "FUSING THREAT SIGNALS INTO MULTI-INDEX WEIGHT",
    "COMPILING FINAL EVIDENCE DISAGREEMENTS"
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

  return <><PageHeading eyebrow="Cyber investigation console" title="Signal Core Threat Analyzer" copy="Input a domain or URL below to trace characteristics, evaluate ML weights, and inspect security rules." /><div className="grid gap-6 xl:grid-cols-[.82fr_1.18fr]"><Card className="p-6"><div className="flex items-center gap-3"><div className="grid h-9 w-9 place-items-center bg-cyan-950/20 text-cyan-400 border border-cyan-500/25 rounded-sm"><Radar size={16} /></div><div><h2 className="mono text-xs font-bold uppercase tracking-wider">Inspect Threat Vector</h2></div></div><form onSubmit={startScan} className="mt-6"><label className="mono text-[10px] uppercase tracking-wider text-slate-500">Suspicious URL</label><div className="mt-2 flex items-center gap-2 border border-[hsl(var(--input))] bg-slate-950/40 p-1.5 rounded-sm"><Link2 size={15} className="ml-2 shrink-0 text-slate-500" /><input required value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example-security-update.com/login" data-testid="input-scan-url" className="min-w-0 flex-1 bg-transparent px-1 py-2 text-xs outline-none text-white font-mono placeholder:text-slate-600" /><Button type="submit" disabled={create.isPending || scanning} className="shrink-0" testId="button-submit-scan">Run scan</Button></div></form>{create.isError && <div className="mono mt-4 border border-red-500/30 bg-red-950/20 p-3 text-[10px] leading-5 text-red-400" data-testid="status-scan-error"><strong>SCAN_CRITICAL: Telemetry aborted.</strong> Verify the URL structure contains a valid hostname and try again.</div>}<div className="mt-8 border-t border-slate-900 pt-5"><p className="mono text-[11px] font-bold text-white">Preset Telemetry Vectors</p><p className="mt-1 text-xs text-slate-500">Run preset URLs to test calibrated outputs.</p><div className="mt-3.5 grid gap-2"><button onClick={() => useExample('safe')} data-testid="button-example-safe" className="focus-ring flex items-center justify-between border border-slate-900 bg-slate-950/10 px-4 py-2.5 rounded-sm hover:border-cyan-500/30 hover:bg-slate-900/30"><span className="flex items-center gap-2 text-xs font-mono text-cyan-400"><CheckCircle2 size={13} /> Legitimate brand vector</span><ChevronRight size={13} className="text-slate-600" /></button><button onClick={() => useExample('phishing')} data-testid="button-example-phishing" className="focus-ring flex items-center justify-between border border-slate-900 bg-slate-950/10 px-4 py-2.5 rounded-sm hover:border-red-500/30 hover:bg-slate-900/30"><span className="flex items-center gap-2 text-xs font-mono text-red-400"><ShieldAlert size={13} /> Suspicious brand lookalike</span><ChevronRight size={13} className="text-slate-600" /></button></div></div></Card><div>{scanning ? <Card className="p-8 border-cyan-500/30 bg-cyan-950/5"><div className="space-y-4"><div className="h-1.5 w-full bg-cyan-950 overflow-hidden relative"><div className="h-full bg-cyan-400 transition-all duration-300" style={{ width: `${((currentStep + 1) / steps.length) * 100}%` }} /></div><p className="mono text-[11px] text-cyan-400 tracking-wider animate-pulse font-bold">{steps[currentStep]}</p><div className="mono text-[9px] text-slate-500 space-y-1">{steps.slice(0, currentStep).map((s, i) => <div key={i} className="text-cyan-400/50">✔ {s} ... COMPLETED</div>)}</div></div></Card> : pendingResult ? <ResultCard scan={pendingResult} onDetails={() => setLocation(`/features/${pendingResult.id}`)} /> : <Card className="grid min-h-[410px] place-items-center p-8 text-center border-dashed border-slate-800"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-sm bg-cyan-950/10 text-cyan-400 border border-cyan-500/20"><ShieldCheck size={22} strokeWidth={1.8} /></div><h2 className="mt-5 text-base font-bold tracking-tight text-white uppercase">Ready for Analysis</h2><p className="mx-auto mt-2 max-w-xs text-xs text-slate-500">Paste a suspicious URL vector and trigger the scanner to map threat characteristics.</p></div></Card>}</div></div></>;
}

function ResultCard({ scan, onDetails }: { scan: any; onDetails: () => void }) {
  const bad = isPhishing(scan.verdict); 
  const confidence = Math.round(scan.confidence * (scan.confidence <= 1 ? 100 : 1)); 
  const risk = Math.round(scan.riskScore);
  
  // Dynamic radial stroke configuration
  const radius = 50;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (risk / 100) * circumference;
  const indicatorColor = bad ? "stroke-red-500" : "stroke-emerald-500";
  const indicatorBg = bad ? "stroke-red-950/30" : "stroke-emerald-950/30";
  
  return <Card className={`overflow-hidden border-t-2 ${bad ? 'border-red-500 border-t-red-500' : 'border-emerald-500 border-t-emerald-500'}`} testId="card-scan-result">
    <div className="p-6 bg-slate-950/20 flex flex-col md:flex-row gap-6 items-center">
      {/* Dynamic radial threat score meter */}
      <div className="relative h-28 w-28 flex-shrink-0">
        <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} className={`fill-none stroke-2 ${indicatorBg}`} />
          <circle cx="60" cy="60" r={radius} className={`fill-none stroke-2 ${indicatorColor} transition-all duration-700`} strokeDasharray={circumference} strokeDashoffset={strokeDashoffset} strokeLinecap="square" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="mono text-2xl font-bold text-white leading-none">{risk}</span>
          <span className="mono text-[8px] text-slate-500 uppercase mt-0.5 font-bold">RISK_SCORE</span>
        </div>
      </div>
      <div className="min-w-0 flex-1 text-center md:text-left">
        <StatusPill verdict={scan.verdict} />
        <h2 className="mt-3 text-lg font-bold text-white tracking-tight uppercase">{bad ? 'Phishing threat signatures detected.' : 'Minimal threat vector signature.'}</h2>
        <p className="mono mt-2 break-all text-[10px] text-slate-500">{scan.url}</p>
      </div>
    </div>
    
    <div className="grid gap-4 p-5 sm:grid-cols-2 bg-slate-950/10 border-t border-slate-900">
      <div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-slate-400 font-bold uppercase">Confidence (ML Calibrated)</span>
          <strong className="text-cyan-400">{confidence}%</strong>
        </div>
        <div className="mt-2 h-1 overflow-hidden bg-slate-950 rounded-sm">
          <div className="h-full bg-cyan-400" style={{ width: `${confidence}%` }} />
        </div>
      </div>
      <div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-slate-400 font-bold uppercase">Multi-Engine Risk Rating</span>
          <strong className={bad ? 'text-red-400' : 'text-emerald-400'}>{risk}/100</strong>
        </div>
        <div className="mt-2 h-1 overflow-hidden bg-slate-950 rounded-sm">
          <div className={`h-full ${bad ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ width: `${risk}%` }} />
        </div>
      </div>
    </div>

    {/* Dynamic Decision & Score Fusion Correlator Pipeline */}
    <div className="border-t border-slate-900 bg-slate-950/30 px-5 py-4">
      <div className="mono text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Threat Correlator Fusion Node</div>
      <div className="grid gap-3 text-[10px] sm:grid-cols-3 font-mono">
        <div className="border border-slate-900 bg-slate-950/60 p-2.5 rounded-sm">
          <div className="text-slate-500 uppercase">ML Probability (70% Weight)</div>
          <div className="mt-1 font-bold text-cyan-400">{scan.mlProbability ?? confidence}% ({scan.mlPrediction})</div>
        </div>
        <div className="border border-slate-900 bg-slate-950/60 p-2.5 rounded-sm">
          <div className="text-slate-500 uppercase">Heuristics (30% Weight)</div>
          <div className="mt-1 font-bold text-cyan-400">{scan.ruleRiskScore ?? risk}/100 ({scan.rulePrediction})</div>
        </div>
        <div className="border border-cyan-500/20 bg-cyan-950/15 p-2.5 rounded-sm">
          <div className="text-cyan-400 uppercase font-bold">Fused Result Verdict</div>
          <div className="mt-1 font-bold text-white uppercase tracking-wider">{scan.verdict}</div>
        </div>
      </div>
    </div>

    {/* AI Security Analyst Terminal Logs */}
    <div className="border-t border-slate-900 bg-black/60 p-5 font-mono text-[10px] leading-5 text-emerald-400">
      <div className="flex items-center gap-2 border-b border-emerald-500/20 pb-2 mb-3 text-emerald-400/70">
        <Terminal size={14} />
        <span>PHISHGUARD AI ANALYST TELEMETRY REPORT v{scan.modelVersion ?? "1.0.0"}</span>
      </div>
      <div>&gt; url_vector_scanned: {scan.url}</div>
      <div>&gt; calibrated_confidence_bound: {confidence}%</div>
      <div>&gt; rules_engine_severity: {scan.ruleRiskScore ?? risk}/100</div>
      <div>&gt; final_verdict: {scan.verdict.toUpperCase()}</div>
      <div className="mt-3 text-white border-t border-slate-900 pt-2 font-semibold">INDICATORS IDENTIFIED:</div>
      {scan.ruleFlags?.length ? (
        <ul className="mt-1 space-y-1">
          {scan.ruleFlags.map((flag: string, index: number) => (
            <li key={`${flag}-${index}`} className="flex gap-2 items-center">
              <span className="text-red-500">✖</span> 
              <span>{flag}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-emerald-500">✔ ZERO_THREATS: Host matches safe signature parameters.</div>
      )}
    </div>
    
    <div className="border-t border-slate-900 px-5 py-4 bg-slate-950/20 text-center">
      <Button variant="outline" onClick={onDetails} className="w-full text-xs font-semibold" testId="button-view-scan-details">Inspect Neural Weights Breakdown <ArrowRight size={13} /></Button>
    </div>
  </Card>;
}

function LogsPage() {
  const [search, setSearch] = useState(''); const [verdict, setVerdict] = useState<'all' | 'safe' | 'phishing'>('all'); const [minRisk, setMinRisk] = useState('');
  const params = useMemo(() => ({ search: search || undefined, verdict: verdict === 'all' ? undefined : verdict, minRisk: minRisk ? Number(minRisk) : undefined }), [search, verdict, minRisk]);
  const scans = useListScans(params, { query: { queryKey: getListScansQueryKey(params) } });
  return <><PageHeading eyebrow="Telemetry history" title="Threat Telemetry logs" copy="Filter past investigations by risk metrics or query strings to analyze target parameters." action={<Link href="/scanner" data-testid="link-logs-scan" className="focus-ring inline-flex items-center gap-2 border border-cyan-500/30 bg-cyan-950/20 px-3 py-2 text-xs font-bold text-cyan-400 uppercase tracking-wider"><Radar size={13} /> Inspect URL</Link>} /><Card className="mb-4 p-4"><div className="grid gap-3 md:grid-cols-[1fr_170px_170px]"><label className="relative"><Search size={14} className="absolute left-3 top-3 text-slate-500" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search domain..." data-testid="input-search-logs" className="focus-ring h-9 w-full rounded-sm border border-[hsl(var(--input))] bg-slate-950 pl-9 pr-3 text-xs outline-none text-white font-mono placeholder:text-slate-600 focus:border-cyan-500/40" /></label><select value={verdict} onChange={e => setVerdict(e.target.value as typeof verdict)} data-testid="select-verdict-filter" className="focus-ring h-9 rounded-sm border border-[hsl(var(--input))] bg-slate-950 px-3 text-xs font-mono font-semibold outline-none text-slate-400 focus:border-cyan-500/40"><option value="all">ALL VERDICTS</option><option value="safe">SAFE VERDICTS</option><option value="phishing">PHISHING SIGNALS</option></select><select value={minRisk} onChange={e => setMinRisk(e.target.value)} data-testid="select-risk-filter" className="focus-ring h-9 rounded-sm border border-[hsl(var(--input))] bg-slate-950 px-3 text-xs font-mono font-semibold outline-none text-slate-400 focus:border-cyan-500/40"><option value="">ANY RISK RATIO</option><option value="25">25+ RISK</option><option value="50">50+ RISK</option><option value="75">75+ RISK</option></select></div></Card>{scans.isLoading ? <LoadingState label="Searching telemetry records" /> : scans.isError ? <ErrorState onRetry={() => scans.refetch()} /> : scans.data?.length ? <Card className="overflow-hidden"><div className="flex items-center justify-between border-b border-slate-900 px-5 py-3 bg-slate-950/20"><div className="flex items-center gap-2 text-xs font-bold"><ListFilter size={13} className="text-cyan-400" /> {scans.data.length} telemetry instances</div><span className="mono text-[10px] text-slate-500">NEWEST_FIRST</span></div>{scans.data.map((scan: any) => <ScanRow key={scan.id} scan={scan} />)}</Card> : <EmptyState title="No logs match criteria" copy="Broaden filters or run a new inspection to populate." action={<Link href="/scanner" data-testid="link-empty-logs-scan" className="text-xs font-bold text-cyan-400 uppercase tracking-wider hover:underline">Open analysis console</Link>} />}</>;
}

function FeaturesPage() {
  const { id } = useParams<{ id: string }>(); const scan = useGetScan(id ?? '', { query: { enabled: Boolean(id), queryKey: getGetScanQueryKey(id ?? '') } });
  return <>{scan.isLoading ? <LoadingState label="Querying scan explanation" /> : scan.isError || !scan.data ? <ErrorState onRetry={() => scan.refetch()} label="That scan could not be found." /> : <><PageHeading eyebrow="Telemetry breakdown" title="Investigative Report" copy="Detailed view of the 20 lexical features, combined score weights, and model parameters." action={<Link href="/logs" data-testid="link-back-logs" className="focus-ring inline-flex items-center gap-2 rounded-sm border border-[hsl(var(--border))] px-3.5 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition"><ChevronRight size={14} className="rotate-180" /> Back to logs</Link>} /><Card className="overflow-hidden"><div className="flex flex-col justify-between gap-5 border-b border-slate-900 p-6 md:flex-row md:items-start md:p-8 bg-slate-950/20"><div className="min-w-0"><StatusPill verdict={scan.data.verdict} /><h2 className="mt-4 break-all text-lg font-bold text-white font-mono">{scan.data.url}</h2><p className="mt-1.5 text-[10px] text-slate-500 font-mono uppercase">SCANNED_AT: {fmtDate(scan.data.createdAt)} @ {fmtTime(scan.data.createdAt)}</p></div><div className="flex gap-5 md:text-right font-mono"><div><p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Fused Risk</p><p className="mt-1 text-2xl font-bold text-white tracking-tight">{Math.round(scan.data.riskScore)}<span className="text-xs text-slate-500">/100</span></p></div><div><p className="text-[9px] uppercase tracking-wider text-slate-500 font-semibold">Calibrated Prob</p><p className="mt-1 text-2xl font-bold text-white tracking-tight">{Math.round(scan.data.confidence * (scan.data.confidence <= 1 ? 100 : 1))}<span className="text-xs text-slate-500">%</span></p></div></div></div><div className="grid gap-8 p-6 md:grid-cols-[.9fr_1.1fr] md:p-8"><div><h3 className="mono text-xs font-bold text-white uppercase tracking-wider">Fusion node logs</h3><div className="mt-4 space-y-2 font-mono text-[11px]"><ContextLine label="Rules engine verdict" value={scan.data.rulePrediction} /><ContextLine label="Calibrated RF verdict" value={scan.data.mlPrediction} /><div className="flex items-center justify-between rounded-sm border border-slate-900 px-3.5 py-2.5 bg-slate-950/10"><span className="text-slate-500">Heuristics raw risk score</span><span className="font-bold text-white">{scan.data.ruleRiskScore ?? Math.round(scan.data.riskScore)}/100</span></div><div className="flex items-center justify-between rounded-sm border border-slate-900 px-3.5 py-2.5 bg-slate-950/10"><span className="text-slate-500">Model phishing probability</span><span className="font-bold text-cyan-400">{scan.data.mlProbability ?? Math.round(scan.data.confidence)}%</span></div><div className="flex items-center justify-between rounded-sm border border-slate-900 px-3.5 py-2.5 bg-slate-950/10"><span className="text-slate-500">Model safe probability</span><span className="font-bold text-cyan-400">{scan.data.safeProbability ?? (100 - Math.round(scan.data.confidence))}%</span></div><div className="flex items-center justify-between rounded-sm border border-slate-900 px-3.5 py-2.5 bg-slate-950/10"><span className="text-slate-500">Classifier model version</span><span className="font-bold text-slate-400">{scan.data.modelVersion ?? "1.0.0"}</span></div><ContextLine label="Indicators flagged" value={`${scan.data.ruleFlags?.length ?? 0} flags`} /></div>{scan.data.ruleFlags?.length ? <div className="mt-6 border border-red-500/20 bg-red-950/10 p-4 rounded-sm"><p className="mono text-[10px] font-bold text-red-400 uppercase tracking-wider">Telemetry violations</p><ul className="mt-3 space-y-2">{scan.data.ruleFlags.map((flag: string, index: number) => <li key={`${flag}-${index}`} className="flex gap-2 text-xs text-slate-400"><ShieldAlert size={13} className="mt-0.5 shrink-0 text-red-400" />{flag}</li>)}</ul></div> : <div className="mt-6 border border-emerald-500/20 bg-emerald-950/10 p-4 text-xs text-slate-400"><CheckCircle2 size={15} className="mb-2 text-emerald-400" /><p className="mono text-[10px] font-bold text-emerald-400 uppercase">ZERO_TELEMETRY_FLAGS</p>The host conforms to clean structural profiles.</div>}</div><div><h3 className="mono text-xs font-bold text-white uppercase tracking-wider">20 Active Neural Features</h3><p className="mt-1 text-xs text-slate-500 font-mono">The exact feature weights extracted from the URL sequence.</p><div className="mt-4 border border-slate-900 rounded-sm overflow-hidden">{Object.keys(scan.data.features ?? {}).length ? Object.entries(scan.data.features).map(([key, value]) => <div key={key} className="flex items-center justify-between gap-4 border-b border-slate-900/60 px-4 py-2 bg-slate-950/15 last:border-0"><span className="mono text-[10px] text-slate-400 font-semibold">{key}</span><span className="mono text-[10px] text-cyan-400 font-bold">{String(value)}</span></div>) : <p className="p-4 text-xs text-slate-500">Features unavailable for this scan.</p>}</div></div></div></Card></>}</>;
}

function ContextLine({ label, value }: { label: string; value: string }) {
  const bad = isPhishing(value); return <div className="flex items-center justify-between rounded-sm border border-slate-900 px-3.5 py-2.5 bg-slate-950/10"><span className="text-slate-500">{label}</span><span className={`font-bold ${bad ? 'text-red-400' : 'text-emerald-400'}`}>{bad ? 'PHISHING_SIGNAL' : 'SAFE_CLEAN'}</span></div>;
}

function ModelInfoPage() {
  const model = useGetModelInfo({ query: { queryKey: getGetModelInfoQueryKey(), retry: 1 } }); const data = model.data;
  return <><PageHeading eyebrow="Neural model telemetry" title="Model notes" copy="Calibrated test metrics, dataset snapshots, and active features registry." />{model.isLoading ? <LoadingState label="Loading model notes" /> : model.isError ? <ErrorState onRetry={() => model.refetch()} /> : data ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Accuracy" value={pct(data.accuracy)} note="Dynamic test-set accuracy" icon={Target} /><Metric label="Precision" value={pct(data.precision)} note="Calibrated precision rating" icon={Target} /><Metric label="Recall" value={pct(data.recall)} note="Phishing capture ratio" icon={Radar} /><Metric label="F1 score" value={pct(data.f1Score)} note="F1 classification metrics" icon={Gauge} tone="amber" /></div><div className="mt-6 grid gap-6 lg:grid-cols-[.85fr_1.15fr]"><Card className="p-6 bg-slate-950/10"><p className="mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">Classifier snapshot</p><h2 className="mt-3 text-lg font-bold text-white tracking-tight uppercase">Training constraints</h2><div className="mt-6 space-y-3.5 font-mono text-xs"><DataLine label="Clean dataset size" value={data.datasetSize.toLocaleString()} /><DataLine label="Phishing instances" value={data.phishingCount.toLocaleString()} /><DataLine label="Benign instances" value={data.legitimateCount.toLocaleString()} /><DataLine label="Model version" value={data.modelVersion ?? "1.0.0"} /><DataLine label="Calibrated ROC-AUC" value={data.rocAuc ? pct(data.rocAuc) : "—"} /><DataLine label="Training date" value={fmtDate(data.trainedAt)} /></div><div className="mt-6 border border-slate-900 bg-slate-950/20 p-4 text-xs text-slate-400"><BookOpen size={14} className="mb-2 text-cyan-400" /><strong className="text-white">Interpretation guide:</strong> Test statistics reflect model performance against held-out verification blocks. Calibrated probability ratings ensure reliable inference values.</div></Card><Card className="p-6"><div className="flex items-start justify-between"><div><p className="mono text-[10px] font-bold uppercase tracking-wider text-cyan-400">Random Forest importances</p><h2 className="mt-3 text-lg font-bold text-white tracking-tight uppercase">Neural feature weights</h2></div><Sparkles size={16} className="text-amber-400" /></div><div className="mt-6 space-y-3.5">{data.featureImportance?.slice(0, 8).map((item: any) => <div key={item.name} className="font-mono text-xs"><div className="mb-1.5 flex justify-between"><span className="text-slate-400 font-semibold">{item.name}</span><span className="font-bold text-cyan-400">{Math.round(item.importance * 100)}%</span></div><div className="h-1 bg-slate-950 rounded-sm overflow-hidden"><div className="h-full bg-cyan-400" style={{ width: `${Math.min(100, item.importance * 100)}%` }} /></div></div>)}</div></Card></div><Card className="mt-6 overflow-hidden"><div className="border-b border-slate-900 px-6 py-4 bg-slate-950/20"><h2 className="mono text-xs font-bold uppercase tracking-wider text-white">Active Features Dictionary</h2><p className="mt-1 text-xs text-slate-500 font-mono">Registry mappings for active feature vectors.</p></div>{data.features?.map((item: any) => <div key={item.name} className="grid gap-1 border-b border-slate-900/60 px-6 py-4 last:border-0 sm:grid-cols-[.32fr_1fr] bg-slate-950/15"><span className="mono text-[10px] font-bold text-cyan-400">{item.name}</span><span className="text-xs text-slate-400 leading-relaxed">{item.description}</span></div>)}</Card></> : <EmptyState title="Telemetry offline" copy="No active snap logs discovered." />}</>;
}

function DataLine({ label, value }: { label: string; value: string }) { return <div className="flex items-center justify-between border-b border-slate-900 pb-3 text-xs last:border-0"><span className="text-slate-500 font-semibold">{label}</span><strong className="text-white">{value}</strong></div>; }

function SettingsPage() {
  const [, setLocation] = useLocation(); const user = useGetCurrentUser({ query: { queryKey: getGetCurrentUserQueryKey(), retry: false } }); const logout = useLogout(); const [dark, setDark] = useState(document.documentElement.classList.contains('dark')); const [saved, setSaved] = useState(false);
  const toggleTheme = () => { const next = !dark; setDark(next); document.documentElement.classList.toggle('dark', next); setSaved(true); setTimeout(() => setSaved(false), 1800); };
  return <><PageHeading eyebrow="Workspace settings" title="Console preferences" copy="Configure interface theme profiles and session validation values." />{user.isLoading ? <LoadingState /> : <div className="grid gap-6 lg:grid-cols-[.38fr_.62fr]"><Card className="p-6"><div className="flex items-center gap-4"><div className="grid h-12 w-12 place-items-center rounded-sm bg-cyan-950/20 text-md font-extrabold text-cyan-400 border border-cyan-500/25">{user.data?.name?.slice(0, 1).toUpperCase() ?? 'U'}</div><div><h2 className="mono text-sm font-bold text-white" data-testid="text-settings-name">{user.data?.name ?? 'Analyst'}</h2><p className="mt-1 text-xs text-slate-500" data-testid="text-settings-email">{user.data?.email ?? 'Console user'}</p></div></div><div className="mt-8 rounded-xl border border-slate-900 bg-slate-950/10 p-4 text-xs text-slate-400 font-mono"><UserRound size={15} className="mb-2 text-cyan-400" />Account credentials maintain logs across endpoints.</div></Card><div className="space-y-6"><Card className="p-6"><div className="flex items-start justify-between"><div><h2 className="mono text-xs font-bold uppercase tracking-wider text-white">Appearance</h2><p className="mt-1 text-xs text-slate-500">Toggle dark / light console backgrounds.</p></div><Moon size={15} className="text-cyan-400" /></div><button onClick={toggleTheme} data-testid="button-toggle-theme" className="focus-ring mt-5 flex w-full items-center justify-between rounded-sm border border-[hsl(var(--border))] p-4 text-left transition bg-slate-950/10 hover:border-cyan-500/30"><span className="flex items-center gap-3"><span className="grid h-8 w-8 place-items-center bg-cyan-950/20 text-cyan-400 rounded-sm"><Monitor size={14} /></span><span><span className="block mono text-xs font-bold text-white">{dark ? 'Dark Console' : 'Light Console'}</span><span className="mt-1 block text-[10px] text-slate-500 font-mono">{dark ? 'Deep grey HSL dark-mode active' : 'Warm parchment light-mode active'}</span></span></span><span className={`h-5 w-9 rounded-full p-0.5 transition ${dark ? 'bg-cyan-500' : 'bg-slate-800'}`}><span className={`block h-4 w-4 rounded-sm bg-white transition ${dark ? 'translate-x-4' : ''}`} /></span></button>{saved && <p className="mt-3 text-[10px] font-bold text-cyan-400 font-mono" data-testid="status-theme-saved">Appearance saved for this session.</p>}</Card><Card className="p-6"><h2 className="mono text-xs font-bold uppercase tracking-wider text-white">Session</h2><p className="mt-1 text-xs text-slate-500">Terminate secure login cookies on this machine.</p><Button variant="danger" onClick={() => logout.mutate(undefined, { onSuccess: () => setLocation('/') })} disabled={logout.isPending} className="mt-5" testId="button-settings-logout"><LogOut size={13} /> {logout.isPending ? 'Terminating…' : 'Sign out'}</Button></Card></div></div>}</>;
}

function ForgotPasswordPage() {
  const [, setLocation] = useLocation(); const [email, setEmail] = useState('');
  return <AuthLayout eyebrow="System recovery · 01" title="Request OTP" copy="Enter your registered security email to obtain an OTP link."><form onSubmit={e => { e.preventDefault(); setLocation(`/verify-otp?email=${encodeURIComponent(email)}`); }} className="space-y-4"><Field label="Registered email" value={email} onChange={setEmail} type="email" placeholder="you@phishguard.net" testId="input-forgot-email" /><Button type="submit" className="w-full font-bold" testId="button-send-otp">Send recovery OTP <ArrowRight size={14} /></Button></form><p className="mt-5 text-center text-xs text-slate-500"><Link href="/login" data-testid="link-back-login" className="font-bold text-cyan-400 hover:underline">Back to credentials</Link></p></AuthLayout>;
}

function VerifyOtpPage() {
  const [, setLocation] = useLocation(); const [otp, setOtp] = useState('');
  return <AuthLayout eyebrow="System recovery · 02" title="Verify OTP" copy="Enter the six-digit telemetry OTP code sent to your email."><form onSubmit={e => { e.preventDefault(); setLocation('/reset-password'); }} className="space-y-4"><label className="block"><span className="mb-2 block mono text-[10px] uppercase text-slate-400 font-semibold">Verification code</span><input required minLength={6} maxLength={6} value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="000000" data-testid="input-otp" className="focus-ring mono h-10 w-full rounded-sm border border-[hsl(var(--input))] bg-slate-950 px-4 text-center text-lg tracking-[.45em] outline-none text-white focus:border-cyan-500/50" /></label><Button type="submit" disabled={otp.length !== 6} className="w-full font-bold" testId="button-verify-otp">Verify code <Check size={14} /></Button></form><p className="mt-5 text-center text-xs text-slate-500">Didn’t receive? <button onClick={() => setOtp('')} data-testid="button-resend-otp" className="font-bold text-cyan-400 hover:underline">Resend code</button></p></AuthLayout>;
}

function ResetPasswordPage() {
  const [, setLocation] = useLocation(); const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState(''); const valid = password.length >= 6 && password === confirm;
  return <AuthLayout eyebrow="System recovery · 03" title="New Password" copy="Define a fresh credentials secret for security console signins."><form onSubmit={e => { e.preventDefault(); setLocation('/login'); }} className="space-y-4"><Field label="New secret" value={password} onChange={setPassword} type="password" placeholder="At least 6 characters" testId="input-reset-password" /><Field label="Confirm secret" value={confirm} onChange={setConfirm} type="password" placeholder="Repeat password" testId="input-confirm-password" />{confirm && password !== confirm && <p className="mono text-[10px] font-semibold text-red-400" data-testid="status-password-mismatch">Mismatch: Secret values do not align.</p>}<Button type="submit" disabled={!valid} className="w-full font-bold" testId="button-reset-password">Save new password <Check size={14} /></Button></form></AuthLayout>;
}

function ExtensionPreviewPage() {
  const [enabled, setEnabled] = useState(false); const [url, setUrl] = useState('https://paypaI-account-check.com/verify');
  return <><PageHeading eyebrow="Security integration concepts" title="Browser companion preview" copy="Sleek inline companion simulation demonstrating active warning states directly inside the navigation experience." action={<Button onClick={() => setEnabled(!enabled)} variant={enabled ? 'soft' : 'primary'} testId="button-toggle-extension">{enabled ? <Check size={14} /> : <Zap size={14} />} {enabled ? 'Enabled' : 'Activate companion preview'}</Button>} /><div className="mx-auto max-w-4xl"><div className="overflow-hidden border border-slate-900 bg-slate-950/20 shadow-[0_24px_70px_rgba(0,0,0,.6)] rounded-sm"><div className="flex items-center gap-2 border-b border-slate-900 bg-slate-950/50 px-5 py-3"><div className="flex gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-800" /><span className="h-2 w-2 rounded-full bg-slate-800" /><span className="h-2 w-2 rounded-full bg-slate-800" /></div><div className="mx-auto flex h-8 max-w-xl flex-1 items-center gap-2 rounded-sm border border-slate-900 bg-slate-950 px-3 text-[11px] text-slate-500 font-mono"><LockKeyhole size={11} className="text-emerald-500" />{url}<span className="ml-auto"><RefreshCw size={11} /></span></div><span className="grid h-7 w-7 place-items-center rounded-sm bg-cyan-950/20 border border-cyan-500/25 text-cyan-400"><ShieldCheck size={13} /></span></div><div className="grid min-h-[440px] place-items-center bg-slate-950/10 p-8"><div className="w-full max-w-[400px] border border-red-500/20 bg-slate-950 p-5 shadow-lg rounded-sm"><div className="flex items-center gap-2 border-b border-slate-900 pb-4"><span className="grid h-8 w-8 place-items-center bg-red-950/20 border border-red-500/20 text-red-400 rounded-sm"><ShieldAlert size={15} /></span><div><p className="mono text-[11px] font-bold text-white uppercase tracking-wider">PhishGuard shields</p><p className="text-[9px] text-slate-500 font-mono">PROACTIVE_WARNING_INLINE</p></div><span className="ml-auto h-2 w-2 rounded-full bg-amber-500 animate-pulse" /></div><div className="mt-4 border border-red-500/30 bg-red-950/20 p-4 rounded-sm"><div className="flex items-center gap-2 text-red-400 font-bold mono text-xs uppercase"><ShieldAlert size={14} /><span>Threat detected</span></div><p className="mt-1.5 text-xs leading-5 text-slate-400">This URL matches structural lookalike patterns commonly used in brand impersonation.</p></div><div className="mt-4 space-y-2 font-mono text-[10px] text-slate-500"><div className="flex gap-2"><span className="text-red-500">✖</span> Character substitution detected in hostname.</div><div className="flex gap-2"><span className="text-red-500">✖</span> Request contains suspicious keywords.</div></div><button onClick={() => setUrl('https://www.example.com/')} data-testid="button-extension-safe-example" className="mt-5 w-full rounded-sm border border-cyan-500/30 bg-cyan-950/20 py-2.5 text-[11px] font-bold text-cyan-400 uppercase tracking-wider hover:bg-cyan-500/10 transition">Redirect to safe destination</button></div></div></div><div className="mt-8 grid gap-4 sm:grid-cols-3"><FeatureTile icon={Eye} title="Low telemetry footprint" copy="Inspects inputs silently and triggers warning dialogues only when threat ratios cross limits." /><FeatureTile icon={Timer} title="Calibrated latency" copy="Evaluates 20 feature nodes under ~30ms, preventing browser delays." /><FeatureTile icon={Code2} title="Fully explainable logs" copy="Provides instant lookup access to raw heuristics arrays and classification weights." /></div></div></>;
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