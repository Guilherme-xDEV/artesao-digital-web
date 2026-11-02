import { useEffect, useMemo, useRef, useState } from 'react'
import { Html5QrcodeScanner } from 'html5-qrcode'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import {
  buscarProdutoPorQrCode,
  listarProdutosAtivos,
} from '../data/produtoRepository'
import { registrarVenda, VendaError } from '../data/vendaRepository'
import { formatarReais } from '../lib/format'
import type { Produto } from '../types/domain'

const SCANNER_ID = 'artesao-digital-qr-reader'

export default function RegistrarVenda() {
  const { user, artesao } = useAuth()
  const [scannerAtivo, setScannerAtivo] = useState(false)
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produto, setProduto] = useState<Produto | null>(null)
  const [quantidade, setQuantidade] = useState(1)
  const [busca, setBusca] = useState('')
  const [carregandoProdutos, setCarregandoProdutos] = useState(true)
  const [registrando, setRegistrando] = useState(false)
  const [mensagem, setMensagem] = useState('')
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState(false)
  const scannerRef = useRef<Html5QrcodeScanner | null>(null)
  const qrProcessadoRef = useRef(false)

  useEffect(() => {
    let ativo = true

    async function carregarProdutos() {
      try {
        const resultado = await listarProdutosAtivos()
        if (ativo) setProdutos(resultado)
      } catch {
        if (ativo) setErro('Não foi possível carregar o catálogo para busca manual.')
      } finally {
        if (ativo) setCarregandoProdutos(false)
      }
    }

    void carregarProdutos()
    return () => {
      ativo = false
    }
  }, [])

  useEffect(() => {
    if (!scannerAtivo) return

    const scanner = new Html5QrcodeScanner(
      SCANNER_ID,
      { fps: 10, qrbox: { width: 240, height: 240 }, aspectRatio: 1 },
      false,
    )
    scannerRef.current = scanner
    qrProcessadoRef.current = false

    scanner.render(
      (textoLido) => {
        if (qrProcessadoRef.current) return
        qrProcessadoRef.current = true
        setScannerAtivo(false)
        void selecionarPorQr(textoLido)
        void scanner.clear().catch(() => undefined)
      },
      () => undefined,
    )

    return () => {
      void scanner.clear().catch(() => undefined)
      if (scannerRef.current === scanner) scannerRef.current = null
    }
    // O scanner é recriado somente quando o usuário ativa/desativa a câmera.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scannerAtivo])

  async function selecionarPorQr(qrCodeId: string) {
    setErro('')
    setMensagem('')
    try {
      const encontrado = await buscarProdutoPorQrCode(qrCodeId.trim())
      if (!encontrado) {
        setErro('QR Code não reconhecido. Confira se a etiqueta pertence a um produto cadastrado.')
        return
      }
      if (!encontrado.ativo) {
        setErro('Este produto está inativo e não pode ser vendido.')
        return
      }
      if (encontrado.quantidadeEstoque <= 0) {
        setErro('Produto sem estoque disponível.')
        return
      }
      setProduto(encontrado)
      setQuantidade(1)
    } catch {
      setErro('Não foi possível consultar o produto. Verifique sua conexão.')
    }
  }

  const produtosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR')
    return produtos.filter((item) =>
      item.nome.toLocaleLowerCase('pt-BR').includes(termo),
    )
  }, [busca, produtos])

  const totalCentavos = produto ? produto.precoCentavos * quantidade : 0

  async function confirmarVenda() {
    if (!user || !produto) return
    if (quantidade < 1 || quantidade > produto.quantidadeEstoque) {
      setErro('Selecione uma quantidade dentro do estoque disponível.')
      return
    }

    setRegistrando(true)
    setErro('')
    setSucesso(false)

    try {
      const vendedorNome =
        artesao?.nome || user.displayName || user.email || 'Artesão'
      await registrarVenda(produto.id, user.uid, vendedorNome, quantidade)
      setSucesso(true)
      setMensagem(
        `Venda registrada: ${quantidade} unidade(s) de ${produto.nome}, total de ${formatarReais(totalCentavos)}.`,
      )
      setProduto(null)
      setQuantidade(1)

      const atualizados = await listarProdutosAtivos()
      setProdutos(atualizados)
    } catch (e) {
      setErro(
        e instanceof VendaError
          ? e.message
          : 'Não foi possível registrar a venda. Atualize os dados e tente novamente.',
      )
    } finally {
      setRegistrando(false)
    }
  }

  return (
    <section className="mx-auto max-w-3xl">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-wood">Ponto de venda</p>
      <h1 className="mt-1 text-3xl font-bold text-wood-dark">Registrar venda</h1>
      <p className="mt-2 text-sm text-wood">
        Leia o QR Code do produto ou localize-o manualmente no catálogo.
      </p>

      {erro && (
        <p role="alert" className="mt-5 rounded-xl bg-taua-red-light p-3 text-sm text-taua-red-dark">
          {erro}
        </p>
      )}
      {sucesso && (
        <p role="status" className="mt-5 rounded-xl bg-leaf-light p-3 text-sm text-leaf-dark">
          {mensagem}
        </p>
      )}

      <div className="mt-7 rounded-3xl border border-wood/15 bg-white p-5 sm:p-7">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">Leitor de QR Code</h2>
            <p className="mt-1 text-sm text-wood">A câmera identifica o produto automaticamente.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setErro('')
              setScannerAtivo((ativo) => !ativo)
            }}
            className="rounded-full bg-taua-red px-5 py-3 text-sm font-semibold text-white hover:bg-taua-red-dark"
          >
            {scannerAtivo ? 'Fechar câmera' : 'Abrir câmera'}
          </button>
        </div>
        {scannerAtivo && (
          <div className="mt-5 overflow-hidden rounded-2xl border border-wood/15 p-2">
            <div id={SCANNER_ID} />
          </div>
        )}
      </div>

      <div className="mt-5 rounded-3xl border border-wood/15 bg-white p-5 sm:p-7">
        <h2 className="text-xl font-bold">Busca manual</h2>
        <p className="mt-1 text-sm text-wood">Use esta opção quando não for possível ler a etiqueta.</p>
        <input
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Digite o nome do produto"
          aria-label="Buscar produto para venda"
          className="mt-4 w-full rounded-xl border border-wood/30 px-4 py-3 outline-none focus:border-taua-red"
        />
        {carregandoProdutos ? (
          <p className="py-5 text-sm text-wood">Carregando catálogo...</p>
        ) : produtosFiltrados.length === 0 ? (
          <p className="py-5 text-sm text-wood">Nenhum produto ativo encontrado.</p>
        ) : (
          <div className="mt-3 max-h-64 divide-y divide-wood/10 overflow-y-auto">
            {produtosFiltrados.slice(0, 30).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void selecionarPorQr(item.qrCodeId)}
                className="flex w-full items-center justify-between gap-4 py-3 text-left hover:bg-craft-bg"
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{item.nome}</span>
                  <span className="block text-xs text-wood">{item.quantidadeEstoque} unidade(s) disponíveis</span>
                </span>
                <span className="shrink-0 text-sm font-semibold">{formatarReais(item.precoCentavos)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {produto && (
        <div className="mt-5 rounded-3xl border border-wood/15 bg-craft-surface p-5 sm:p-7">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-wood">Produto selecionado</p>
              <h2 className="mt-1 text-2xl font-bold">{produto.nome}</h2>
              {produto.descricao && <p className="mt-1 text-sm text-wood">{produto.descricao}</p>}
              <p className="mt-2 text-xs text-wood">Artesão: {produto.artesaoNome}</p>
            </div>
            <button
              type="button"
              onClick={() => setProduto(null)}
              className="rounded-full px-3 py-1 text-sm font-semibold text-taua-red hover:bg-taua-red-light"
            >
              Trocar
            </button>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs text-wood">Preço unitário</p>
              <p className="text-xl font-bold">{formatarReais(produto.precoCentavos)}</p>
            </div>
            <div className="rounded-2xl bg-white p-4">
              <p className="text-xs text-wood">Estoque disponível</p>
              <p className="text-xl font-bold">{produto.quantidadeEstoque} unidade(s)</p>
            </div>
          </div>

          <label htmlFor="quantidade-venda" className="mt-5 block text-sm font-semibold">
            Quantidade
          </label>
          <input
            id="quantidade-venda"
            type="number"
            min={1}
            max={produto.quantidadeEstoque}
            step={1}
            value={quantidade}
            onChange={(event) => setQuantidade(Number(event.target.value))}
            className="mt-1 w-full rounded-xl border border-wood/30 bg-white px-4 py-3 outline-none focus:border-taua-red sm:max-w-xs"
          />

          <div className="mt-5 flex items-end justify-between border-t border-wood/15 pt-5">
            <span className="text-sm font-semibold text-wood">Total da venda</span>
            <strong className="text-3xl text-taua-red">{formatarReais(totalCentavos)}</strong>
          </div>

          <button
            type="button"
            disabled={registrando || quantidade < 1 || quantidade > produto.quantidadeEstoque}
            onClick={() => void confirmarVenda()}
            className="mt-5 w-full rounded-full bg-taua-red px-6 py-3 font-semibold text-white hover:bg-taua-red-dark disabled:cursor-not-allowed disabled:opacity-50"
          >
            {registrando ? 'Registrando venda...' : 'Confirmar venda'}
          </button>
        </div>
      )}

      <div className="mt-6">
        <Link to="/vendas/historico" className="text-sm font-semibold text-taua-red hover:underline">
          Consultar histórico de vendas →
        </Link>
      </div>
    </section>
  )
}
