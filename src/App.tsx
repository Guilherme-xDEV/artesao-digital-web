import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { AppShell } from './components/AppShell'
import Login from './pages/Login'
import Cadastro from './pages/Cadastro'
import Dashboard from './pages/Dashboard'
import Produtos from './pages/Produtos'
import CadastroProduto from './pages/CadastroProduto'
import ProdutoQrCode from './pages/ProdutoQrCode'
import RegistrarVenda from './pages/RegistrarVenda'
import EmBreve from './pages/EmBreve'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/cadastro" element={<Cadastro />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<AppShell />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/produtos" element={<Produtos />} />
              <Route path="/produtos/novo" element={<CadastroProduto />} />
              <Route path="/produtos/:id/editar" element={<CadastroProduto />} />
              <Route path="/produtos/:id/qrcode" element={<ProdutoQrCode />} />
              <Route path="/vendas/nova" element={<RegistrarVenda />} />
              <Route path="/vendas/historico" element={<EmBreve titulo="Histórico de vendas" />} />
              <Route path="/perfil" element={<EmBreve titulo="Perfil" />} />
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
