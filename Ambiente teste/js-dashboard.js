/* ---------- Helpers & variáveis ---------- */
const diasMediosEl = document.getElementById('diasMedios');
const pedidosNoPrazoEl = document.getElementById('pedidosNoPrazo');
const listaPedidosEl = document.getElementById('listaPedidos');
const listaItens = document.getElementById('listaItensPedido');
const logDashEl = document.getElementById('logContent');

let historico_por_nota = [];
let historico_por_produto = [];
let site = [];
let produtosEnriquecidos = [];
let pedidos = [];
let pedidosOriginais = [];
let filtroAtual = null;
let graficoMes = null;

/* ---------- LOG ---------- */
function log(msg){
    const time = new Date().toLocaleTimeString();
    logDashEl.innerHTML += `[${time}] ${msg}\n`;
    logDashEl.scrollTop = logDashEl.scrollHeight;
}

/* ---------- Funções auxiliares ---------- */
function base64ToArrayBuffer(base64){
    if(!base64) return null;
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++) buffer[i] = binary.charCodeAt(i);
    return buffer;
}

function removeAccents(s){
    return s ? s.normalize('NFD').replace(/[\u0300-\u036f]/g,'') : s;
}

function normalizeStr(s){
    return removeAccents(String(s||'')).trim().toLowerCase().replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ');
}

const headerCandidates = {
  nota: ['nota','numero nota','nro nota','nota fiscal','nº nota','num nota'],
  pedido_internet: ['pedido internet','pedido_internet','pedidointernet','pedido','pedido id','pedidoid','pedido_internet'],
  dt_emissao: ['dt emissao','data emissao','dt_emissao','data_emissao','data de emissao','data de emissão'],
  dt_saida: ['dt saida','data saida','dt_saida','data_saida','data de saida','data de saída','dt saida'],
  sku: ['sku','codigo','codigo sku','codigo do produto','ref','sku produto','cod','codigo'],
  qtde: ['qtde','qtd','quantidade','quant'],
  prazo_disponibilidade: ['prazo de disponibilidade','prazo','prazo_disponibilidade','disponibilidade','prazo entrega','prazo de entrega']
};

function buildHeaderMap(rows){
    const first = rows[0] || {};
    const originalKeys = Object.keys(first);
    const normOriginal = {};
    originalKeys.forEach(k => normOriginal[k] = normalizeStr(k));
    const map = {};
    for(const [canonical, variants] of Object.entries(headerCandidates)){
        let found = null;
        for(const orig of originalKeys){
            for(const v of variants){
                if(normOriginal[orig] === normalizeStr(v)){
                    found = orig; break;
                }
            }
            if(found) break;
        }
        if(!found){
            for(const orig of originalKeys){
                for(const v of variants){
                    const vnorm = normalizeStr(v);
                    const onorm = normOriginal[orig];
                    if(onorm.includes(vnorm) || vnorm.includes(onorm) || onorm.startsWith(vnorm) || onorm.endsWith(vnorm)){
                        found = orig; break;
                    }
                }
                if(found) break;
            }
        }
        if(found) map[canonical] = found;
    }
    return map;
}

function normalizeRows(rows){
    const map = buildHeaderMap(rows);
    return rows.map(r=>{
        const nr = {};
        for(const key in map){
            nr[key] = r[map[key]];
        }
        nr._raw = r;
        return nr;
    });
}

function parseExcelDate(value){
    if(!value && value !== 0) return null;
    if(value instanceof Date) return value;
    if(typeof value === 'number'){
        return new Date(Math.round((value - 25569) * 86400 * 1000));
    }
    if(typeof value === 'string'){
        const s = value.trim();
        const parts = s.split('/');
        if(parts.length===3){
            const d = parseInt(parts[0],10), m = parseInt(parts[1],10)-1, y = parseInt(parts[2],10);
            if(!isNaN(d) && !isNaN(m) && !isNaN(y)) return new Date(y,m,d);
        }
        const parsed = Date.parse(s);
        if(!isNaN(parsed)) return new Date(parsed);
    }
    return null;
}

function calcularDias(emissao, saida){
    if(!emissao || !saida) return 0;
    return Math.max(0, Math.ceil((saida - emissao)/(1000*60*60*24)));
}

function velocidadeEntrega(dias){
    if(dias<=3) return 'Rápido';
    if(dias<=6) return 'Médio';
    return 'Lento';
}

/* ---------- Carregar planilhas ---------- */
function carregarPlanilhas(){
    historico_por_nota = [];
    historico_por_produto = [];
    site = [];
    try{
        const buffer = base64ToArrayBuffer(sessionStorage.getItem('notaFile'));
        if(buffer){
            const workbook = XLSX.read(buffer, {type:'array'});
            const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {defval:''});
            historico_por_nota = normalizeRows(raw);
            log(`Planilha Historico por Nota: ${historico_por_nota.length} linhas carregadas.`);
        } else log('Planilha Historico por Nota não encontrada no sessionStorage.');
    } catch(e){ log('Erro ao ler Historico por Nota: '+(e.message||e)); }

    try{
        const buffer = base64ToArrayBuffer(sessionStorage.getItem('produtoFile'));
        if(buffer){
            const workbook = XLSX.read(buffer, {type:'array'});
            const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {defval:''});
            historico_por_produto = normalizeRows(raw);
            log(`Planilha Historico por Produto: ${historico_por_produto.length} linhas carregadas.`);
        } else log('Planilha Historico por Produto não encontrada no sessionStorage.');
    } catch(e){ log('Erro ao ler Historico por Produto: '+(e.message||e)); }

    try{
        const buffer = base64ToArrayBuffer(sessionStorage.getItem('siteFile'));
        if(buffer){
            const workbook = XLSX.read(buffer, {type:'array'});
            const raw = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], {defval:''});
            site = normalizeRows(raw);
            log(`Planilha Site: ${site.length} linhas carregadas.`);
        } else log('Planilha Site não encontrada no sessionStorage.');
    } catch(e){ log('Erro ao ler Planilha Site: '+(e.message||e)); }
}

/* ---------- Enriquecer produtos ---------- */
function enriquecerProdutos(){
    produtosEnriquecidos = historico_por_produto.map(prod=>{
        const notaValor = prod.nota !== undefined ? String(prod.nota).trim() : String(prod._raw && (prod._raw['Nota']||prod._raw['nota']||'')).trim();
        const notaObj = historico_por_nota.find(n=>{
            if(n.nota !== undefined) return String(n.nota).trim() === notaValor;
            if(n._raw){
                const possible = (n._raw['Nota']||n._raw['nota']||'').toString().trim();
                return possible === notaValor;
            }
            return false;
        });

        const pedido_internet = notaObj ? (notaObj.pedido_internet || notaObj.pedido || notaObj._raw && (notaObj._raw['Pedido Internet']||notaObj._raw['Pedido'])) : undefined;
        const emissao = notaObj ? parseExcelDate(notaObj.dt_emissao || notaObj._raw && (notaObj._raw['DT Emissão']||notaObj._raw['Data Emissão'])) : null;
        const saida = notaObj ? parseExcelDate(notaObj.dt_saida || notaObj._raw && (notaObj._raw['DT Saída']||notaObj._raw['Data Saída'])) : null;

        const skuValor = prod.sku !== undefined ? String(prod.sku).trim() : String(prod._raw && (prod._raw['SKU']||'')).trim();
        const siteRow = site.find(s=>{
            if(s.sku !== undefined) return String(s.sku).trim() === skuValor;
            if(s._raw){
                const possible = (s._raw['SKU']||'').toString().trim();
                return possible === skuValor;
            }
            return false;
        });

        let prazoDisponibilidade = '-';
        if(siteRow){
            const poss = siteRow.prazo_disponibilidade || siteRow._raw && (siteRow._raw['prazo de disponibilidade']||'');
            const m = String(poss).match(/\d+/);
            prazoDisponibilidade = m ? `${m[0]} Dias` : (poss ? String(poss) : '-');
        }

        return {
            nota: notaValor,
            sku: skuValor,
            qtde: prod.qtde !== undefined ? prod.qtde : (prod._raw && (prod._raw['QTDE']||0)),
            pedido_internet,
            dt_emissao: emissao,
            dt_saida: saida,
            prazoDisponibilidade,
            _raw: prod._raw
        };
    });

    const total = produtosEnriquecidos.length;
    const semNota = produtosEnriquecidos.filter(p=>!p.pedido_internet).length;
    const semSite = produtosEnriquecidos.filter(p=>p.prazoDisponibilidade === '-').length;
    log(`Produtos enriquecidos: ${total}. Sem nota/pedido: ${semNota}. Sem prazo: ${semSite}.`);
}

/* ---------- Inicializar pedidos ---------- */
function inicializarPedidos(){
    if(!historico_por_nota.length || !historico_por_produto.length){
        log('Não há dados suficientes para inicializar pedidos.');
        return;
    }
    enriquecerProdutos();

    const pedidosMap = new Map();
    produtosEnriquecidos.forEach(prod=>{
        const pedidoId = prod.pedido_internet ? String(prod.pedido_internet).trim() : null;
        const emissao = parseExcelDate(prod.dt_emissao);
        const saida = parseExcelDate(prod.dt_saida);
        if(!pedidoId || !emissao || !saida) return;
        const dias = calcularDias(emissao, saida);
        if(!pedidosMap.has(pedidoId)){
            pedidosMap.set(pedidoId, {id: pedidoId, dias, velocidade: velocidadeEntrega(dias), dataSaida: saida});
        } else {
            const existing = pedidosMap.get(pedidoId);
            if(dias < existing.dias){ existing.dias = dias; existing.velocidade = velocidadeEntrega(dias); existing.dataSaida = saida; }
        }
    });

    pedidos = Array.from(pedidosMap.values());
    pedidosOriginais = [...pedidos];
    atualizarDash();
}

/* ---------- Atualizar lista de pedidos ---------- */
function atualizarLista(){
    const base = filtroAtual ? pedidosOriginais.filter(p=>{
        const chave = `${p.dataSaida.getFullYear()}-${(p.dataSaida.getMonth()+1).toString().padStart(2,'0')}`;
        return chave===filtroAtual;
    }) : pedidosOriginais;

    listaPedidosEl.innerHTML='';
    base.sort((a,b)=>a.dias-b.dias).forEach(p=>{
        const li=document.createElement('li');
        li.textContent=`Pedido ${p.id} - ${p.velocidade} - ${p.dias} dias`;
        li.style.cursor='pointer';
        li.addEventListener('click', ()=>mostrarItensPedido(p.id));
        listaPedidosEl.appendChild(li);
    });
}

/* ---------- Atualizar dashboard ---------- */
function atualizarDash(){
    if(!pedidos.length){
        diasMediosEl.textContent=0;
        pedidosNoPrazoEl.textContent='0%';
        velocidadeChart.data.datasets[0].data=[0,0,0];
        velocidadeChart.update();
        atualizarLista();
        return;
    }
    const total = pedidos.length;
    const somaDias = pedidos.reduce((s,p)=>s+p.dias,0);
    const mediaDias = somaDias/total;
    const pctPrazo = (pedidos.filter(p=>p.dias<=5).length/total)*100;
    diasMediosEl.textContent=mediaDias.toFixed(1);
    pedidosNoPrazoEl.textContent=`${pctPrazo.toFixed(0)}%`;
    const counts={Rápido:0,Médio:0,Lento:0};
    pedidos.forEach(p=>counts[p.velocidade]++);
    velocidadeChart.data.datasets[0].data=[counts.Rápido, counts.Médio, counts.Lento];
    velocidadeChart.update();
    atualizarLista();
    atualizarAnaliseMensal();
}

/* ---------- Mostrar itens de um pedido ---------- */
function mostrarItensPedido(pedidoInternet){
    listaItens.innerHTML = '';
    const produtosDoPedido = produtosEnriquecidos.filter(p =>
        String(p.pedido_internet || '').trim() === String(pedidoInternet).trim()
    );

    if(produtosDoPedido.length === 0){
        const msg = document.createElement('p');
        msg.textContent = 'Nenhum item encontrado';
        listaItens.appendChild(msg);
        return;
    }

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    const thead = document.createElement('thead');
    const headerRow = document.createElement('tr');
    ['SKU','Qtde','Prazo'].forEach(text=>{
        const th = document.createElement('th');
        th.textContent = text;
        th.style.padding='6px';
        th.style.textAlign='center';
        headerRow.appendChild(th);
    });
    thead.appendChild(headerRow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    produtosDoPedido.forEach(prod=>{
        const tr = document.createElement('tr');
        [prod.sku || '-', prod.qtde || 0, prod.prazoDisponibilidade || '-'].forEach(val=>{
            const td = document.createElement('td');
            td.textContent = val;
            td.style.padding='6px';
            td.style.textAlign='center';
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    listaItens.appendChild(table);
}

/* ---------- Gráfico velocidade ---------- */
const velCtx=document.getElementById('velocidadeChart').getContext('2d');
const velocidadeChart = new Chart(velCtx, {
    type: 'bar',
    data: {
        labels:['Rápido','Médio','Lento'],
        datasets:[{
            label:'Pedidos',
            data:[0,0,0],
            backgroundColor:['#28a745','#ffc107','#ff4d4f']
        }]
    },
    options:{
        responsive:true,
        plugins:{legend:{display:false}},
        onClick:(evt,elements)=>{
            if(elements.length>0){
                const index = elements[0].index;
                const categoria = velocidadeChart.data.labels[index];
                const pedidosFiltrados = pedidosOriginais.filter(p=>p.velocidade===categoria);
                listaPedidosEl.innerHTML='';
                pedidosFiltrados.sort((a,b)=>a.dias-b.dias).forEach(p=>{
                    const li=document.createElement('li');
                    li.textContent=`Pedido ${p.id} - ${p.velocidade} - ${p.dias} dias`;
                    li.style.cursor='pointer';
                    li.addEventListener('click',()=>mostrarItensPedido(p.id));
                    listaPedidosEl.appendChild(li);
                });
                log(`Filtro aplicado: ${categoria} (${pedidosFiltrados.length} pedidos)`);
            }
        }
    }
});

/* ---------- Gráfico mensal ---------- */
function atualizarAnaliseMensal(){
    if(!pedidos.length) return;
    const agrupado = {};
    pedidos.forEach(p=>{
        if(!p.dataSaida) return;
        const chave = `${p.dataSaida.getFullYear()}-${(p.dataSaida.getMonth()+1).toString().padStart(2,'0')}`;
        if(!agrupado[chave]) agrupado[chave]={total:0,somaDias:0,dentroPrazo:0};
        agrupado[chave].total++;
        agrupado[chave].somaDias += p.dias;
        if(p.dias<=5) agrupado[chave].dentroPrazo++;
    });

    const meses = Object.keys(agrupado).sort();
    const mediasDias = meses.map(m=>(agrupado[m].somaDias/agrupado[m].total).toFixed(1));
    const pctPrazo = meses.map(m=>((agrupado[m].dentroPrazo/agrupado[m].total)*100).toFixed(0));

    if(graficoMes) graficoMes.destroy();

    const ctx = document.getElementById('graficoMes').getContext('2d');
    graficoMes = new Chart(ctx,{
        type:'bar',
        data:{
            labels:meses,
            datasets:[{
                label:'Dias Médios',
                data:mediasDias,
                backgroundColor:'#007bff'
            }]
        },
        options:{
            responsive:true,
            plugins:{
                tooltip:{
                    callbacks:{
                        label:function(context){
                            const idx = context.dataIndex;
                            return `Dias Médios: ${mediasDias[idx]}, % Prazo: ${pctPrazo[idx]}%`;
                        }
                    }
                },
                legend:{display:false}
            },
            scales:{
                y:{beginAtZero:true,title:{display:true,text:'Dias'}}
            }
        }
    });
}

/* ---------- Inicialização ao carregar página ---------- */
window.addEventListener('load', ()=>{
    const btnVoltar = document.getElementById('btnVoltar');
    if(btnVoltar) btnVoltar.addEventListener('click', ()=>{ window.location.href='import.html'; });

    carregarPlanilhas();
    inicializarPedidos();

    console.log("Dashboard carregado com sucesso!");
});
