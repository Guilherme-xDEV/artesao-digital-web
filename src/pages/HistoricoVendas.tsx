import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useAuth } from '../auth/AuthContext'
import { listarVendasDoArtesao } from '../data/vendaRepository'
import { formatarReais } from '../lib/format'
import type { Venda } from '../types/domain'

type Periodo = '7' | '30' | 'todos'

function inicioDoDia(data: Date): Date {
  return new Date(data.getFullYear(), data.getMonth(), data.getDate())
}

function chaveData(data: Date): string {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0'),
  ].join('-')
}

function formatarDataHora(venda: Venda): string {
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(venda.dataHora.toDate())
}

export default function HistoricoVendas() {
  const { user } = useAuth()
  const [vendas, setVendas] = useState<Venda[]>([])
  const [periodo, setPeriodo] = useState<Periodo>('30')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true

    async function carregar() {
      if (!user) return
      setCarregando(true)
      setErro('')
      try {
        const resultado = await listarVendasDoArtesao(user.uid)
        if (ativo) setVendas(resultado)
      } catch {
        if (ativo) setErro('Não foi possível carregar o histórico de vendas.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }

    void carregar()
    return () => {
      ativo = false
    }
  }, [user])

  const vendasFiltradas = useMemo(() => {
    if (periodo === 'todos') return vendas
    const dias = Number(periodo)
    const limite = inicioDoDia(new Date())
    limite.setDate(limite.getDate() - (dias - 1))
    return vendas.filter((venda) => venda.dataHora.toDate() >= limite)
  }, [periodo, vendas])

  const totalCentavos = vendasFiltradas.reduce((total, venda) => total + venda.totalCentavos, 0)
  const unidadesVendidas = vendasFiltradas.reduce((total, venda) => total + venda.quantidade, 0)

  const grafico = useMemo(() => {
    const quantidadeDias = periodo === '7' ? 7 : 30
    const hoje = new Date()
    const dias = Array.from({ length: quantidadeDias }, (_, indice) => {
      const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (quantidadeDias - 1 - indice))
      return {
        chave: chaveData(data),
        dia: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
        totalCentavos: 0,
      }
    })
    const porData = new Map(dias.map((dia) => [dia.chave, dia]))
    for (const venda of vendasFiltradas) {
      const dia = porData.get(chaveData(venda.dataHora.toDate()))
      if (dia) dia.totalCentavos += venda.totalCentavos
    }
    return dias.map((dia) => ({ dia: dia.dia, total: dia.totalCentavos / 100 }))
  }, [periodo, vendasFiltradas])

  const produtosMaisVendidos = useMemo(() => {
    const totais = new Map<string, { nome: string; quantidade: number }>()
    for (const venda of vendasFiltradas) {
      const atual = totais.get(venda.produtoId) ?? { nome: venda.produtoNome, quantidade: 0 }
      atual.quantidade += venda.quantidade
      totais.set(venda.produtoId, atual)
    }
    return [...totais.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, 5)
  }, [vendasFiltradas])

  return (
    <section>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-wood">Desempenho</p>
          <h1 className="mt-1 text-3xl font-bold text-wood-dark">Histórico de vendas</h1>
          <p className="mt-2 text-sm text-wood">Acompanhe as vendas dos produtos vinculados à sua conta.</p>
        </div>
        <Link to="/vendas/nova" className="inline-flex justify-center rounded-full bg-taua-red px-5 py-3 text-sm font-semibold text-white">
          + Registrar venda
        </Link>
      </div>

      {erro && (
        <p role="alert" className="mt-5 rounded-xl bg-taua-red-light p-3 text-sm text-taua-red-dark">
          {erro}
        </p>
      )}

      <div className="mt-7 flex flex-wrap gap-2" role="group" aria-label="Período do histórico">
        {([
          ['7', '7 dias'],
          ['30', '30 dias'],
          ['todos', 'Todo o período'],
        ] as const).map(([valor, rotulo]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setPeriodo(valor)}
            aria-pressed={periodo === valor}
            className={
              periodo === valor
                ? 'rounded-full bg-taua-red px-4 py-2 text-sm font-semibold text-white'
                : 'rounded-full border border-wood/30 bg-white px-4 py-2 text-sm font-semibold text-wood-dark'
            }
          >
            {rotulo}
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Total vendido</p>
          <p className="mt-1 text-2xl font-bold">{carregando ? '—' : formatarReais(totalCentavos)}</p>
        </article>
        <article className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Transações</p>
          <p className="mt-1 text-2xl font-bold">{carregando ? '—' : vendasFiltradas.length}</p>
        </article>
        <article className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Unidades vendidas</p>
          <p className="mt-1 text-2xl font-bold">{carregando ? '—' : unidadesVendidas}</p>
        </article>
      </div>

      {periodo !== 'todos' && (
        <article className="mt-5 rounded-3xl border border-wood/15 bg-white p-5 sm:p-6">
          <h2 className="text-xl font-bold">Vendas por dia</h2>
          <p className="mt-1 text-sm text-wood">Valor total registrado em cada dia do período.</p>
          <div className="mt-5 h-64 w-full">
            {carregando ? (
              <div className="grid h-full place-items-center text-sm text-wood">Carregando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={grafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eadbd6" />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} interval={periodo === '30' ? 4 : 0} />
                  <YAxis tickLine={false} axisLine={false} width={58} tickFormatter={(valor: number) => `R$${valor}`} />
                  <Tooltip
                    formatter={(valor) => formatarReais(Number(valor ?? 0) * 100)}
                    labelStyle={{ color: '#3e2723' }}
                  />
                  <Bar dataKey="total" name="Vendas" fill="#B2422F" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>
      )}

      <article className="mt-5 rounded-3xl border border-wood/15 bg-white p-5 sm:p-6">
        <h2 className="text-xl font-bold">Produtos mais vendidos</h2>
        <p className="mt-1 text-sm text-wood">Ranking por unidades no período selecionado.</p>
        {carregando ? (
          <p className="py-6 text-sm text-wood">Carregando ranking...</p>
        ) : produtosMaisVendidos.length === 0 ? (
          <p className="py-6 text-sm text-wood">Não há vendas registradas neste período.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {produtosMaisVendidos.map((produto, indice) => (
              <div key={produto.nome} className="flex items-center gap-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-taua-red-light text-sm font-bold text-taua-red-dark">
                  {indice + 1}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{produto.nome}</span>
                <span className="shrink-0 text-sm text-wood">{produto.quantidade} un.</span>
              </div>
            ))}
          </div>
        )}
      </article>

      <article className="mt-5 overflow-hidden rounded-3xl border border-wood/15 bg-white">
        <div className="border-b border-wood/10 p-5 sm:p-6">
          <h2 className="text-xl font-bold">Todas as transações</h2>
          <p className="mt-1 text-sm text-wood">O histórico é preservado mesmo quando um produto é desativado.</p>
        </div>
        {carregando ? (
          <p className="p-6 text-sm text-wood">Carregando vendas...</p>
        ) : vendasFiltradas.length === 0 ? (
          <p className="p-6 text-sm text-wood">Nenhuma venda encontrada neste período.</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-craft-bg text-xs uppercase tracking-wider text-wood">
                  <tr>
                    <th className="px-5 py-3 font-semibold">Data e hora</th>
                    <th className="px-5 py-3 font-semibold">Produto</th>
                    <th className="px-5 py-3 text-right font-semibold">Quantidade</th>
                    <th className="px-5 py-3 text-right font-semibold">Preço unitário</th>
                    <th className="px-5 py-3 text-right font-semibold">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-wood/10">
                  {vendasFiltradas.map((venda) => (
                    <tr key={venda.id}>
                      <td className="whitespace-nowrap px-5 py-4 text-wood">{formatarDataHora(venda)}</td>
                      <td className="px-5 py-4 font-semibold">{venda.produtoNome}</td>
                      <td className="px-5 py-4 text-right">{venda.quantidade}</td>
                      <td className="px-5 py-4 text-right">{formatarReais(venda.precoUnitarioCentavos)}</td>
                      <td className="px-5 py-4 text-right font-bold">{formatarReais(venda.totalCentavos)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="divide-y divide-wood/10 md:hidden">
              {vendasFiltradas.map((venda) => (
                <div key={venda.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-semibold">{venda.produtoNome}</p>
                      <p className="mt-1 text-xs text-wood">{formatarDataHora(venda)}</p>
                    </div>
                    <p className="shrink-0 font-bold">{formatarReais(venda.totalCentavos)}</p>
                  </div>
                  <p className="mt-2 text-xs text-wood">
                    {venda.quantidade} un. × {formatarReais(venda.precoUnitarioCentavos)}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </article>
    </section>
  )
}
