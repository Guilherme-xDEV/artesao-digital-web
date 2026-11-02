import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Campo } from '../components/Campo'
import { mascararTelefone } from '../lib/format'

function validarTelefone(valor: string): boolean {
  return [10, 11].includes(valor.replace(/\D/g, '').length)
}

export default function Perfil() {
  const { user, artesao, atualizarPerfil, sair } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [telefone, setTelefone] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')

  useEffect(() => {
    setNome(artesao?.nome ?? user?.displayName ?? '')
    setTelefone(artesao?.telefone ?? '')
  }, [artesao?.nome, artesao?.telefone, user?.displayName])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    setSucesso('')

    const nomeLimpo = nome.trim()
    if (nomeLimpo.length < 3) {
      setErro('Informe um nome com pelo menos 3 caracteres.')
      return
    }
    if (!validarTelefone(telefone)) {
      setErro('Informe um telefone válido com DDD.')
      return
    }

    setSalvando(true)
    try {
      await atualizarPerfil({ nome: nomeLimpo, telefone })
      setSucesso('Seus dados foram atualizados.')
    } catch {
      setErro('Não foi possível atualizar seu perfil. Verifique sua conexão e tente novamente.')
    } finally {
      setSalvando(false)
    }
  }

  async function handleSair() {
    try {
      await sair()
      navigate('/login', { replace: true })
    } catch {
      setErro('Não foi possível encerrar a sessão. Tente novamente.')
    }
  }

  return (
    <section className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-wood">Sua conta</p>
      <h1 className="mt-1 text-3xl font-bold text-wood-dark">Meu perfil</h1>
      <p className="mt-2 text-sm text-wood">
        Mantenha seus dados de contato atualizados no Centro de Artesanato de Tauá.
      </p>

      <div className="mt-7 rounded-3xl border border-wood/15 bg-white p-6 shadow-sm sm:p-7">
        <div className="flex items-center gap-4 border-b border-wood/10 pb-6">
          <div className="grid size-14 shrink-0 place-items-center rounded-full bg-taua-red-light font-display text-2xl font-bold text-taua-red-dark">
            {(nome || user?.email || 'A').charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate font-semibold">{nome || 'Artesão'}</p>
            <p className="truncate text-sm text-wood">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
          <Campo
            rotulo="Nome"
            name="nome"
            autoComplete="name"
            value={nome}
            onChange={(event) => setNome(event.target.value)}
            maxLength={100}
            required
          />
          <Campo
            rotulo="Telefone"
            name="telefone"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            placeholder="(88) 99999-9999"
            value={telefone}
            onChange={(event) => setTelefone(mascararTelefone(event.target.value))}
            required
          />

          {erro && (
            <p role="alert" className="rounded-xl bg-taua-red-light p-3 text-sm text-taua-red-dark">
              {erro}
            </p>
          )}
          {sucesso && (
            <p role="status" className="rounded-xl bg-leaf-light p-3 text-sm text-leaf-dark">
              {sucesso}
            </p>
          )}

          <button
            type="submit"
            disabled={salvando}
            className="rounded-full bg-taua-red px-6 py-3 text-sm font-semibold text-white hover:bg-taua-red-dark disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : 'Salvar alterações'}
          </button>
        </form>
      </div>

      <div className="mt-5 flex flex-col gap-3 rounded-3xl border border-wood/15 bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-bold">Encerrar sessão</h2>
          <p className="mt-1 text-sm text-wood">Saia da sua conta neste dispositivo.</p>
        </div>
        <button
          type="button"
          onClick={() => void handleSair()}
          className="rounded-full border border-taua-red/40 px-5 py-3 text-sm font-semibold text-taua-red hover:bg-taua-red-light"
        >
          Sair da conta
        </button>
      </div>
    </section>
  )
}
