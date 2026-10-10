'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';

/** Navegación de presentación: no deriva progreso ni estado de la sesión. */
export function AppShell({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const courseMatch = /^\/materias\/([^/]+)(?:\/(clase|progreso))?$/.exec(pathname);
  const courseBase = courseMatch === null ? null : `/materias/${courseMatch[1]}`;
  const inClass = courseMatch?.[2] === 'clase';
  const inProgress = courseMatch?.[2] === 'progreso';

  return (
    <div className={`app-frame${inClass ? ' app-frame-class' : ''}`}>
      <a className="skip-content" href="#contenido">Saltar al contenido</a>
      {!inClass && (
        <aside className="app-sidebar" aria-label="Navegación principal">
          <a className="app-brand" href="/" aria-label="Profesor IA — Inicio">
            <span className="app-brand-mark" aria-hidden="true">p.</span>
            <span>profesor<span className="brand-ia">ia</span><small>Tu espacio de aprendizaje</small></span>
          </a>
          <p className="nav-caption">ESTUDIAR</p>
          <nav className="app-nav" aria-label="Principal">
            <a href="/" aria-current={pathname === '/' ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 10 9-7 9 7v10H3V10Zm6 10v-7h6v7" /></svg>
              Inicio
            </a>
            <a href="/materias" aria-current={pathname.startsWith('/materias') ? 'page' : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v16M3 3l9 2 9-2v16l-9 2-9-2V3Z" /></svg>
              Mis materias
            </a>
          </nav>
          <div className="sidebar-bottom"><span className="local-dot" aria-hidden="true" /> Aplicación local</div>
        </aside>
      )}
      <div className="app-content">
        <header className="app-topbar">
          {inClass ? (
            <><a href={courseBase ?? '/materias'} className="back-link">← Volver a la materia</a><span className="topbar-context">Espacio de clase</span></>
          ) : (
            <><span className="topbar-context">Mi espacio / {pathname === '/' ? 'Inicio' : 'Mis materias'}</span><span className="topbar-note">Aprende a tu ritmo</span></>
          )}
        </header>
        <div id="contenido" tabIndex={-1}>
          {courseBase !== null && !inClass && (
            <nav className="course-nav" aria-label="Dentro de la materia">
              <a href="/materias">← Mis materias</a>
              <a href={courseBase} aria-current={!inProgress ? 'page' : undefined}>Resumen</a>
              <a href={`${courseBase}/progreso`} aria-current={inProgress ? 'page' : undefined}>Progreso</a>
            </nav>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
