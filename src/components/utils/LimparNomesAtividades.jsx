import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';

export default function LimparNomesAtividades() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [resultado, setResultado] = useState(null);

  const limparNomes = async () => {
    if (!window.confirm('Tem certeza que deseja limpar todos os nomes de atividades com prefixos "(Concluída na folha xxx)" e "(Excluída...)"?')) {
      return;
    }

    setIsProcessing(true);
    setResultado(null);

    try {
      console.log('🧹 Iniciando limpeza de nomes de atividades...');
      
      // Buscar todas as atividades
      const todasAtividades = await base44.entities.Atividade.list();
      console.log(`📊 Total de atividades encontradas: ${todasAtividades.length}`);

      let atualizadas = 0;
      let erros = 0;

      for (const atividade of todasAtividades) {
        let nomeOriginal = atividade.atividade;
        let nomeNovo = nomeOriginal;

        // Remover prefixos
        nomeNovo = nomeNovo.replace(/^\(Concluída na folha [^)]+\) /, '');
        nomeNovo = nomeNovo.replace(/^\(Excluída da folha [^)]+\) /, '');
        nomeNovo = nomeNovo.replace(/^\(Excluída\) /, '');

        // Se o nome mudou, atualizar
        if (nomeNovo !== nomeOriginal) {
          try {
            await base44.entities.Atividade.update(atividade.id, { 
              atividade: nomeNovo 
            });
            console.log(`✅ Atualizada: "${nomeOriginal}" → "${nomeNovo}"`);
            atualizadas++;
            
            // Delay para evitar rate limiting
            if (atualizadas % 10 === 0) {
              await new Promise(resolve => setTimeout(resolve, 100));
            }
          } catch (error) {
            console.error(`❌ Erro ao atualizar atividade ${atividade.id}:`, error);
            erros++;
          }
        }
      }

      const msg = `✅ Limpeza concluída!\n\nAtualizadas: ${atualizadas}\nErros: ${erros}`;
      setResultado(msg);
      alert(msg);

    } catch (error) {
      console.error('❌ Erro durante limpeza:', error);
      alert('Erro durante a limpeza: ' + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
      <h3 className="font-semibold mb-2">Utilitário de Limpeza</h3>
      <p className="text-sm text-gray-600 mb-4">
        Remove prefixos "(Concluída na folha xxx)" e "(Excluída...)" dos nomes de atividades.
      </p>
      <Button 
        onClick={limparNomes} 
        disabled={isProcessing}
        variant="outline"
        className="border-yellow-600 text-yellow-700 hover:bg-yellow-100"
      >
        {isProcessing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Processando...
          </>
        ) : (
          '🧹 Limpar Nomes de Atividades'
        )}
      </Button>
      {resultado && (
        <div className="mt-3 p-2 bg-green-50 border border-green-200 rounded text-sm">
          {resultado.split('\n').map((linha, i) => (
            <div key={i}>{linha}</div>
          ))}
        </div>
      )}
    </div>
  );
}