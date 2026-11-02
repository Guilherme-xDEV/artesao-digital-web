import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '../auth/AuthContext'
import { Campo } from '../components/Campo'
import { mascararTelefone } from '../lib/format'
import { mensagemErroAuth } from './Login'

const esquema = z.object({
  nome: z.string().trim().min(3, 'Informe seu nome completo'),
  telefone: z.string().refine((v) => [10, 11].includes(v.replace(/\D/g, '').length), 'Telefone com DDD'),
  email: z.email('Informe um e-mail válido'),
  senha: z.string().min(6, 'A senha tem pelo menos 6 caracteres'),
})
type Dados = z.infer<typeof esquema>

export default function Cadastro() {
  const { user, cadastrar } = useAuth()
  const navigate = useNavigate()
  const [erro, setErro] = useState('')
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<Dados>({ resolver: zodResolver(esquema) })

  if (user) return <Navigate to="/dashboard" replace />

  return (
    <div className="grid min-h-full place-items-center bg-taua-red px-5 py-10">
      <div className="w-full max-w-md rounded-[28px] bg-craft-surface p-8 shadow-xl">
        <h1 className="mb-6 text-3xl font-bold text-taua-red">Criar conta de artesão</h1>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit(async (dados) => {
            setErro('')
            try {
              await cadastrar(dados)
              navigate('/dashboard', { replace: true })
            } catch (e) {
              setErro(mensagemErroAuth(e))
            }
          })}
        >
          <Campo rotulo="Nome" autoComplete="name" erro={errors.nome?.message} {...register('nome')} />
          <Campo
            rotulo="Telefone"
            type="tel"
            inputMode="numeric"
            placeholder="(88) 99999-9999"
            erro={errors.telefone?.message}
            {...register('telefone', {
              onChange: (e) => setValue('telefone', mascararTelefone(e.target.value)),
            })}
          />
          <Campo rotulo="E-mail" type="email" autoComplete="email" erro={errors.email?.message} {...register('email')} />
          <Campo rotulo="Senha" type="password" autoComplete="new-password" erro={errors.senha?.message} {...register('senha')} />
          {erro && <p role="alert" className="text-sm text-taua-red">{erro}</p>}
          <button
            disabled={isSubmitting}
            className="rounded-full bg-taua-red px-5 py-3 font-semibold text-white disabled:opacity-60"
          >
            Criar conta
          </button>
        </form>
        <p className="mt-6 text-center text-sm">
          Já tem conta?{' '}
          <Link to="/login" className="font-semibold text-taua-red underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  )
}
