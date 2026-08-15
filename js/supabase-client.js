// ============================================================================
// js/supabase-client.js — Raiz Gestão
//
// Mesmo projeto Supabase, mesma "anon key" e mesmo mecanismo de login do
// app de Imóveis (Supabase Auth). Não é um login novo — é a MESMA conta.
// O que muda é o que a pessoa vê depois de logar, e isso vem do catálogo
// de licenças/funcionalidades no banco (área = 'gestao'), não de nada
// fixo neste arquivo. Ver MODULO_GESTAO_ESTRATEGIA_ARQUITETURA.md, seção 3.
//
// A chave "anon" abaixo é segura pra ficar visível no código — mesma nota
// de segurança do app de Imóveis: a proteção de verdade é o RLS no banco,
// não o sigilo desta chave. NUNCA colocar aqui a chave "service_role".
// ============================================================================

const SUPABASE_URL = "https://oduwpttbbemypiypjsux.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9kdXdwdHRiYmVteXBpeXBqc3V4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyODEyOTcsImV4cCI6MjEwMDg1NzI5N30.9-cu1CV1wPbo5UH1G2eAsWqsvS54AWNuQZOlifc9a7w";

const { createClient } = supabase;
const dbAuth = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Guarda a pessoa/perfil logado nesta sessão, depois de verificarAcesso().
let pessoaLogada = null;

// ----------------------------------------------------------------------------
// Login (mesmo formulário e-mail/senha do app de Imóveis)
// ----------------------------------------------------------------------------
async function fazerLoginGestao() {

    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const statusEl = document.getElementById('login-status');

    if (!email || !senha) {
        statusEl.textContent = 'Preencha e-mail e senha.';
        return;
    }

    statusEl.textContent = 'Entrando...';

    const { error } = await dbAuth.auth.signInWithPassword({ email, password: senha });

    if (error) {
        statusEl.textContent = 'Não foi possível entrar: ' + error.message;
        return;
    }

    await verificarAcessoGestao();
}

// ----------------------------------------------------------------------------
// Depois do login: confirma que esta pessoa tem, hoje, uma licença ativa
// do módulo 'gestao' — não confia em nenhum e-mail/UUID fixo no código.
// Precisa que comercial_fase1_v1.sql já tenha rodado (licença semente).
// ----------------------------------------------------------------------------
async function verificarAcessoGestao() {

    const statusEl = document.getElementById('login-status');

    const { data: { user } } = await dbAuth.auth.getUser();

    if (!user) {
        statusEl.textContent = 'Sessão inválida — faça login novamente.';
        return;
    }

    // Busca a(s) linha(s) de "pessoas" ligadas a este login, com licença
    // ativa do módulo 'gestao' na respectiva empresa.
    const { data: pessoas, error } = await dbAuth
        .from('pessoas')
        .select('id, nome, perfil, cliente_id, clientes(nome_empresa)')
        .eq('user_id', user.id);

    if (error) {
        statusEl.textContent = 'Erro ao verificar acesso: ' + error.message;
        return;
    }

    if (!pessoas || pessoas.length === 0) {
        statusEl.textContent = 'Login sem cadastro de pessoa vinculado.';
        return;
    }

    // Confere licença ativa do módulo 'gestao' pra alguma das empresas
    // desta pessoa (normalmente só a empresa Raízes Tech).
    const clienteIds = pessoas.map(p => p.cliente_id);
    const { data: licencas, error: errLic } = await dbAuth
        .from('licencas')
        .select('cliente_id, status')
        .in('cliente_id', clienteIds)
        .eq('modulo', 'gestao')
        .eq('status', 'ativo');

    if (errLic || !licencas || licencas.length === 0) {
        statusEl.textContent = 'Este login não tem licença ativa do Módulo de Gestão.';
        await dbAuth.auth.signOut();
        return;
    }

    pessoaLogada = pessoas.find(p => licencas.some(l => l.cliente_id === p.cliente_id));

    entrarNaGestao();
}

function entrarNaGestao() {
    document.getElementById('area-login').classList.add('hidden');
    document.getElementById('area-app').classList.remove('hidden');
    document.getElementById('nome-pessoa-logada').textContent = pessoaLogada.nome;
    if (typeof telaParametrosMasterInit === 'function') telaParametrosMasterInit();
}

async function fazerLogoutGestao() {
    await dbAuth.auth.signOut();
    location.reload();
}

// Se já existe uma sessão válida (recarregou a página), pula direto o login.
dbAuth.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session) verificarAcessoGestao();
});
