/* main.js - versão defensiva, NÃO altera layout exceto onde houver elementos esperados */
(function () {
  'use strict';

  const $ = id => document.getElementById(id);

  const toNumber = (v) => {
    const n = Number(String(v).replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const money = (n) => {
    try {
      return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } catch (e) {
      return Number(n).toFixed(2);
    }
  };

  /********** CALCULADORA DE PRODUÇÃO **********/
  function calcularProducao() {
    try {
      const custoUnitario = toNumber($('custoUnitario')?.value);
      const quantidade = toNumber($('quantidade')?.value);
      const resultado = custoUnitario * quantidade;

      const output = $('resultadoProducao');
      if (output) {
        // Apenas atualiza conteúdo do elemento de resultado, sem alterar estrutura/estilos
        output.textContent = `Custo total da produção: R$ ${money(resultado)}`;
      }

      // Salva de forma não destrutiva
      const prev = JSON.parse(localStorage.getItem('calcData') || '{}');
      const newData = Object.assign({}, prev, { custoUnitario, quantidade, resultado });
      localStorage.setItem('calcData', JSON.stringify(newData));
    } catch (err) {
      // não faz nada que altere o layout
      console.error('Erro em calcularProducao:', err);
    }
  }

  /********** CALCULADORA DE CUSTOS DO NEGÓCIO **********/
  function calcularCustosNegocio() {
    try {
      const custosFixos = toNumber($('custosFixos')?.value);
      const custosVariaveis = toNumber($('custosVariaveis')?.value);
      const receita = toNumber($('receita')?.value);

      const totalCustos = custosFixos + custosVariaveis;
      const lucro = receita - totalCustos;

      const output = $('resultadoNegocio');
      if (output) {
        // Mantemos estrutura do elemento - só atualizamos texto/HTML interno
        output.innerHTML = `
          <p>Total de Custos: R$ ${money(totalCustos)}</p>
          <p>Lucro: R$ ${money(lucro)}</p>
        `;
      }

      const prev = JSON.parse(localStorage.getItem('businessData') || '{}');
      const newData = Object.assign({}, prev, { custosFixos, custosVariaveis, receita, totalCustos, lucro });
      localStorage.setItem('businessData', JSON.stringify(newData));
    } catch (err) {
      console.error('Erro em calcularCustosNegocio:', err);
    }
  }

  /********** MÉTRICAS (apenas se existir #metrics-container) **********/
  function atualizarMetrics() {
    try {
      const container = $('metrics-container');
      if (!container) return; // NÃO faz nada se não houver container — evita qualquer interferência

      // Criar/usar uma sub-div específica para dados (isso evita apagar estrutura que você já tenha)
      let dataBox = $('metrics-data');
      if (!dataBox) {
        dataBox = document.createElement('div');
        dataBox.id = 'metrics-data';
        // append no final do container — não substituímos o container inteiro
        container.appendChild(dataBox);
      }

      const calcData = JSON.parse(localStorage.getItem('calcData') || '{}');
      const businessData = JSON.parse(localStorage.getItem('businessData') || '{}');

      // Atualiza apenas o conteúdo da sub-div
      dataBox.innerHTML = `
        <section class="metrics-block">
          <h3>Custos de Produção</h3>
          <p>Custo Unitário: R$ ${money(calcData.custoUnitario || 0)}</p>
          <p>Quantidade: ${calcData.quantidade || 0}</p>
          <p>Custo Total: R$ ${money(calcData.resultado || 0)}</p>
        </section>

        <section class="metrics-block">
          <h3>Custos do Negócio</h3>
          <p>Custos Fixos: R$ ${money(businessData.custosFixos || 0)}</p>
          <p>Custos Variáveis: R$ ${money(businessData.custosVariaveis || 0)}</p>
          <p>Receita: R$ ${money(businessData.receita || 0)}</p>
          <p>Total de Custos: R$ ${money(businessData.totalCustos || 0)}</p>
          <p>Lucro: R$ ${money(businessData.lucro || 0)}</p>
        </section>
      `;
    } catch (err) {
      console.error('Erro em atualizarMetrics:', err);
    }
  }

  /********** BOOTSTRAP — apenas liga ouvintes se os elementos existirem **********/
  document.addEventListener('DOMContentLoaded', function () {
    try {
      // Botões — só adiciona listeners se o elemento existir
      const btnProd = $('btnCalcularProducao');
      if (btnProd && !btnProd.__mainjs_bound) {
        btnProd.addEventListener('click', calcularProducao);
        btnProd.__mainjs_bound = true;
      }

      const btnNeg = $('btnCalcularNegocio');
      if (btnNeg && !btnNeg.__mainjs_bound) {
        btnNeg.addEventListener('click', calcularCustosNegocio);
        btnNeg.__mainjs_bound = true;
      }

      // Atualiza metrics se a página tiver container
      atualizarMetrics();
    } catch (err) {
      console.error('Erro na inicialização do main.js:', err);
    }
  });

  // expõe funções para debug/uso manual se necessário (não altera layout)
  window.__app = {
    calcularProducao,
    calcularCustosNegocio,
    atualizarMetrics
  };
})();
