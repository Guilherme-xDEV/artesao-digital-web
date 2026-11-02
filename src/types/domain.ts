import type { Timestamp } from 'firebase/firestore'

/** artesaos/{uid} — o id do documento é o uid do Firebase Auth. */
export interface Artesao {
  id: string
  nome: string
  telefone: string
  email: string
  criadoEm?: Timestamp
}

/** produtos/{id} */
export interface Produto {
  id: string
  nome: string
  descricao: string
  precoCentavos: number // > 0
  quantidadeEstoque: number // >= 0
  artesaoId: string // uid do dono
  artesaoNome: string
  qrCodeId: string // UUID codificado no QR
  ativo: boolean
  criadoEm?: Timestamp
}

/**
 * vendas/{id} — imutável (somente create nas Security Rules).
 * Guarda snapshot de nome/preço para o histórico não mudar se o produto mudar.
 */
export interface Venda {
  id: string
  produtoId: string
  produtoNome: string
  artesaoId: string // dono do produto
  artesaoNome: string
  vendedorId: string // uid de quem registrou a venda (RF10)
  vendedorNome: string
  precoUnitarioCentavos: number
  quantidade: number // >= 1
  totalCentavos: number
  dataHora: Timestamp
}
