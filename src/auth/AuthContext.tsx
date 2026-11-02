import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'
import type { Artesao } from '../types/domain'

interface CadastroDados {
  nome: string
  telefone: string
  email: string
  senha: string
}

interface PerfilDados {
  nome: string
  telefone: string
}

interface AuthContextValue {
  user: User | null
  artesao: Artesao | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  entrarComGoogle: () => Promise<void>
  cadastrar: (dados: CadastroDados) => Promise<void>
  atualizarPerfil: (dados: PerfilDados) => Promise<void>
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/** Keep the numeric legacy ID compatible with Kotlin String.hashCode(). */
function idNumericoDoUid(uid: string): number {
  let hash = 0
  for (let index = 0; index < uid.length; index += 1) {
    hash = (Math.imul(hash, 31) + uid.charCodeAt(index)) | 0
  }
  return hash & 0x7fffffff
}

function dadosBasicosDoUsuario(u: User) {
  return {
    id: idNumericoDoUid(u.uid),
    uid: u.uid,
    nome: u.displayName ?? '',
    telefone: '',
    email: u.email ?? '',
    criadoEm: serverTimestamp(),
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [artesao, setArtesao] = useState<Artesao | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelarPerfil: (() => void) | undefined
    let ativo = true

    const cancelarAuth = onAuthStateChanged(auth, (u) => {
      cancelarPerfil?.()
      cancelarPerfil = undefined
      setUser(u)

      if (!u) {
        setArtesao(null)
        setCarregando(false)
        return
      }

      setCarregando(true)
      const referencia = doc(db, 'artesaos', u.uid)

      void (async () => {
        const perfil = await getDoc(referencia)
        if (perfil.exists()) {
          const dados = perfil.data()
          if (typeof dados.id !== 'number' || dados.uid !== u.uid) {
            await updateDoc(referencia, {
              id: idNumericoDoUid(u.uid),
              uid: u.uid,
            })
          }
        }

        if (!ativo || auth.currentUser?.uid !== u.uid) return
        cancelarPerfil = onSnapshot(
          referencia,
          (snap) => {
            setArtesao(snap.exists() ? ({ ...snap.data(), uid: snap.id } as Artesao) : null)
            setCarregando(false)
          },
          () => setCarregando(false),
        )
      })().catch(() => {
        if (ativo && auth.currentUser?.uid === u.uid) setCarregando(false)
      })
    })

    return () => {
      ativo = false
      cancelarAuth()
      cancelarPerfil?.()
    }
  }, [])

  const value: AuthContextValue = {
    user,
    artesao,
    carregando,
    entrar: async (email, senha) => {
      await signInWithEmailAndPassword(auth, email, senha)
    },
    entrarComGoogle: async () => {
      const { user: u } = await signInWithPopup(auth, googleProvider)
      const referencia = doc(db, 'artesaos', u.uid)
      const existente = await getDoc(referencia)
      if (!existente.exists()) {
        await setDoc(referencia, dadosBasicosDoUsuario(u))
      } else if (typeof existente.data().id !== 'number' || existente.data().uid !== u.uid) {
        await updateDoc(referencia, {
          id: idNumericoDoUid(u.uid),
          uid: u.uid,
        })
      }
    },
    cadastrar: async ({ nome, telefone, email, senha }) => {
      const { user: u } = await createUserWithEmailAndPassword(auth, email, senha)
      await updateProfile(u, { displayName: nome })
      await setDoc(doc(db, 'artesaos', u.uid), {
        ...dadosBasicosDoUsuario(u),
        nome,
        telefone,
        email,
      })
    },
    atualizarPerfil: async ({ nome, telefone }) => {
      const u = auth.currentUser
      if (!u) throw new Error('Sua sessão não está disponível. Entre novamente.')

      await updateProfile(u, { displayName: nome })
      await updateDoc(doc(db, 'artesaos', u.uid), {
        nome,
        telefone,
      })
    },
    sair: () => signOut(auth),
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
