# Artesão Digital — versão web

Versão web do sistema de controle de estoque e vendas do Centro de Artesanato de Tauá.

**Stack:** Vite + React + TypeScript, Tailwind CSS v4, Firebase (Auth, Firestore, Hosting),
React Router, React Hook Form + Zod, html5-qrcode, qrcode.react, Recharts.

## Rodando

```bash
npm install
cp .env.example .env   # preencha com as chaves do app web do Firebase
npm run dev
```

No console do Firebase: ative **Authentication** (E-mail/senha e Google) e crie o **Firestore**.
Publique as regras com `firebase deploy --only firestore:rules`.

## Fases

- [x] 1. Fundação (tema Tauá, rotas, layout, Firebase)
- [x] 2. Autenticação (login, cadastro, Google)
- [ ] 3. Produtos e QR Code
- [ ] 4. Venda com scanner e transação atômica
- [ ] 5. Dashboard e histórico
- [ ] 6. Testes das Security Rules, ajustes e deploy
