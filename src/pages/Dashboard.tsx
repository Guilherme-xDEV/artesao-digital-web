import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { listarProdutosDoArtesao } from '../data/produtoRepository'
import { listarVendasDoArtesao } from '../data/vendaRepository'
import { formatarReais } from '../lib/format'
import type { Produto, Venda } from '../types/domain'

function chaveData(data: Date): string {
  return [
    data.getFullYear(),
    String(data.getMonth() + 1).padStart(2, '0'),
    String(data.getDate()).padStart(2, '0'),
  ].join('-')
}

function montarUltimosSeteDias(vendas: Venda[]) {
  const hoje = new Date()
  const dias = Array.from({ length: 7 }, (_, indice) => {
    const data = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate() - (6 - indice))
    return {
      chave: chaveData(data),
      dia: data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }),
      totalCentavos: 0,
    }
  })

  const porData = new Map(dias.map((dia) => [dia.chave, dia]))
  for (const venda of vendas) {
    const dia = porData.get(chaveData(venda.dataHora.toDate()))
    if (dia) dia.totalCentavos += venda.totalCentavos
  }

  return dias.map((dia) => ({ dia: dia.dia, total: dia.totalCentavos / 100 }))
}

export default function Dashboard() {
  const { user, artesao } = useAuth()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [vendas, setVendas] = useState<Venda[]>([])
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [mostrarTotal, setMostrarTotal] = useState(true)

  const carregar = useCallback(async () => {
    if (!user) return
    setCarregando(true)
    setErro('')
    try {
      const [listaProdutos, listaVendas] = await Promise.all([
        listarProdutosDoArtesao(user.uid, artesao?.nome || user.displayName || user.email || 'Artesão'),
        listarVendasDoArtesao(user.uid),
      ])
      setProdutos(listaProdutos)
      setVendas(listaVendas)
    } catch {
      setErro('Não foi possível atualizar o resumo. Verifique sua conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [user, artesao?.nome])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const produtosAtivos = produtos.filter((produto) => produto.ativo)
  const totalVendidoCentavos = vendas.reduce((total, venda) => total + venda.totalCentavos, 0)
  const estoqueTotal = produtosAtivos.reduce((total, produto) => total + produto.quantidadeEstoque, 0)
  const semEstoque = produtosAtivos.filter((produto) => produto.quantidadeEstoque === 0).length
  const ultimasVendas = vendas.slice(0, 5)
  const dadosGrafico = useMemo(() => montarUltimosSeteDias(vendas), [vendas])

  const maisVendidos = useMemo(() => {
    const totais = new Map<string, { nome: string; quantidade: number }>()
    for (const venda of vendas) {
      const atual = totais.get(venda.produtoId) ?? { nome: venda.produtoNome, quantidade: 0 }
      atual.quantidade += venda.quantidade
      totais.set(venda.produtoId, atual)
    }
    return [...totais.values()].sort((a, b) => b.quantidade - a.quantidade).slice(0, 3)
  }, [vendas])

  return (
    <section>
      <div className="rounded-[28px] bg-taua-red p-6 text-white shadow-sm sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-white/80">Centro de Artesanato de Tauá</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              Olá, {artesao?.nome || user?.displayName || 'artesão'}
            </h1>
            <p className="mt-5 text-sm text-white/80">Total vendido nos seus produtos</p>
            <p className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl" aria-live="polite">
              {carregando
                ? 'Carregando...'
                : mostrarTotal
                  ? formatarReais(totalVendidoCentavos)
                  : 'R$ •••••'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setMostrarTotal((valor) => !valor)}
            aria-label={mostrarTotal ? 'Ocultar total vendido' : 'Mostrar total vendido'}
            className="rounded-full bg-white/15 px-4 py-2 text-sm font-semibold hover:bg-white/25"
          >
            {mostrarTotal ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
        <div className="mt-7 flex flex-wrap gap-3">
          <Link
            to="/vendas/nova"
            className="rounded-full bg-white px-5 py-3 text-sm font-bold text-taua-red-dark hover:bg-taua-red-light"
          >
            + Nova venda
          </Link>
          <Link
            to="/produtos/novo"
            className="rounded-full border border-white/60 px-5 py-3 text-sm font-semibold text-white hover:bg-white/10"
          >
            + Novo produto
          </Link>
        </div>
      </div>

      {erro && (
        <p role="alert" className="mt-5 rounded-xl bg-taua-red-light p-3 text-sm text-taua-red-dark">
          {erro}
        </p>
      )}

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Produtos ativos</p>
          <p className="mt-1 text-2xl font-bold">{carregando ? '—' : produtosAtivos.length}</p>
          <Link to="/produtos" className="mt-2 inline-block text-xs font-semibold text-taua-red">Ver catálogo →</Link>
        </article>
        <article className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Unidades em estoque</p>
          <p className="mt-1 text-2xl font-bold">{carregando ? '—' : estoqueTotal}</p>
        </article>
        <article className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Produtos sem estoque</p>
          <p className="mt-1 text-2xl font-bold">{carregando ? '—' : semEstoque}</p>
        </article>
        <article className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Vendas registradas</p>
          <p className="mt-1 text-2xl font-bold">{carregando ? '—' : vendas.length}</p>
          <Link to="/vendas/historico" className="mt-2 inline-block text-xs font-semibold text-taua-red">Ver histórico →</Link>
        </article>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border border-wood/15 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Desempenho das vendas</h2>
              <p className="mt-1 text-sm text-wood">Total vendido nos últimos 7 dias</p>
            </div>
            <button
              type="button"
              onClick={() => void carregar()}
              disabled={carregando}
              className="rounded-full border border-wood/25 px-3 py-2 text-xs font-semibold text-wood-dark disabled:opacity-50"
            >
              Atualizar
            </button>
          </div>
          <div className="mt-5 h-64 w-full">
            {carregando ? (
              <div className="grid h-full place-items-center text-sm text-wood">Carregando gráfico...</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dadosGrafico} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eadbd6" />
                  <XAxis dataKey="dia" tickLine={false} axisLine={false} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={58}
                    tickFormatter={(valor: number) => `R$${valor}`}
                  />
                  <Tooltip
                    formatter={(valor) => formatarReais(Number(valor ?? 0) * 100)}
                    labelStyle={{ color: '#3e2723' }}
                  />
                  <Bar dataKey="total" name="Vendas" fill="#B2422F" radius={[7, 7, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </article>

        <article className="rounded-3xl border border-wood/15 bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold">Vendas recentes</h2>
              <p className="mt-1 text-sm text-wood">Últimas operações dos seus produtos</p>
            </div>
            <Link to="/vendas/historico" className="text-xs font-semibold text-taua-red">Ver todas</Link>
          </div>
          {carregando ? (
            <p className="py-8 text-sm text-wood">Carregando vendas...</p>
          ) : ultimasVendas.length === 0 ? (
            <p className="py-8 text-sm text-wood">As vendas registradas aparecerão aqui.</p>
          ) : (
            <div className="mt-4 divide-y divide-wood/10">
              {ultimasVendas.map((venda) => (
                <div key={venda.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{venda.produtoNome}</p>
                    <p className="mt-1 text-xs text-wood">
                      {venda.quantidade} un. · {venda.dataHora.toDate().toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-bold">{formatarReais(venda.totalCentavos)}</p>
                </div>
              ))}
            </div>
          )}
        </article>
      </div>

      <article className="mt-5 rounded-3xl border border-wood/15 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Produtos mais vendidos</h2>
            <p className="mt-1 text-sm text-wood">Ranking por unidades vendidas</p>
          </div>
          <Link to="/vendas/historico" className="text-xs font-semibold text-taua-red">Ver análise</Link>
        </div>
        {carregando ? (
          <p className="py-5 text-sm text-wood">Carregando ranking...</p>
        ) : maisVendidos.length === 0 ? (
          <p className="py-5 text-sm text-wood">O ranking será exibido após as primeiras vendas.</p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {maisVendidos.map((item, indice) => (
              <div key={item.nome} className="rounded-2xl bg-craft-bg p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-wood">#{indice + 1}</p>
                <p className="mt-1 truncate font-bold">{item.nome}</p>
                <p className="mt-1 text-sm text-wood">{item.quantidade} unidade(s)</p>
              </div>
            ))}
          </div>
        )}
      </article>
    </section>
  )
}
