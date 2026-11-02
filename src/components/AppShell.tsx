import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { clsx } from 'clsx'

const links = [
  { to: '/dashboard', rotulo: 'Início' },
  { to: '/produtos', rotulo: 'Produtos' },
  { to: '/vendas/nova', rotulo: 'Nova venda' },
  { to: '/vendas/historico', rotulo: 'Histórico' },
  { to: '/perfil', rotulo: 'Perfil' },
]

export function AppShell() {
  const { artesao, user } = useAuth()
  const [aberto, setAberto] = useState(false)
  const nome = artesao?.nome || user?.displayName || 'artesão'
  const inicial = nome.charAt(0).toUpperCase()

  return (
    <div className="flex min-h-full flex-col bg-taua-red">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-3 px-5 pt-5 pb-6 text-white">
        <NavLink
          to="/perfil"
          aria-label="Abrir perfil"
          className="grid size-10 place-items-center rounded-full bg-white/20 font-display text-lg font-bold"
        >
          {inicial}
        </NavLink>
        <p className="flex-1 text-sm text-white/85">Olá, {nome}</p>
        <button
          type="button"
          className="rounded-full bg-white/15 px-3 py-1.5 text-sm md:hidden"
          aria-expanded={aberto}
          onClick={() => setAberto((v) => !v)}
        >
          Menu
        </button>
        <nav
          className={clsx(
            'absolute top-16 right-5 z-10 flex-col gap-1 rounded-2xl bg-craft-surface p-2 text-wood-dark shadow-lg',
            aberto ? 'flex' : 'hidden',
            'md:static md:flex md:flex-row md:bg-transparent md:p-0 md:text-white md:shadow-none',
          )}
        >
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              onClick={() => setAberto(false)}
              className={({ isActive }) =>
                clsx(
                  'rounded-full px-4 py-2 text-sm font-medium',
                  isActive ? 'bg-taua-red-light text-taua-red-dark md:bg-white/25 md:text-white' : 'md:hover:bg-white/15',
                )
              }
            >
              {l.rotulo}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="flex-1 rounded-t-[32px] bg-craft-bg">
        <div className="mx-auto w-full max-w-5xl px-5 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
