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
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from '../lib/firebase'
import type { Artesao } from '../types/domain'

interface CadastroDados {
  nome: string
  telefone: string
  email: string
  senha: string
}

interface AuthContextValue {
  user: User | null
  artesao: Artesao | null
  carregando: boolean
  entrar: (email: string, senha: string) => Promise<void>
  entrarComGoogle: () => Promise<void>
  cadastrar: (dados: CadastroDados) => Promise<void>
  sair: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [artesao, setArtesao] = useState<Artesao | null>(null)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    let cancelarPerfil: (() => void) | undefined
    const cancelarAuth = onAuthStateChanged(auth, (u) => {
      cancelarPerfil?.()
      setUser(u)
      if (!u) {
        setArtesao(null)
        setCarregando(false)
        return
      }
      cancelarPerfil = onSnapshot(
        doc(db, 'artesaos', u.uid),
        (snap) => {
          setArtesao(snap.exists() ? ({ id: snap.id, ...snap.data() } as Artesao) : null)
          setCarregando(false)
        },
        () => setCarregando(false),
      )
    })
    return () => {
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
      const ref = doc(db, 'artesaos', u.uid)
      if (!(await getDoc(ref)).exists()) {
        await setDoc(ref, {
          nome: u.displayName ?? '',
          telefone: '',
          email: u.email ?? '',
          criadoEm: serverTimestamp(),
        })
      }
    },
    cadastrar: async ({ nome, telefone, email, senha }) => {
      const { user: u } = await createUserWithEmailAndPassword(auth, email, senha)
      await updateProfile(u, { displayName: nome })
      await setDoc(doc(db, 'artesaos', u.uid), {
        nome,
        telefone,
        email,
        criadoEm: serverTimestamp(),
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
