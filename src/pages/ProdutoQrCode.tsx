import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { QRCodeCanvas } from 'qrcode.react'
import { useAuth } from '../auth/AuthContext'
import { buscarProdutoPorId } from '../data/produtoRepository'
import { formatarReais } from '../lib/format'
import type { Produto } from '../types/domain'

function escaparHtml(valor: string): string {
  return valor.replace(/[&<>"']/g, (caractere) => {
    const entidades: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;',
    }
    return entidades[caractere]
  })
}

export default function ProdutoQrCode() {
  const { id = '' } = useParams<{ id: string }>()
  const { user } = useAuth()
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [produto, setProduto] = useState<Produto | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    let ativo = true
    async function carregar() {
      if (!user || !id) return
      try {
        const resultado = await buscarProdutoPorId(id)
        if (!ativo) return
        if (!resultado || resultado.artesaoId !== user.uid) {
          setErro('Produto não encontrado ou não pertence à sua conta.')
        } else {
          setProduto(resultado)
        }
      } catch {
        if (ativo) setErro('Não foi possível carregar o QR Code.')
      } finally {
        if (ativo) setCarregando(false)
      }
    }
    void carregar()
    return () => {
      ativo = false
    }
  }, [id, user])

  function baixarQrCode() {
    const canvas = canvasRef.current
    if (!canvas || !produto) return
    const link = document.createElement('a')
    link.download = `qrcode-${produto.nome.trim().replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  function imprimirQrCode() {
    const canvas = canvasRef.current
    if (!canvas || !produto) return
    const janela = window.open('', '_blank', 'width=640,height=720')
    if (!janela) {
      setErro('O navegador bloqueou a janela de impressão. Permita pop-ups para este site.')
      return
    }

    const imagem = canvas.toDataURL('image/png')
    janela.document.write(`<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>QR Code - ${escaparHtml(produto.nome)}</title>
<style>
  body{font-family:Arial,sans-serif;color:#3e2723;display:grid;place-items:center;min-height:90vh;margin:0}
  main{text-align:center;padding:32px}
  img{width:280px;height:280px}
  h1{font-size:24px;margin-bottom:8px}
  p{color:#8d6e63}
  @media print{main{break-inside:avoid}}
</style>
</head>
<body>
<main>
  <h1>${escaparHtml(produto.nome)}</h1>
  <p>Centro de Artesanato de Tauá</p>
  <img src="${imagem}" alt="QR Code do produto">
  <p>Identificador: ${escaparHtml(produto.qrCodeId)}</p>
</main>
<script>window.onload=()=>window.print()</script>
</body>
</html>`)
    janela.document.close()
  }

  if (carregando) return <p className="py-12 text-center text-wood">Carregando QR Code...</p>

  if (erro || !produto) {
    return (
      <section>
        <p role="alert" className="rounded-xl bg-taua-red-light p-4 text-taua-red-dark">
          {erro || 'Produto não encontrado.'}
        </p>
        <Link to="/produtos" className="mt-5 inline-block text-sm font-semibold text-taua-red">Voltar para produtos</Link>
      </section>
    )
  }

  return (
    <section className="mx-auto max-w-2xl">
      <Link to="/produtos" className="text-sm font-semibold text-taua-red hover:underline">
        ← Voltar para produtos
      </Link>
      <div className="mt-6 rounded-3xl border border-wood/15 bg-white p-6 text-center shadow-sm sm:p-9">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-wood">Identificação do produto</p>
        <h1 className="mt-2 text-3xl font-bold">{produto.nome}</h1>
        <p className="mt-2 text-sm text-wood">{produto.descricao || 'Produto artesanal'}</p>

        <div className="mx-auto mt-7 inline-flex rounded-2xl border border-wood/10 bg-white p-4">
          <QRCodeCanvas
            ref={canvasRef}
            value={produto.qrCodeId}
            size={260}
            level="H"
            marginSize={3}
            title={`QR Code de ${produto.nome}`}
          />
        </div>

        <p className="mt-5 break-all font-mono text-xs text-wood">{produto.qrCodeId}</p>
        <div className="mt-6 grid grid-cols-2 gap-3 rounded-2xl bg-craft-bg p-4 text-left">
          <div>
            <p className="text-xs text-wood">Preço</p>
            <p className="font-bold">{formatarReais(produto.precoCentavos)}</p>
          </div>
          <div>
            <p className="text-xs text-wood">Estoque</p>
            <p className="font-bold">{produto.quantidadeEstoque} unidades</p>
          </div>
        </div>

        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          <button
            type="button"
            onClick={baixarQrCode}
            className="rounded-full bg-taua-red px-5 py-3 text-sm font-semibold text-white hover:bg-taua-red-dark"
          >
            Baixar QR Code
          </button>
          <button
            type="button"
            onClick={imprimirQrCode}
            className="rounded-full border border-wood/30 px-5 py-3 text-sm font-semibold text-wood-dark hover:bg-craft-bg"
          >
            Imprimir
          </button>
        </div>
      </div>
    </section>
  )
}
