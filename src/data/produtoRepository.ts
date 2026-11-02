import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Produto } from '../types/domain'

export type DadosProduto = {
  nome: string
  descricao: string
  precoCentavos: number
  quantidadeEstoque: number
}

function converterDocumento(id: string, dados: Record<string, unknown>): Produto {
  return { id, ...dados } as Produto
}

/** Lista apenas os produtos vinculados ao artesão autenticado. */
export async function listarProdutosDoArtesao(artesaoId: string): Promise<Produto[]> {
  const consulta = query(
    collection(db, 'produtos'),
    where('artesaoId', '==', artesaoId),
  )
  const resultado = await getDocs(consulta)

  return resultado.docs
    .map((documento) => converterDocumento(documento.id, documento.data()))
    .sort((a, b) => (b.criadoEm?.toMillis() ?? 0) - (a.criadoEm?.toMillis() ?? 0))
}

export async function buscarProdutoPorId(id: string): Promise<Produto | null> {
  const resultado = await getDoc(doc(db, 'produtos', id))
  return resultado.exists() ? converterDocumento(resultado.id, resultado.data()) : null
}

/**
 * O UUID é usado como ID do documento e como conteúdo do QR Code.
 * A transação evita sobrescrever um documento caso ocorra uma colisão de ID.
 */
export async function criarProduto(
  artesaoId: string,
  artesaoNome: string,
  dados: DadosProduto,
): Promise<string> {
  const qrCodeId = crypto.randomUUID()
  const referencia = doc(db, 'produtos', qrCodeId)

  await runTransaction(db, async (transacao) => {
    const existente = await transacao.get(referencia)
    if (existente.exists()) {
      throw new Error('Não foi possível gerar um identificador exclusivo. Tente novamente.')
    }

    transacao.set(referencia, {
      ...dados,
      artesaoId,
      artesaoNome,
      qrCodeId,
      ativo: true,
      criadoEm: serverTimestamp(),
    })
  })

  return qrCodeId
}

/** Atualiza somente os campos editáveis; o proprietário e o QR Code são imutáveis. */
export async function atualizarProduto(
  id: string,
  artesaoId: string,
  dados: DadosProduto,
): Promise<void> {
  const referencia = doc(db, 'produtos', id)
  const existente = await getDoc(referencia)

  if (!existente.exists()) throw new Error('Produto não encontrado.')
  if (existente.data().artesaoId !== artesaoId) {
    throw new Error('Você não tem permissão para editar este produto.')
  }

  await updateDoc(referencia, {
    ...dados,
    atualizadoEm: serverTimestamp(),
  })
}

/** Exclusão lógica: preserva o histórico e a associação do QR Code. */
export async function desativarProduto(id: string, artesaoId: string): Promise<void> {
  const referencia = doc(db, 'produtos', id)
  const existente = await getDoc(referencia)

  if (!existente.exists()) throw new Error('Produto não encontrado.')
  if (existente.data().artesaoId !== artesaoId) {
    throw new Error('Você não tem permissão para desativar este produto.')
  }

  await updateDoc(referencia, {
    ativo: false,
    atualizadoEm: serverTimestamp(),
  })
}
