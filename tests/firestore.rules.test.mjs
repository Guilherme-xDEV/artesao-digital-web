import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { after, before, beforeEach, test } from 'node:test'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing'
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getFirestore,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'

const projectId = 'demo-artesao-digital-rules'
let environment

const ownerId = 'artisan-owner'
const sellerId = 'artisan-seller'
const outsiderId = 'artisan-outsider'
const productId = 'product-qr-uuid'

const productFixture = {
  nome: 'Handmade clay vase',
  descricao: 'Red clay pottery',
  precoCentavos: 4500,
  quantidadeEstoque: 5,
  artesaoId: ownerId,
  artesaoNome: 'Product Owner',
  qrCodeId: productId,
  ativo: true,
}

before(async () => {
  environment = await initializeTestEnvironment({
    projectId,
    firestore: {
      rules: readFileSync('firestore.rules', 'utf8'),
    },
  })
})

beforeEach(async () => {
  await environment.clearFirestore()
})

after(async () => {
  await environment.cleanup()
})

async function seedProduct() {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(getFirestore(context), 'produtos', productId), productFixture)
  })
}

async function seedProfile(uid) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(getFirestore(context), 'artesaos', uid), {
      nome: uid,
      telefone: '',
      email: `${uid}@example.test`,
    })
  })
}

test('artisan profile is readable only by its owner', async () => {
  await seedProfile(ownerId)

  const ownerDb = getFirestore(environment.authenticatedContext(ownerId))
  const sellerDb = getFirestore(environment.authenticatedContext(sellerId))

  await assertSucceeds(getDoc(doc(ownerDb, 'artesaos', ownerId)))
  await assertFails(getDoc(doc(sellerDb, 'artesaos', ownerId)))
})

test('product creation requires ownership and matching QR document ID', async () => {
  const ownerDb = getFirestore(environment.authenticatedContext(ownerId))
  const validProduct = {
    ...productFixture,
    criadoEm: serverTimestamp(),
  }

  await assertSucceeds(
    setDoc(doc(ownerDb, 'produtos', productId), validProduct),
  )

  await assertFails(
    setDoc(doc(ownerDb, 'produtos', 'different-document-id'), {
      ...validProduct,
      qrCodeId: productId,
    }),
  )

  await assertFails(
    setDoc(doc(getFirestore(environment.authenticatedContext(sellerId)), 'produtos', 'seller-product'), {
      ...productFixture,
      artesaoId: ownerId,
      qrCodeId: 'seller-product',
      criadoEm: serverTimestamp(),
    }),
  )
})

test('only the product owner can edit or deactivate it; direct seller stock edits fail', async () => {
  await seedProduct()

  const ownerDb = getFirestore(environment.authenticatedContext(ownerId))
  const sellerDb = getFirestore(environment.authenticatedContext(sellerId))

  await assertSucceeds(
    updateDoc(doc(ownerDb, 'produtos', productId), {
      nome: 'Updated clay vase',
      atualizadoEm: serverTimestamp(),
    }),
  )

  await assertFails(
    updateDoc(doc(sellerDb, 'produtos', productId), {
      quantidadeEstoque: 4,
    }),
  )

  await assertFails(deleteDoc(doc(ownerDb, 'produtos', productId)))

  await assertSucceeds(
    updateDoc(doc(ownerDb, 'produtos', productId), {
      ativo: false,
      atualizadoEm: serverTimestamp(),
    }),
  )
})

test('a sale and stock decrement are allowed only in the same transaction', async () => {
  await seedProduct()

  const sellerDb = getFirestore(environment.authenticatedContext(sellerId))
  const productRef = doc(sellerDb, 'produtos', productId)
  const saleRef = doc(collection(sellerDb, 'vendas'))

  await assertSucceeds(
    runTransaction(sellerDb, async (transaction) => {
      const productSnapshot = await transaction.get(productRef)
      const product = productSnapshot.data()
      const quantity = 2

      transaction.update(productRef, {
        quantidadeEstoque: product.quantidadeEstoque - quantity,
        ultimaVendaId: saleRef.id,
        atualizadoEm: serverTimestamp(),
      })

      transaction.set(saleRef, {
        produtoId: productId,
        produtoNome: product.nome,
        artesaoId: product.artesaoId,
        artesaoNome: product.artesaoNome,
        vendedorId: sellerId,
        vendedorNome: 'Seller Artisan',
        precoUnitarioCentavos: product.precoCentavos,
        quantidade: quantity,
        totalCentavos: product.precoCentavos * quantity,
        dataHora: serverTimestamp(),
      })
    }),
  )

  const updatedProduct = await getDoc(productRef)
  const createdSale = await getDoc(saleRef)
  assert.equal(updatedProduct.data().quantidadeEstoque, 3)
  assert.equal(createdSale.data().totalCentavos, 9000)
})

test('sales cannot be forged, edited or deleted', async () => {
  await seedProduct()

  const sellerDb = getFirestore(environment.authenticatedContext(sellerId))
  const saleRef = doc(collection(sellerDb, 'vendas'))

  await assertFails(
    setDoc(saleRef, {
      produtoId: productId,
      produtoNome: productFixture.nome,
      artesaoId: ownerId,
      artesaoNome: productFixture.artesaoNome,
      vendedorId: outsiderId,
      vendedorNome: 'Someone else',
      precoUnitarioCentavos: 4500,
      quantidade: 1,
      totalCentavos: 4500,
      dataHora: serverTimestamp(),
    }),
  )
})
