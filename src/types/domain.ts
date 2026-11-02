import type { Timestamp } from 'firebase/firestore'

/** artesaos/{uid}; the document ID is the Firebase Auth UID. */
export interface Artesao {
  id?: number
  uid?: string
  nome: string
  telefone: string
  email: string
  criadoEm?: Timestamp
}

/**
 * produtos/{documentId}. firestoreId always identifies the persisted document.
 * New documents use the QR UUID as their document ID; legacy documents retain
 * their original document ID so existing QR labels and references keep working.
 */
export interface Produto {
  id: string
  firestoreId: string
  nome: string
  descricao: string
  precoCentavos: number
  quantidadeEstoque: number
  artesaoId: string | number
  artesaoNome: string
  qrCodeId: string
  ativo: boolean
  ultimaVendaId?: string
  criadoEm?: Timestamp
}

/** vendas/{id}. Legacy records may retain numeric artisan IDs and string dates. */
export interface Venda {
  id: string
  produtoId: string
  produtoNome: string
  artesaoId: string | number
  artesaoNome: string
  vendedorId: string
  vendedorNome: string
  precoUnitarioCentavos: number
  quantidade: number
  totalCentavos: number
  dataHora: Timestamp
}
