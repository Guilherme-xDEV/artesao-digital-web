import type { Timestamp } from 'firebase/firestore'

/** artesaos/{uid} — o id do documento é o uid do Firebase Auth. */
export interface Artesao {
  id: string
  nome: string
  telefone: string
  email: string
  criadoEm?: Timestamp
}

/** produtos/{id}; o ID do documento é o UUID codificado no QR Code. */
export interface Produto {
  id: string
  nome: string
  descricao: string
  precoCentavos: number
  quantidadeEstoque: number
  artesaoId: string
  artesaoNome: string
  qrCodeId: string
  ativo: boolean
  ultimaVendaId?: string
  criadoEm?: Timestamp
}

/** vendas/{id} — imutável pelas Security Rules. */
export interface Venda {
  id: string
  produtoId: string
  produtoNome: string
  artesaoId: string
  artesaoNome: string
  vendedorId: string
  vendedorNome: string
  precoUnitarioCentavos: number
  quantidade: number
  totalCentavos: number
  dataHora: Timestamp
}
