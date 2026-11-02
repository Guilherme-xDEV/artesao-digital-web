import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { Campo } from '../components/Campo'

const esquema = z.object({
  email: z.email('Informe um e-mail válido'),
  senha: z.string().min(6, 'A senha tem pelo menos 6 caracteres'),
})
type Dados = z.infer<typeof esquema>

export function mensagemErroAuth(e: unknown) {
  const codigo = (e as { code?: string })?.code ?? ''
  if (['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(codigo))
    return 'E-mail ou senha incorretos.'
  if (codigo === 'auth/email-already-in-use') return 'Este e-mail já está cadastrado.'
  if (codigo === 'auth/popup-closed-by-user') return 'Login com Google cancelado.'
  if (codigo === 'auth/too-many-requests') return 'Muitas tentativas. Tente novamente em instantes.'
  return 'Não foi possível concluir. Verifique sua conexão e tente de novo.'
}

export default function Login() {
  const { user, entrar, entrarComGoogle } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const destino = (location.state as { de?: string } | null)?.de ?? '/dashboard'
  const [erro, setErro] = useState('')
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(esquema) })

  if (user) return <Navigate to={destino} replace />

  return (
    <div className="grid min-h-full place-items-center bg-taua-red px-5 py-10">
      <div className="w-full max-w-md rounded-[28px] bg-craft-surface p-8 shadow-xl">
        <h1 className="text-3xl font-bold text-taua-red">Artesão Digital</h1>
        <p className="mt-1 mb-6 text-wood">Centro de Artesanato de Tauá</p>

        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async ({ email, senha }) => {
            setErro('')
            try {
              await entrar(email, senha)
              navigate(destino, { replace: true })
            } catch (e) {
              setErro(mensagemErroAuth(e))
            }
          })}
        >
          <Campo rotulo="E-mail" type="email" autoComplete="email" erro={errors.email?.message} {...register('email')} />
          <Campo rotulo="Senha" type="password" autoComplete="current-password" erro={errors.senha?.message} {...register('senha')} />
          {erro && <p role="alert" className="text-sm text-taua-red">{erro}</p>}
          <button
            disabled={isSubmitting}
            className="rounded-full bg-taua-red px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            Entrar
          </button>
        </form>

        <button
          type="button"
          onClick={async () => {
            setErro('')
            try {
              await entrarComGoogle()
              navigate(destino, { replace: true })
            } catch (e) {
              setErro(mensagemErroAuth(e))
            }
          }}
          className="mt-3 w-full rounded-full border border-wood/50 px-5 py-3 font-semibold"
        >
          Entrar com Google
        </button>

        <p className="mt-6 text-center text-sm">
          Ainda não tem conta?{' '}
          <Link to="/cadastro" className="font-semibold text-taua-red underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  )
}
