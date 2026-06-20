"use client";

type QAModule = "cardiac-arrest" | "trauma";

type ProgramOption = {
  value: QAModule;
  label: string;
};

type StatItem = {
  label: string;
  value: string;
};

type AppHeaderProps = {
  activeModule: QAModule;
  moduleOptions: ProgramOption[];
  onModuleChange: (module: QAModule) => void;
  stats: StatItem[];
  onSignOut: () => void;
};

export function AppHeader({
  activeModule,
  moduleOptions,
  onModuleChange,
  stats,
  onSignOut,
}: AppHeaderProps) {
  const programLabel =
    activeModule === "cardiac-arrest" ? "Cardiac Arrest QA" : "Trauma QA";

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="flex items-center gap-3.5">
              <div className="brand-mark" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
              <div>
                <p className="brand-eyebrow">Clinical &amp; Operations QA</p>
                <h1 className="brand-title">EMS OpsQA</h1>
              </div>
            </div>

            <nav className="program-tabs" aria-label="QA programs">
              {moduleOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`program-tab ${activeModule === option.value ? "program-tab-active" : ""}`}
                  onClick={() => onModuleChange(option.value)}
                  aria-current={activeModule === option.value ? "page" : undefined}
                >
                  {option.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <p className="hidden text-sm text-white/60 md:block">{programLabel}</p>
            <button type="button" className="btn-header-ghost" onClick={onSignOut}>
              Sign out
            </button>
          </div>
        </div>

        {stats.length > 0 ? (
          <div className={`kpi-grid mt-5 ${stats.length >= 5 ? "kpi-grid-5" : ""}`}>
            {stats.map((stat) => (
              <div key={stat.label} className="stat-card">
                <p className="stat-card-label">{stat.label}</p>
                <p className="stat-card-value">{stat.value}</p>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </header>
  );
}
