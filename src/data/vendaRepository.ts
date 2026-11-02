import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Venda } from '../types/domain'

export class VendaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VendaError'
  }
}

function precoEmCentavos(produto: Record<string, unknown>): number {
  if (typeof produto.precoCentavos === 'number') return produto.precoCentavos
  if (typeof produto.preco === 'number') return Math.round(produto.preco * 100)
  return Number.NaN
}

function dataLegadaParaTimestamp(valor: unknown): Timestamp {
  if (valor instanceof Timestamp) return valor
  if (typeof valor === 'string') {
    const correspondencia = valor.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})$/)
    if (correspondencia) {
      const [, dia, mes, ano, hora, minuto] = correspondencia
      const data = new Date(Number(ano), Number(mes) - 1, Number(dia), Number(hora), Number(minuto))
      if (!Number.isNaN(data.getTime())) return Timestamp.fromDate(data)
    }
  }
  return Timestamp.fromMillis(0)
}

function converterVenda(id: string, dados: Record<string, unknown>): Venda {
  const quantidade = typeof dados.quantidade === 'number' && dados.quantidade > 0
    ? dados.quantidade
    : 1
  const totalCentavos = typeof dados.totalCentavos === 'number'
    ? dados.totalCentavos
    : typeof dados.valorTotal === 'number'
      ? Math.round(dados.valorTotal * 100)
      : 0
  const precoUnitarioCentavos = typeof dados.precoUnitarioCentavos === 'number'
    ? dados.precoUnitarioCentavos
    : Math.round(totalCentavos / quantidade)

  return {
    id,
    produtoId: typeof dados.produtoId === 'string' ? dados.produtoId : '',
    produtoNome: typeof dados.produtoNome === 'string' ? dados.produtoNome : '',
    artesaoId:
      typeof dados.artesaoId === 'number' || typeof dados.artesaoId === 'string'
        ? dados.artesaoId
        : '',
    artesaoNome: typeof dados.artesaoNome === 'string' ? dados.artesaoNome : '',
    vendedorId: typeof dados.vendedorId === 'string' ? dados.vendedorId : '',
    vendedorNome:
      typeof dados.vendedorNome === 'string'
        ? dados.vendedorNome
        : typeof dados.artesaoNome === 'string'
          ? dados.artesaoNome
          : '',
    precoUnitarioCentavos,
    quantidade,
    totalCentavos,
    dataHora: dataLegadaParaTimestamp(dados.dataHora),
  }
}

/**
 * Records the sale and decrements stock atomically.
 * Supports old product documents during the transition to precoCentavos.
 */
export async function registrarVenda(
  produtoId: string,
  vendedorId: string,
  vendedorNome: string,
  quantidade: number,
): Promise<string> {
  if (!Number.isSafeInteger(quantidade) || quantidade < 1) {
    throw new VendaError('A quantidade deve ser um número inteiro maior que zero.')
  }

  const produtoRef = doc(db, 'produtos', produtoId)
  const vendaRef = doc(collection(db, 'vendas'))

  await runTransaction(db, async (transacao) => {
    const snapshot = await transacao.get(produtoRef)

    if (!snapshot.exists()) {
      throw new VendaError('Produto não encontrado. Leia um QR Code válido.')
    }

    const produto = snapshot.data()
    if (produto.ativo !== true) {
      throw new VendaError('Este produto está inativo e não pode ser vendido.')
    }

    const estoqueAtual = Number(produto.quantidadeEstoque)
    const precoUnitarioCentavos = precoEmCentavos(produto)

    if (!Number.isSafeInteger(estoqueAtual) || estoqueAtual < 0) {
      throw new VendaError('O estoque deste produto está inconsistente.')
    }
    if (quantidade > estoqueAtual) {
      throw new VendaError(`Estoque insuficiente. Disponível: ${estoqueAtual} unidade(s).`)
    }
    if (!Number.isSafeInteger(precoUnitarioCentavos) || precoUnitarioCentavos <= 0) {
      throw new VendaError('O preço cadastrado para este produto é inválido.')
    }

    const totalCentavos = precoUnitarioCentavos * quantidade
    if (!Number.isSafeInteger(totalCentavos)) {
      throw new VendaError('O valor total da venda excede o limite permitido.')
    }

    transacao.update(produtoRef, {
      quantidadeEstoque: estoqueAtual - quantidade,
      ultimaVendaId: vendaRef.id,
      atualizadoEm: serverTimestamp(),
    })

    transacao.set(vendaRef, {
      produtoId,
      produtoNome: String(produto.nome),
      artesaoId: produto.artesaoId,
      artesaoNome: String(produto.artesaoNome ?? ''),
      vendedorId,
      vendedorNome,
      precoUnitarioCentavos,
      quantidade,
      totalCentavos,
      dataHora: serverTimestamp(),
    })
  })

  return vendaRef.id
}

/** Loads canonical and legacy sales made on products owned by the artisan. */
export async function listarVendasDoArtesao(artesaoId: string): Promise<Venda[]> {
  const perfil = await getDoc(doc(db, 'artesaos', artesaoId))
  const idLegado = perfil.exists() && typeof perfil.data().id === 'number'
    ? perfil.data().id as number
    : undefined

  const vendas = collection(db, 'vendas')
  const consultas = [
    getDocs(query(vendas, where('artesaoId', '==', artesaoId))),
  ]
  if (idLegado !== undefined) {
    consultas.push(getDocs(query(vendas, where('artesaoId', '==', idLegado))))
  }

  const snapshots = await Promise.all(consultas)
  const documentos = new Map<string, Venda>()
  for (const snapshot of snapshots) {
    for (const documento of snapshot.docs) {
      documentos.set(documento.id, converterVenda(documento.id, documento.data()))
    }
  }

  return [...documentos.values()].sort((a, b) => b.dataHora.toMillis() - a.dataHora.toMillis())
}
