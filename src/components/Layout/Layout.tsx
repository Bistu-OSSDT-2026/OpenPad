import type { ReactNode } from 'react';

interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.26em] text-signal">
              Open-source pad sampler
            </p>
            <h1 className="mt-1 text-3xl font-black tracking-normal text-white sm:text-4xl">
              OpenPad Lab
            </h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs text-neutral-300">
            <Status label="Pads" value="16" />
            <Status label="Steps" value="16" />
            <Status label="MVP" value="P0" />
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-line bg-panel px-3 py-2">
      <div className="text-[10px] uppercase text-neutral-500">{label}</div>
      <div className="text-base font-bold text-white">{value}</div>
    </div>
  );
}
