const arquivos = { nota: null, produto: null, site: null };

const inputNota = document.getElementById('planilhaNota');
const inputProduto = document.getElementById('planilhaProduto');
const inputSite = document.getElementById('planilhaSite');

const statusNota = document.getElementById('statusNota');
const statusProduto = document.getElementById('statusProduto');
const statusSite = document.getElementById('statusSite');

const gerarAnaliseBtn = document.getElementById('gerarAnalise');
const logImport = document.getElementById('logImport');

function log(msg){
    const time = new Date().toLocaleTimeString();
    logImport.innerHTML += `[${time}] ${msg}<br>`;
    logImport.scrollTop = logImport.scrollHeight;
}

function atualizarUI(){
    statusNota.textContent = arquivos.nota ? '✅ Carregado' : '❌ Pendente';
    statusNota.className = arquivos.nota ? 'status-ok' : 'status-pend';
    statusProduto.textContent = arquivos.produto ? '✅ Carregado' : '❌ Pendente';
    statusProduto.className = arquivos.produto ? 'status-ok' : 'status-pend';
    statusSite.textContent = arquivos.site ? '✅ Carregado' : '❌ Pendente';
    statusSite.className = arquivos.site ? 'status-ok' : 'status-pend';

    gerarAnaliseBtn.disabled = !(arquivos.nota && arquivos.produto && arquivos.site);
}

inputNota.addEventListener('change', e=>{
    arquivos.nota = e.target.files[0] || null;
    atualizarUI();
    log(`Planilha Nota selecionada: ${arquivos.nota ? arquivos.nota.name : 'nenhuma'}`);
});

inputProduto.addEventListener('change', e=>{
    arquivos.produto = e.target.files[0] || null;
    atualizarUI();
    log(`Planilha Produto selecionada: ${arquivos.produto ? arquivos.produto.name : 'nenhuma'}`);
});

inputSite.addEventListener('change', e=>{
    arquivos.site = e.target.files[0] || null;
    atualizarUI();
    log(`Planilha Site selecionada: ${arquivos.site ? arquivos.site.name : 'nenhuma'}`);
});

// Converte arquivo para sessionStorage usando ArrayBuffer
function fileToSession(key, file){
    return new Promise((resolve,reject)=>{
        const reader = new FileReader();
        reader.onload = e=>{
            const arr = new Uint8Array(e.target.result);
            let binary = '';
            arr.forEach(b=>binary += String.fromCharCode(b));
            sessionStorage.setItem(key, btoa(binary));
            resolve();
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
}

gerarAnaliseBtn.addEventListener('click', async ()=>{
    try{
        log('Iniciando leitura dos arquivos...');
        await fileToSession('notaFile', arquivos.nota);
        log('Planilha Nota carregada no sessionStorage.');
        await fileToSession('produtoFile', arquivos.produto);
        log('Planilha Produto carregada no sessionStorage.');
        await fileToSession('siteFile', arquivos.site);
        log('Planilha Site carregada no sessionStorage.');
        log('Todos os arquivos carregados com sucesso. Redirecionando para o dashboard...');
        window.location.href = 'dashboard.html';
    } catch(err){
        log('Erro ao carregar arquivos: '+err.message);
    }
});

// Função para gerar modelo de Excel
function gerarModelo(tipo){
    let colunas = [];
    let nomeArquivo = '';

    switch(tipo){
        case 'nota':
            colunas = ['Nota', 'Data Emissão', 'Cliente', 'Total'];
            nomeArquivo = 'Modelo_Historico_Nota.xlsx';
            break;
        case 'produto':
            colunas = ['SKU', 'Produto', 'Quantidade', 'Preço'];
            nomeArquivo = 'Modelo_Historico_Produto.xlsx';
            break;
        case 'site':
            colunas = ['SKU', 'Nome Produto', 'Categoria', 'Estoque', 'Preço'];
            nomeArquivo = 'Modelo_Produtos_Site.xlsx';
            break;
    }

    const ws = XLSX.utils.aoa_to_sheet([colunas]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Modelo');
    XLSX.writeFile(wb, nomeArquivo);
}