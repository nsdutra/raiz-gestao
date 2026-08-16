// sw.js — Raiz Gestão
//
// Service worker mínimo. Existe só pra satisfazer o critério de
// "instalável" do Android/Chrome (sem service worker registrado, o
// Android costuma cair no atalho genérico do navegador em vez de abrir
// como app de verdade). Não faz cache agressivo de nada — o Módulo de
// Gestão sempre deve carregar a versão mais nova (dado sensível/painel
// de controle, não pode ficar servindo tela desatualizada offline).
// Mesmo racional do sw.js do app de Imóveis.

self.addEventListener('install', function (event) {
    self.skipWaiting();
});

self.addEventListener('activate', function (event) {
    event.waitUntil(self.clients.claim());
});

// Sem 'fetch' listener: deixa tudo passar direto pra rede, sem cache.
