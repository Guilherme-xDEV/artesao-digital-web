import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { desativarProduto, listarProdutosDoArtesao } from '../data/produtoRepository'
import { formatarReais } from '../lib/format'
import type { Produto } from '../types/domain'

type Filtro = 'ativos' | 'todos' | 'inativos'

export default function Produtos() {
  const { user, artesao } = useAuth()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [filtro, setFiltro] = useState<Filtro>('ativos')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')
  const [operacao, setOperacao] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    if (!user) return
    setCarregando(true)
    setErro('')
    try {
      setProdutos(await listarProdutosDoArtesao(user.uid, artesao?.nome || user.displayName || user.email || 'Artesão'))
    } catch {
      setErro('Não foi possível carregar seus produtos. Verifique a conexão e tente novamente.')
    } finally {
      setCarregando(false)
    }
  }, [user])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const visiveis = produtos.filter((produto) => {
    const correspondeAoFiltro =
      filtro === 'todos' || (filtro === 'ativos' ? produto.ativo : !produto.ativo)
    const correspondeABusca =
      !termo ||
      produto.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
      produto.descricao.toLocaleLowerCase('pt-BR').includes(termo)
    return correspondeAoFiltro && correspondeABusca
  })

  async function handleDesativar(produto: Produto) {
    const confirmar = window.confirm(
      `Desativar "${produto.nome}"? O produto deixará de aparecer como disponível, mas seu registro será preservado.`,
    )
    if (!confirmar || !user) return

    setOperacao(produto.id)
    setErro('')
    try {
      await desativarProduto(produto.id, user.uid)
      await carregar()
    } catch {
      setErro('Não foi possível desativar o produto. Tente novamente.')
    } finally {
      setOperacao(null)
    }
  }

  return (
    <section>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-wood">Catálogo</p>
          <h1 className="mt-1 text-3xl font-bold text-wood-dark">Meus produtos</h1>
          <p className="mt-2 text-sm text-wood">Gerencie seus produtos, estoque e identificadores QR.</p>
        </div>
        <Link
          to="/produtos/novo"
          className="inline-flex items-center justify-center rounded-full bg-taua-red px-5 py-3 text-sm font-semibold text-white transition hover:bg-taua-red-dark"
        >
          + Novo produto
        </Link>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Produtos ativos</p>
          <p className="mt-1 text-2xl font-bold">{produtos.filter((p) => p.ativo).length}</p>
        </div>
        <div className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Unidades em estoque</p>
          <p className="mt-1 text-2xl font-bold">
            {produtos.filter((p) => p.ativo).reduce((total, p) => total + p.quantidadeEstoque, 0)}
          </p>
        </div>
        <div className="rounded-2xl border border-wood/15 bg-white p-4">
          <p className="text-sm text-wood">Sem estoque</p>
          <p className="mt-1 text-2xl font-bold">
            {produtos.filter((p) => p.ativo && p.quantidadeEstoque === 0).length}
          </p>
        </div>
      </div>

      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar por nome ou descrição"
          aria-label="Buscar produtos"
          className="min-w-0 flex-1 rounded-xl border border-wood/30 bg-white px-4 py-3 outline-none focus:border-taua-red"
        />
        <div className="flex gap-2" role="group" aria-label="Filtrar produtos">
          {([
            ['ativos', 'Ativos'],
            ['todos', 'Todos'],
            ['inativos', 'Inativos'],
          ] as const).map(([valor, rotulo]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setFiltro(valor)}
              aria-pressed={filtro === valor}
              className={
                filtro === valor
                  ? 'rounded-full bg-taua-red px-4 py-2 text-sm font-semibold text-white'
                  : 'rounded-full border border-wood/30 bg-white px-4 py-2 text-sm font-semibold text-wood-dark'
              }
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {erro && <p role="alert" className="mt-5 rounded-xl bg-taua-red-light p-3 text-sm text-taua-red-dark">{erro}</p>}

      {carregando ? (
        <p className="py-12 text-center text-wood">Carregando produtos...</p>
      ) : visiveis.length === 0 ? (
        <div className="mt-6 rounded-3xl border border-dashed border-wood/30 bg-white/70 px-6 py-14 text-center">
          <h2 className="text-xl font-bold">Nenhum produto encontrado</h2>
          <p className="mt-2 text-sm text-wood">
            {produtos.length === 0
              ? 'Cadastre seu primeiro produto para começar a organizar seu catálogo.'
              : 'Tente alterar a busca ou o filtro selecionado.'}
          </p>
          {produtos.length === 0 && (
            <Link to="/produtos/novo" className="mt-5 inline-flex rounded-full bg-taua-red px-5 py-3 font-semibold text-white">
              Cadastrar produto
            </Link>
          )}
        </div>
      ) : (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {visiveis.map((produto) => (
            <article key={produto.id} className="rounded-3xl border border-wood/15 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-xl font-bold">{produto.nome}</h2>
                  <p className="mt-1 line-clamp-2 text-sm text-wood">
                    {produto.descricao || 'Sem descrição'}
                  </p>
                </div>
                <span
                  className={
                    produto.ativo
                      ? 'shrink-0 rounded-full bg-leaf-light px-3 py-1 text-xs font-semibold text-leaf-dark'
                      : 'shrink-0 rounded-full bg-wood-light px-3 py-1 text-xs font-semibold text-wood-dark'
                  }
                >
                  {produto.ativo ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="mt-5 flex items-end justify-between border-t border-wood/10 pt-4">
                <div>
                  <p className="text-xs text-wood">Preço</p>
                  <p className="text-lg font-bold">{formatarReais(produto.precoCentavos)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-wood">Estoque</p>
                  <p className="text-lg font-bold">{produto.quantidadeEstoque} un.</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  to={`/produtos/${produto.id}/qrcode`}
                  className="rounded-full border border-wood/30 px-3 py-2 text-sm font-semibold text-wood-dark hover:bg-craft-bg"
                >
                  Ver QR Code
                </Link>
                {produto.ativo && (
                  <>
                    <Link
                      to={`/produtos/${produto.id}/editar`}
                      className="rounded-full border border-wood/30 px-3 py-2 text-sm font-semibold text-wood-dark hover:bg-craft-bg"
                    >
                      Editar
                    </Link>
                    <button
                      type="button"
                      disabled={operacao === produto.id}
                      onClick={() => void handleDesativar(produto)}
                      className="rounded-full px-3 py-2 text-sm font-semibold text-taua-red hover:bg-taua-red-light disabled:opacity-50"
                    >
                      {operacao === produto.id ? 'Desativando...' : 'Desativar'}
                    </button>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
