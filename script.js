import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const supabaseUrl = "https://yahwpojiggthmbxuqaku.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlhaHdwb2ppZ2d0aG1ieHVxYWt1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgyNDk2OTgsImV4cCI6MjA1MzgyNTY5OH0.Ni9iO_jFXbzWTrxXxeudWJIyiJVO_LIjnhuDIehthCI";
const supabase = createClient(supabaseUrl, supabaseKey);

// Referências aos elementos da interface
const loginDiv = document.getElementById("login");
const salaDiv = document.getElementById("sala");
const nomeSala = document.getElementById("nomeSala");
const membrosDiv = document.getElementById("membros");
const mensagensDiv = document.getElementById("mensagens");
const mensagemInput = document.getElementById("mensagem");

document.getElementById("entrarNoGrupo").addEventListener("click", entrarNoGrupo);
document.getElementById("enviarMensagem").addEventListener("click", enviarMensagem);

// Monitoramento de mudanças no banco de dados
supabase.channel("grupos_changes")
  .on("postgres_changes", { event: "UPDATE", schema: "public", table: "grupos" }, payload => {
    console.log("Atualização detectada no grupo:", payload);
    if (payload.new) {
      carregarMensagens(payload.new);
      carregarMembros(payload.new);
    }
  })
  .subscribe();

async function cadastrarUsuario(nome, contato, curso, codigoGrupo) {
  try {
    let { data: usuario, error } = await supabase.from("usuarios").select("*").eq("contato", contato).single();
    if (error && error.code !== "PGRST116") {
      throw error;
    }
    if (!usuario) {
      const { data, error: insertError } = await supabase.from("usuarios").insert([{ nome, contato, curso, codigo_grupo: codigoGrupo }]).select();
      if (insertError) throw insertError;
      return data ? data[0] : null;
    } else {
      const { error: updateError } = await supabase.from("usuarios").update({ codigo_grupo: codigoGrupo, curso }).eq("contato", contato);
      if (updateError) throw updateError;
    }
    return usuario;
  } catch (err) {
    console.error("Erro ao cadastrar usuário:", err);
  }
}

async function entrarNoGrupo() {
  const nome = document.getElementById("nome").value.trim();
  const contato = document.getElementById("contato").value.trim();
  const curso = document.getElementById("curso").value.trim();
  const codigoGrupo = document.getElementById("codigoGrupo").value.trim();

  if (!nome || !contato || !curso || !codigoGrupo) {
    alert("Preencha todos os campos!");
    return;
  }

  try {
    const usuario = await cadastrarUsuario(nome, contato, curso, codigoGrupo);
    let { data: grupo, error } = await supabase.from("grupos").select("*").eq("codigo", codigoGrupo).single();

    if (!grupo) {
      const novoGrupo = { codigo: codigoGrupo, membros: [{ nome, contato, curso }], mensagens: [] };
      const { data, error } = await supabase.from("grupos").insert([novoGrupo]).select();
      if (error) throw error;
      grupo = data[0];
    } else {
      let membros = grupo.membros || [];
      if (!membros.some(m => m.contato === contato)) {
        membros.push({ nome, contato, curso });
        await supabase.from("grupos").update({ membros }).eq("codigo", codigoGrupo);
      }
    }
    loginDiv.style.display = "none";
    salaDiv.style.display = "block";
    nomeSala.textContent = `Grupo: ${codigoGrupo}`;
    carregarMembros(grupo);
    carregarMensagens(grupo);
  } catch (err) {
    console.error("Erro ao entrar no grupo:", err);
  }
}

function carregarMembros(grupo) {
  membrosDiv.innerHTML = grupo.membros.map(m => `<p><strong>${m.nome}:</strong> ${m.contato}</p>`).join("");
}

async function carregarMensagens(grupo) {
  try {
    let { data: grupoAtualizado, error } = await supabase.from("grupos").select("*").eq("codigo", grupo.codigo).single();
    if (error) throw error;
    const mensagens = grupoAtualizado.mensagens || [];
    mensagensDiv.innerHTML = mensagens.map(msg => `<p><strong>${msg.nome}:</strong> ${msg.texto}</p>`).join("");
  } catch (err) {
    console.error("Erro ao buscar mensagens:", err);
  }
}

async function enviarMensagem() {
  const mensagemTexto = mensagemInput.value.trim();
  if (!mensagemTexto) return;
  
  const codigoGrupo = nomeSala.textContent.replace("Grupo: ", "");
  try {
    let { data: grupo, error } = await supabase.from("grupos").select("*").eq("codigo", codigoGrupo).single();
    if (error) throw error;
    
    let usuario = grupo.membros.find(m => m.contato === document.getElementById("contato").value);
    let nomeUsuario = usuario ? usuario.nome : "Anônimo";
    grupo.mensagens.push({ nome: nomeUsuario, texto: mensagemTexto });
    
    await supabase.from("grupos").update({ mensagens: grupo.mensagens }).eq("codigo", codigoGrupo);
    carregarMensagens(grupo);
    mensagemInput.value = "";
  } catch (err) {
    console.error("Erro ao enviar mensagem:", err);
  }
}
