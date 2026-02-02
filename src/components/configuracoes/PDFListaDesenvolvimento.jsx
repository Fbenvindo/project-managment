import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FileText, Loader2, Download, Calendar } from "lucide-react";
import { AlteracaoEtapa, Atividade, PlanejamentoAtividade } from "@/entities/all";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import jsPDF from 'jspdf';

const LOGO_URL = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/577f93874_logo_Interativa_versao_final_sem_fundo_0002.png";

export default function PDFListaDesenvolvimento({ alteracoes = [], empreendimentoId = null }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pdfUrl, setPdfUrl] = useState(null);
  const [dadosCliente, setDadosCliente] = useState({
    construtora: "",
    empreendimento: ""
  });
  const [atividadesCompletas, setAtividadesCompletas] = useState({});
  const [loadingAtividades, setLoadingAtividades] = useState(false);

  // Buscar todas as atividades do empreendimento quando abrir o modal
  useEffect(() => {
    if (isOpen && empreendimentoId && Object.keys(atividadesCompletas).length === 0) {
      buscarAtividadesEmpreendimento();
    }
  }, [isOpen, empreendimentoId]);

  const buscarAtividadesEmpreendimento = async () => {
    setLoadingAtividades(true);
    try {
      // Buscar todas as atividades planejadas
      const planejamentos = await PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId });
      
      // Buscar atividades globais para pegar nomes
      const atividadesGlobais = await Atividade.list();
      const atividadesMap = new Map(atividadesGlobais.map(a => [a.id, a]));

      // Agrupar por etapa e disciplina
      const grupos = {};
      
      planejamentos.forEach(plano => {
        const etapa = plano.etapa;
        const atividadeGlobal = atividadesMap.get(plano.atividade_id);
        
        if (atividadeGlobal) {
          const disciplina = atividadeGlobal.disciplina;
          
          if (!grupos[etapa]) {
            grupos[etapa] = {};
          }
          if (!grupos[etapa][disciplina]) {
            grupos[etapa][disciplina] = [];
          }
          
          // Evitar duplicatas
          const existe = grupos[etapa][disciplina].some(a => 
            a.nome_atividade === (plano.descritivo || atividadeGlobal.atividade)
          );
          
          if (!existe) {
            grupos[etapa][disciplina].push({
              nome_atividade: plano.descritivo || atividadeGlobal.atividade,
              disciplina: disciplina,
              subdisciplina: atividadeGlobal.subdisciplina
            });
          }
        }
      });

      setAtividadesCompletas(grupos);
    } catch (error) {
      console.error("Erro ao buscar atividades:", error);
      alert("Erro ao buscar atividades do empreendimento");
    } finally {
      setLoadingAtividades(false);
    }
  };

  // Agrupar alterações por etapa nova
  const alteracoesPorEtapa = React.useMemo(() => {
    const grupos = {};
    alteracoes.forEach(alt => {
      if (!grupos[alt.etapa_nova]) {
        grupos[alt.etapa_nova] = {};
      }
      if (!grupos[alt.etapa_nova][alt.disciplina]) {
        grupos[alt.etapa_nova][alt.disciplina] = [];
      }
      grupos[alt.etapa_nova][alt.disciplina].push(alt);
    });
    return grupos;
  }, [alteracoes]);

  const gerarPDF = async (visualizar = false) => {
    if (!dadosCliente.construtora || !dadosCliente.empreendimento) {
      alert("Por favor, preencha os dados do cliente e empreendimento.");
      return;
    }

    setIsGenerating(true);
    
    try {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.width;
      const pageHeight = pdf.internal.pageSize.height;
      const margin = 15;
      let yPos = 20;

      // === CABEÇALHO ===
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = LOGO_URL;
        });
        const logoWidth = 35;
        const logoHeight = (img.height / img.width) * logoWidth;
        pdf.addImage(img, 'PNG', (pageWidth - logoWidth) / 2, yPos, logoWidth, logoHeight);
        yPos += logoHeight + 10;
      } catch (error) {
        console.warn("Erro ao carregar logo, continuando sem ela:", error);
        yPos += 10;
      }

      // Título
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(14);
      pdf.text('LISTA DE DESENVOLVIMENTO DE ATIVIDADES', pageWidth / 2, yPos, { align: 'center' });
      yPos += 15;

      // Dados do cliente
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text(`CONSTRUTORA ${dadosCliente.construtora.toUpperCase()}`, margin, yPos);
      yPos += 6;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(10);
      pdf.text(`Empreendimento: ${dadosCliente.empreendimento}`, margin, yPos);
      yPos += 10;

      // APRESENTAÇÃO
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(11);
      pdf.text('APRESENTAÇÃO', margin, yPos);
      yPos += 6;
      
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(9);
      const apresentacao = `O objetivo deste documento é fornecer informações acerca da lista de atividades e documentos a serem fornecidos em cada etapa de desenvolvimento do projeto.`;
      const linhasApresentacao = pdf.splitTextToSize(apresentacao, pageWidth - 2 * margin);
      pdf.text(linhasApresentacao, margin, yPos);
      yPos += (linhasApresentacao.length * 5) + 10;

      // Função para verificar quebra de página
      const checkPageBreak = (necessarySpace) => {
        if (yPos + necessarySpace > pageHeight - margin) {
          pdf.addPage();
          yPos = margin;
          return true;
        }
        return false;
      };

      // === ATIVIDADES POR ETAPA ===
      // Usar atividades completas do empreendimento se disponível
      const dadosParaPDF = Object.keys(atividadesCompletas).length > 0 ? atividadesCompletas : alteracoesPorEtapa;
      const etapas = Object.keys(dadosParaPDF).sort();
      
      etapas.forEach((etapa, etapaIndex) => {
        checkPageBreak(15);
        
        // Título da etapa
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(11);
        pdf.text(`${etapaIndex + 1}. ${etapa.toUpperCase()}`, margin, yPos);
        yPos += 8;

        const disciplinas = Object.keys(dadosParaPDF[etapa]).sort();
        
        disciplinas.forEach((disciplina, discIndex) => {
          checkPageBreak(12);
          
          // Subtítulo da disciplina
          pdf.setFont('helvetica', 'bold');
          pdf.setFontSize(10);
          pdf.text(`${etapaIndex + 1}.${discIndex + 1} ${disciplina}`, margin + 5, yPos);
          yPos += 7;

          const atividades = dadosParaPDF[etapa][disciplina];
          
          atividades.forEach((atividade, atIndex) => {
            checkPageBreak(6);

            // Item da atividade em formato de tabela
            pdf.setFont('helvetica', 'normal');
            pdf.setFontSize(9);

            const itemNum = atIndex + 1;
            const colWidth = 10;
            const descWidth = pageWidth - 2 * margin - colWidth - 2;

            // Número da atividade
            pdf.setFont('helvetica', 'normal');
            pdf.text(itemNum.toString(), margin, yPos);

            // Descrição da atividade
            const linhas = pdf.splitTextToSize(atividade.nome_atividade, descWidth);
            pdf.text(linhas, margin + colWidth + 2, yPos);

            const alturaLinha = linhas.length * 4;
            yPos += alturaLinha + 3;
          });
          
          yPos += 3; // Espaço entre disciplinas
        });
        
        yPos += 5; // Espaço entre etapas
      });

      // === RODAPÉ ===
      const totalPages = pdf.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        pdf.setPage(i);
        
        // Linha decorativa
        pdf.setDrawColor(200);
        pdf.line(margin, pageHeight - 20, pageWidth - margin, pageHeight - 20);
        
        // Texto do rodapé
        pdf.setFont('helvetica', 'bold');
        pdf.setFontSize(9);
        pdf.setTextColor(100);
        pdf.text('Interativa Engenharia', margin, pageHeight - 12);
        
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.text('Fone (Phone): 55. 11 2533.8282', margin, pageHeight - 8);
        pdf.text('www.interativaengenharia.com.br', margin, pageHeight - 4);
      }

      // Salvar ou Visualizar PDF
      if (visualizar) {
        const pdfBlob = pdf.output('blob');
        const url = URL.createObjectURL(pdfBlob);
        setPdfUrl(url);
      } else {
        const nomeArquivo = `Lista_Desenvolvimento_${dadosCliente.empreendimento.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`;
        pdf.save(nomeArquivo);
        
        alert(`✅ PDF baixado com sucesso!\n\n${alteracoes.length} alterações documentadas`);
        setIsOpen(false);
        setPdfUrl(null);
        setDadosCliente({ construtora: "", empreendimento: "" });
      }
      
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar PDF: " + error.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFechar = () => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    setIsOpen(false);
    setDadosCliente({ construtora: "", empreendimento: "" });
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        disabled={alteracoes.length === 0}
        className="bg-purple-600 hover:bg-purple-700"
      >
        <FileText className="w-4 h-4 mr-2" />
        Gerar PDF de Alterações
        {alteracoes.length > 0 && (
          <span className="ml-2 bg-white text-purple-600 px-2 py-0.5 rounded-full text-xs font-bold">
            {alteracoes.length}
          </span>
        )}
      </Button>

      <Dialog open={isOpen} onOpenChange={handleFechar}>
        <DialogContent className={pdfUrl ? "max-w-4xl max-h-[90vh]" : "max-w-md"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-purple-600" />
              Lista de Desenvolvimento de Atividades
            </DialogTitle>
          </DialogHeader>

          {pdfUrl ? (
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  📄 Visualização do PDF - Role para ver todo o conteúdo
                </p>
              </div>
              
              <iframe
                src={pdfUrl}
                className="w-full h-[600px] border rounded-lg"
                title="Preview do PDF"
              />
              
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleFechar}
                >
                  Fechar
                </Button>
                <Button
                  onClick={() => gerarPDF(false)}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Baixar PDF
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-4">
            {loadingAtividades ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                <p className="text-sm text-blue-800">Buscando atividades do empreendimento...</p>
              </div>
            ) : (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm text-blue-800">
                  📋 {Object.keys(atividadesCompletas).length > 0 ? (
                    <><strong>Todas as atividades planejadas</strong> do empreendimento serão documentadas</>
                  ) : (
                    <><strong>{alteracoes.length} alterações</strong> de etapa serão documentadas no PDF</>
                  )}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="construtora">Construtora *</Label>
              <Input
                id="construtora"
                value={dadosCliente.construtora}
                onChange={(e) => setDadosCliente(prev => ({ ...prev, construtora: e.target.value }))}
                placeholder="Ex: ADOLPHO LINDENBERG"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="empreendimento">Empreendimento *</Label>
              <Input
                id="empreendimento"
                value={dadosCliente.empreendimento}
                onChange={(e) => setDadosCliente(prev => ({ ...prev, empreendimento: e.target.value }))}
                placeholder="Ex: Mário Amaral"
              />
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
              <h4 className="text-xs font-semibold text-gray-700 mb-2">
                {Object.keys(atividadesCompletas).length > 0 ? 'Resumo das atividades:' : 'Resumo das alterações:'}
              </h4>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {Object.keys(atividadesCompletas).length > 0 ? (
                  Object.entries(atividadesCompletas).map(([etapa, disciplinas]) => (
                    <div key={etapa} className="text-xs text-gray-600">
                      <span className="font-medium">{etapa}:</span> {Object.values(disciplinas).flat().length} atividades
                    </div>
                  ))
                ) : (
                  Object.entries(alteracoesPorEtapa).map(([etapa, disciplinas]) => (
                    <div key={etapa} className="text-xs text-gray-600">
                      <span className="font-medium">{etapa}:</span> {Object.values(disciplinas).flat().length} atividades
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={handleFechar}
                  disabled={isGenerating}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={() => gerarPDF(true)}
                  disabled={isGenerating || !dadosCliente.construtora || !dadosCliente.empreendimento}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando...
                    </>
                  ) : (
                    <>
                      <FileText className="w-4 h-4 mr-2" />
                      Visualizar PDF
                    </>
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}