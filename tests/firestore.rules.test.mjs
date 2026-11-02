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
  deleteField,
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
  id: legacyNumericId(productId),
  firestoreId: productId,
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
    await setDoc(doc(context.firestore(), 'produtos', productId), productFixture)
  })
}

function legacyNumericId(uid) {
  let hash = 0
  for (let index = 0; index < uid.length; index += 1) {
    hash = (Math.imul(hash, 31) + uid.charCodeAt(index)) | 0
  }
  return hash & 0x7fffffff
}

async function seedProfile(uid, id = legacyNumericId(uid)) {
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'artesaos', uid), {
      id,
      uid,
      nome: uid,
      telefone: '',
      email: `${uid}@example.test`,
    })
  })
}

test('artisan profile can only be read and updated by its owner', async () => {
  await seedProfile(ownerId)

  const ownerDb = environment.authenticatedContext(ownerId).firestore()
  const sellerDb = environment.authenticatedContext(sellerId).firestore()

  await assertSucceeds(getDoc(doc(ownerDb, 'artesaos', ownerId)))
  await assertFails(getDoc(doc(sellerDb, 'artesaos', ownerId)))

  await assertSucceeds(
    updateDoc(doc(ownerDb, 'artesaos', ownerId), {
      nome: 'Updated artisan',
      telefone: '(88) 99999-9999',
    }),
  )
  await assertFails(
    updateDoc(doc(sellerDb, 'artesaos', ownerId), {
      nome: 'Unauthorized update',
    }),
  )
})

test('product creation requires ownership and matching QR document ID', async () => {
  const ownerDb = environment.authenticatedContext(ownerId).firestore()
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
    setDoc(doc(environment.authenticatedContext(sellerId).firestore(), 'produtos', 'seller-product'), {
      ...productFixture,
      artesaoId: ownerId,
      qrCodeId: 'seller-product',
      criadoEm: serverTimestamp(),
    }),
  )
})

test('only the product owner can edit or deactivate it; direct seller stock edits fail', async () => {
  await seedProduct()

  const ownerDb = environment.authenticatedContext(ownerId).firestore()
  const sellerDb = environment.authenticatedContext(sellerId).firestore()

  await assertSucceeds(
    updateDoc(doc(ownerDb, 'produtos', productId), {
      nome: 'Updated clay vase',
      atualizadoEm: serverTimestamp(),
    }),
  )

  await assertFails(
    updateDoc(doc(ownerDb, 'produtos', productId), {
      id: 999999,
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

  const sellerDb = environment.authenticatedContext(sellerId).firestore()
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

  // Sales are append-only, even for the artisan who registered the sale.
  await assertFails(updateDoc(saleRef, { totalCentavos: 1 }))
  await assertFails(deleteDoc(saleRef))
})


test('early web product documents can backfill compatibility identifiers', async () => {
  await seedProfile(ownerId)

  const earlyWebProductId = 'early-web-product-uuid'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'produtos', earlyWebProductId), {
      nome: 'Early web product',
      descricao: 'Created before numeric compatibility metadata',
      precoCentavos: 2599,
      quantidadeEstoque: 3,
      artesaoId: ownerId,
      artesaoNome: 'Product Owner',
      qrCodeId: earlyWebProductId,
      ativo: true,
    })
  })

  const ownerDb = environment.authenticatedContext(ownerId).firestore()
  const productRef = doc(ownerDb, 'produtos', earlyWebProductId)
  await assertSucceeds(
    updateDoc(productRef, {
      id: legacyNumericId(earlyWebProductId),
      firestoreId: earlyWebProductId,
      atualizadoEm: serverTimestamp(),
    }),
  )

  const migrated = await getDoc(productRef)
  assert.equal(migrated.data().firestoreId, earlyWebProductId)
  assert.equal(migrated.data().id, legacyNumericId(earlyWebProductId))
  assert.equal(migrated.data().qrCodeId, earlyWebProductId)
})

test('legacy product without artesaoNome can still be deactivated by its owner', async () => {
  const numericOwnerId = 924681
  await seedProfile(ownerId, numericOwnerId)

  const legacyDocumentId = 'legacy-product-without-artisan-name'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'produtos', legacyDocumentId), {
      id: 77125,
      firestoreId: legacyDocumentId,
      nome: 'Legacy product',
      descricao: 'Old Android product document',
      preco: 15.75,
      quantidadeEstoque: 2,
      artesaoId: numericOwnerId,
      qrCodeId: 'legacy-product-qr',
      ativo: true,
    })
  })

  const ownerDb = environment.authenticatedContext(ownerId).firestore()
  await assertSucceeds(
    updateDoc(doc(ownerDb, 'produtos', legacyDocumentId), {
      ativo: false,
      atualizadoEm: serverTimestamp(),
    }),
  )

  const deactivated = await getDoc(doc(ownerDb, 'produtos', legacyDocumentId))
  assert.equal(deactivated.data().ativo, false)
})

test('legacy numeric product ownership and decimal price can be migrated in place', async () => {
  const numericOwnerId = 924681
  await seedProfile(ownerId, numericOwnerId)

  const legacyDocumentId = 'legacy-firestore-document-id'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'produtos', legacyDocumentId), {
      id: 77123,
      firestoreId: legacyDocumentId,
      nome: 'Legacy ceramic vase',
      descricao: 'Created by the previous Android schema',
      preco: 45.5,
      quantidadeEstoque: 7,
      artesaoId: numericOwnerId,
      qrCodeId: 'legacy-qr-uuid',
      ativo: true,
    })
  })

  const ownerDb = environment.authenticatedContext(ownerId).firestore()
  const legacyRef = doc(ownerDb, 'produtos', legacyDocumentId)

  await assertSucceeds(
    updateDoc(legacyRef, {
      artesaoId: ownerId,
      artesaoNome: 'Product Owner',
      firestoreId: legacyDocumentId,
      precoCentavos: 4550,
      preco: deleteField(),
      atualizadoEm: serverTimestamp(),
    }),
  )

  const migrated = await getDoc(legacyRef)
  assert.equal(migrated.data().artesaoId, ownerId)
  assert.equal(migrated.data().precoCentavos, 4550)
  assert.equal(migrated.data().qrCodeId, 'legacy-qr-uuid')
  assert.equal(migrated.id, legacyDocumentId)
})

test('legacy decimal prices can be sold with rounded integer cents', async () => {
  const numericOwnerId = 924681
  await seedProfile(ownerId, numericOwnerId)

  const legacyDocumentId = 'legacy-decimal-product'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'produtos', legacyDocumentId), {
      id: 77124,
      firestoreId: legacyDocumentId,
      nome: 'Legacy woven basket',
      descricao: 'Old Android price format',
      preco: 10.99,
      quantidadeEstoque: 4,
      artesaoId: numericOwnerId,
      qrCodeId: 'legacy-decimal-qr',
      ativo: true,
    })
  })

  const sellerDb = environment.authenticatedContext(sellerId).firestore()
  const productRef = doc(sellerDb, 'produtos', legacyDocumentId)
  const saleRef = doc(collection(sellerDb, 'vendas'))

  await assertSucceeds(
    runTransaction(sellerDb, async (transaction) => {
      const productSnapshot = await transaction.get(productRef)
      const product = productSnapshot.data()
      const quantity = 1

      transaction.update(productRef, {
        quantidadeEstoque: product.quantidadeEstoque - quantity,
        ultimaVendaId: saleRef.id,
        atualizadoEm: serverTimestamp(),
      })

      transaction.set(saleRef, {
        produtoId: legacyDocumentId,
        produtoNome: product.nome,
        artesaoId: numericOwnerId,
        artesaoNome: 'Legacy Artisan',
        vendedorId: sellerId,
        vendedorNome: 'Seller Artisan',
        precoUnitarioCentavos: 1099,
        quantidade: quantity,
        totalCentavos: 1099,
        dataHora: serverTimestamp(),
      })
    }),
  )

  const updatedProduct = await getDoc(productRef)
  assert.equal(updatedProduct.data().quantidadeEstoque, 3)
})

test('artisan can read legacy sales with its numeric profile ID', async () => {
  const numericOwnerId = 924681
  await seedProfile(ownerId, numericOwnerId)

  const saleId = 'legacy-sale'
  await environment.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), 'vendas', saleId), {
      id: 123,
      artesaoId: numericOwnerId,
      artesaoNome: 'Product Owner',
      produtoNome: 'Legacy product',
      quantidade: 1,
      valorTotal: 12.5,
      dataHora: '01/11/2026 15:30',
    })
  })

  const ownerDb = environment.authenticatedContext(ownerId).firestore()
  await assertSucceeds(getDoc(doc(ownerDb, 'vendas', saleId)))
})

test('sales cannot be forged', async () => {
  await seedProduct()

  const sellerDb = environment.authenticatedContext(sellerId).firestore()
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
