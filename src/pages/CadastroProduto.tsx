import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Campo } from '../components/Campo'
import {
  atualizarProduto,
  buscarProdutoPorId,
  criarProduto,
  type DadosProduto,
} from '../data/produtoRepository'

function paraCentavos(valor: string): number {
  const normalizado = valor.trim().replace(/\s/g, '').replace(',', '.')
  return Math.round(Number(normalizado) * 100)
}

export default function CadastroProduto() {
  const { id } = useParams<{ id: string }>()
  const { user, artesao } = useAuth()
  const navigate = useNavigate()
  const [nome, setNome] = useState('')
  const [descricao, setDescricao] = useState('')
  const [preco, setPreco] = useState('')
  const [estoque, setEstoque] = useState('0')
  const [carregando, setCarregando] = useState(Boolean(id))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregarProduto() {
      if (!id || !user) return
      setCarregando(true)
      try {
        const produto = await buscarProdutoPorId(id)
        if (!ativo) return
        if (!produto || produto.artesaoId !== user.uid) {
          navigate('/produtos', { replace: true })
          return
        }
        setNome(produto.nome)
        setDescricao(produto.descricao)
        setPreco((produto.precoCentavos / 100).toFixed(2).replace('.', ','))
        setEstoque(String(produto.quantidadeEstoque))
      } catch {
        if (ativo) setErro('Não foi possível carregar os dados do produto.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    void carregarProduto()
    return () => {
      ativo = false
    }
  }, [id, user, navigate])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')

    if (!user) {
      setErro('Sua sessão não está disponível. Entre novamente.')
      return
    }

    const precoCentavos = paraCentavos(preco)
    const quantidadeEstoque = Number(estoque)

    if (!nome.trim() || nome.trim().length < 2) {
      setErro('Informe um nome com pelo menos 2 caracteres.')
      return
    }
    if (!Number.isSafeInteger(precoCentavos) || precoCentavos <= 0) {
      setErro('Informe um preço válido maior que zero.')
      return
    }
    if (!Number.isSafeInteger(quantidadeEstoque) || quantidadeEstoque < 0) {
      setErro('O estoque deve ser um número inteiro igual ou maior que zero.')
      return
    }

    const dados: DadosProduto = {
      nome: nome.trim(),
      descricao: descricao.trim(),
      precoCentavos,
      quantidadeEstoque,
    }

    setSalvando(true)
    try {
      if (id) {
        await atualizarProduto(id, user.uid, dados)
      } else {
        const artesaoNome = artesao?.nome || user.displayName || user.email || 'Artesão'
        await criarProduto(user.uid, artesaoNome, dados)
      }
      navigate('/produtos', { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar o produto.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <p className="py-12 text-center text-wood">Carregando produto...</p>
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Link to="/produtos" className="text-sm font-semibold text-taua-red hover:underline">
        ← Voltar para produtos
      </Link>
      <p className="mt-6 text-sm font-semibold uppercase tracking-[0.16em] text-wood">
        Catálogo de produtos
      </p>
      <h1 className="mt-1 text-3xl font-bold">{id ? 'Editar produto' : 'Cadastrar produto'}</h1>
      <p className="mt-2 text-sm text-wood">
        {id
          ? 'Atualize as informações mantendo o mesmo QR Code.'
          : 'Preencha os dados do item. Um QR Code exclusivo será criado automaticamente.'}
      </p>

      <form onSubmit={handleSubmit} className="mt-7 flex flex-col gap-5 rounded-3xl border border-wood/15 bg-white p-6 shadow-sm">
        <Campo
          rotulo="Nome do produto"
          name="nome"
          value={nome}
          onChange={(event) => setNome(event.target.value)}
          maxLength={100}
          placeholder="Ex.: Vaso de cerâmica"
          required
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="descricao" className="text-sm font-semibold">Descrição</label>
          <textarea
            id="descricao"
            value={descricao}
            onChange={(event) => setDescricao(event.target.value)}
            maxLength={500}
            rows={4}
            placeholder="Descreva os detalhes do produto"
            className="resize-y rounded-xl border border-wood/40 bg-white px-3 py-2.5 outline-none focus:border-taua-red"
          />
          <span className="text-right text-xs text-wood">{descricao.length}/500</span>
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <Campo
            rotulo="Preço (R$)"
            name="preco"
            type="text"
            inputMode="decimal"
            value={preco}
            onChange={(event) => setPreco(event.target.value)}
            placeholder="0,00"
            required
          />
          <Campo
            rotulo="Quantidade em estoque"
            name="estoque"
            type="number"
            min="0"
            step="1"
            value={estoque}
            onChange={(event) => setEstoque(event.target.value)}
            required
          />
        </div>

        {erro && <p role="alert" className="rounded-xl bg-taua-red-light p-3 text-sm text-taua-red-dark">{erro}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-wood/10 pt-5 sm:flex-row sm:justify-end">
          <Link
            to="/produtos"
            className="rounded-full border border-wood/30 px-5 py-3 text-center text-sm font-semibold text-wood-dark"
          >
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={salvando}
            className="rounded-full bg-taua-red px-6 py-3 text-sm font-semibold text-white hover:bg-taua-red-dark disabled:opacity-60"
          >
            {salvando ? 'Salvando...' : id ? 'Salvar alterações' : 'Cadastrar produto'}
          </button>
        </div>
      </form>
    </section>
  )
}
