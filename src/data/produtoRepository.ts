import {
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  type DocumentData,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { Produto } from '../types/domain'

export type DadosProduto = {
  nome: string
  descricao: string
  precoCentavos: number
  quantidadeEstoque: number
}

function idNumericoDoUid(uid: string): number {
  let hash = 0
  for (let index = 0; index < uid.length; index += 1) {
    hash = (Math.imul(hash, 31) + uid.charCodeAt(index)) | 0
  }
  return hash & 0x7fffffff
}

function paraCentavos(dados: DocumentData): number {
  const canonico = dados.precoCentavos
  if (typeof canonico === 'number' && Number.isSafeInteger(canonico)) return canonico

  const legado = dados.preco
  if (typeof legado !== 'number' || !Number.isFinite(legado)) return 0
  const centavos = Math.round(legado * 100)
  return Number.isSafeInteger(centavos) ? centavos : 0
}

function converterDocumento(
  documento: QueryDocumentSnapshot<DocumentData> | { id: string; data: () => DocumentData },
): Produto {
  const dados = documento.data()
  return {
    id: documento.id,
    firestoreId: typeof dados.firestoreId === 'string' ? dados.firestoreId : documento.id,
    nome: typeof dados.nome === 'string' ? dados.nome : '',
    descricao: typeof dados.descricao === 'string' ? dados.descricao : '',
    precoCentavos: paraCentavos(dados),
    quantidadeEstoque:
      typeof dados.quantidadeEstoque === 'number' ? dados.quantidadeEstoque : 0,
    artesaoId:
      typeof dados.artesaoId === 'string' || typeof dados.artesaoId === 'number'
        ? dados.artesaoId
        : '',
    artesaoNome: typeof dados.artesaoNome === 'string' ? dados.artesaoNome : '',
    qrCodeId: typeof dados.qrCodeId === 'string' ? dados.qrCodeId : documento.id,
    ativo: typeof dados.ativo === 'boolean' ? dados.ativo : true,
    criadoEm: dados.criadoEm,
    ultimaVendaId: typeof dados.ultimaVendaId === 'string' ? dados.ultimaVendaId : undefined,
  }
}

async function obterIdLegadoDoArtesao(uid: string): Promise<number> {
  const perfil = await getDoc(doc(db, 'artesaos', uid))
  const id = perfil.exists() ? perfil.data().id : undefined
  return typeof id === 'number' && Number.isSafeInteger(id) ? id : idNumericoDoUid(uid)
}

/** Convert a legacy Android product in place without changing its document ID or QR value. */
async function migrarDocumentoLegado(
  documento: DocumentSnapshot<DocumentData>,
  uid: string,
  artesaoNome: string,
): Promise<void> {
  const dados = documento.data()
  if (typeof dados.artesaoId !== 'number') return

  const precoCentavos = paraCentavos(dados)
  if (!Number.isSafeInteger(precoCentavos) || precoCentavos <= 0) {
    throw new Error(`O preço do produto "${dados.nome ?? documento.id}" é inválido.`)
  }

  await updateDoc(documento.ref, {
    id: typeof dados.id === 'number' ? dados.id : idNumericoDoUid(documento.id),
    firestoreId: documento.id,
    artesaoId: uid,
    artesaoNome: typeof dados.artesaoNome === 'string' ? dados.artesaoNome : artesaoNome,
    qrCodeId: typeof dados.qrCodeId === 'string' ? dados.qrCodeId : documento.id,
    precoCentavos,
    preco: deleteField(),
    atualizadoEm: serverTimestamp(),
  })
}

/** List products owned by the signed-in artisan, including legacy numeric ownership. */
export async function listarProdutosDoArtesao(
  artesaoId: string,
  artesaoNome = 'Artesão',
): Promise<Produto[]> {
  const produtos = collection(db, 'produtos')
  const idLegado = await obterIdLegadoDoArtesao(artesaoId)
  const [canonicos, legados] = await Promise.all([
    getDocs(query(produtos, where('artesaoId', '==', artesaoId))),
    getDocs(query(produtos, where('artesaoId', '==', idLegado))),
  ])

  const documentos = new Map<string, QueryDocumentSnapshot<DocumentData>>()
  for (const documento of [...canonicos.docs, ...legados.docs]) {
    documentos.set(documento.id, documento)
  }

  await Promise.all(
    legados.docs.map(async (documento) => {
      try {
        await migrarDocumentoLegado(documento, artesaoId, artesaoNome)
      } catch {
        // Keep the legacy record readable; a later explicit retry can finish migration.
      }
    }),
  )

  return [...documentos.values()]
    .map(converterDocumento)
    .sort((a, b) => {
      const dataA = a.criadoEm?.toMillis?.() ?? 0
      const dataB = b.criadoEm?.toMillis?.() ?? 0
      return dataB - dataA
    })
}

/** Lists active products across artisans, normalizing legacy price fields for display. */
export async function listarProdutosAtivos(): Promise<Produto[]> {
  const consulta = query(collection(db, 'produtos'), where('ativo', '==', true))
  const resultado = await getDocs(consulta)

  return resultado.docs
    .map(converterDocumento)
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
}

export async function buscarProdutoPorId(id: string): Promise<Produto | null> {
  const resultado = await getDoc(doc(db, 'produtos', id))
  return resultado.exists() ? converterDocumento({ id: resultado.id, data: () => resultado.data() }) : null
}

/** QR values on legacy products may differ from their Firestore document IDs. */
export async function buscarProdutoPorQrCode(qrCodeId: string): Promise<Produto | null> {
  const consulta = query(collection(db, 'produtos'), where('qrCodeId', '==', qrCodeId.trim()))
  const resultado = await getDocs(consulta)
  if (!resultado.empty) return converterDocumento(resultado.docs[0])

  return buscarProdutoPorId(qrCodeId.trim())
}

/**
 * The QR UUID remains the document ID for new products. This keeps lookup
 * deterministic and avoids a separate identifier translation.
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
      firestoreId: referencia.id,
      artesaoId,
      artesaoNome,
      qrCodeId,
      ativo: true,
      criadoEm: serverTimestamp(),
    })
  })

  return qrCodeId
}

async function pertenceAoArtesao(
  dados: DocumentData,
  artesaoId: string,
): Promise<boolean> {
  if (dados.artesaoId === artesaoId) return true
  if (typeof dados.artesaoId !== 'number') return false
  return (await obterIdLegadoDoArtesao(artesaoId)) === dados.artesaoId
}

async function garantirProdutoCanonico(
  id: string,
  artesaoId: string,
): Promise<DocumentData> {
  const referencia = doc(db, 'produtos', id)
  const existente = await getDoc(referencia)
  if (!existente.exists()) throw new Error('Produto não encontrado.')

  const dados = existente.data()
  if (!(await pertenceAoArtesao(dados, artesaoId))) {
    throw new Error('Você não tem permissão para alterar este produto.')
  }

  if (typeof dados.artesaoId === 'number') {
    const precoCentavos = paraCentavos(dados)
    if (precoCentavos <= 0) throw new Error('O preço cadastrado para este produto é inválido.')
    await migrarDocumentoLegado(existente, artesaoId, 'Artesão')
    return { ...dados, artesaoId, precoCentavos, firestoreId: id }
  }
  return dados
}

/** Updates editable fields while preserving document ID and QR value. */
export async function atualizarProduto(
  id: string,
  artesaoId: string,
  dados: DadosProduto,
): Promise<void> {
  await garantirProdutoCanonico(id, artesaoId)
  await updateDoc(doc(db, 'produtos', id), {
    ...dados,
    atualizadoEm: serverTimestamp(),
  })
}

/** Logical deletion preserves sales history and QR associations. */
export async function desativarProduto(id: string, artesaoId: string): Promise<void> {
  await garantirProdutoCanonico(id, artesaoId)
  await updateDoc(doc(db, 'produtos', id), {
    ativo: false,
    atualizadoEm: serverTimestamp(),
  })
}
