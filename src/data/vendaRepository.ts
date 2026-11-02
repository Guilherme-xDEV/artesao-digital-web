import {
  collection,
  doc,
  getDocs,
  query,
  where,
  runTransaction,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Venda } from '../types/domain'

export class VendaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'VendaError'
  }
}

/**
 * Registra a venda e baixa o estoque na mesma transação.
 * Se houver concorrência ou estoque insuficiente, nenhuma das duas gravações
 * é confirmada isoladamente.
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
    const precoUnitarioCentavos = Number(produto.precoCentavos)

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
      artesaoId: String(produto.artesaoId),
      artesaoNome: String(produto.artesaoNome),
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


/** Loads sales made on products owned by the authenticated artisan. */
export async function listarVendasDoArtesao(artesaoId: string): Promise<Venda[]> {
  const salesQuery = query(
    collection(db, 'vendas'),
    where('artesaoId', '==', artesaoId),
  )
  const snapshot = await getDocs(salesQuery)

  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }) as Venda)
    .sort((a, b) => b.dataHora.toMillis() - a.dataHora.toMillis())
}
