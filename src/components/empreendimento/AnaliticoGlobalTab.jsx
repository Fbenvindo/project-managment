import { useState, useEffect, useMemo, useCallback } from 'react';
import { Atividade, Disciplina, PlanejamentoAtividade, Documento, AlteracaoEtapa, Empreendimento, Usuario, AtividadesDoProjeto } from '@/entities/all';
import { calcularEtapaCorreta } from '../utils/etapaUtils';

const PlanejamentoDocumento = base44.entities.PlanejamentoDocumento;
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import { EtapaEditModal, EditarEtapaEmFolhasModal, ExcluirDeFolhasModal } from './AnaliticoModais';
import { PlusCircle, Search, Filter, MoreHorizontal, Edit, Trash2, Loader2, PackageOpen, Layers, XCircle, FileX, RefreshCw, Edit2, ChevronRight, ChevronDown, Calendar, CheckCircle2, Users2, CheckCircle } from 'lucide-react';
import PlanejamentoAtividadeModal from './PlanejamentoAtividadeModal';
import AtividadeFormModal from './AtividadeFormModal';
import { debounce } from 'lodash';
import { Badge } from '@/components/ui/badge';
import { retryWithBackoff, retryWithExtendedBackoff } from '../utils/apiUtils';
import { Checkbox } from "@/components/ui/checkbox";
import { base44 } from '@/api/base44Client';
import PDFListaDesenvolvimento from '../configuracoes/PDFListaDesenvolvimento';
import { getNextWorkingDay, distribuirHorasPorDias, isWorkingDay, calculateEndDate, ensureWorkingDay } from '../utils/DateCalculator';
import { format, isValid, parseISO, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";

export default function AnaliticoGlobalTab({ empreendimentoId, onUpdate }) {
  const [combinedActivities, setCombinedActivities] = useState([]);
  const [disciplinas, setDisciplinas] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filters, setFilters] = useState({ search: '', disciplina: 'all', etapa: 'all' });
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAtividade, setSelectedAtividade] = useState(null);
  const [isEtapaModalOpen, setIsEtapaModalOpen] = useState(false);
  const [isExcluirDeFolhasModalOpen, setIsExcluirDeFolhasModalOpen] = useState(false);
  const [isEditarEtapaEmFolhasModalOpen, setIsEditarEtapaEmFolhasModalOpen] = useState(false);
  const [isPlanejamentoModalOpen, setIsPlanejamentoModalOpen] = useState(false);
  const [atividadeParaPlanejar, setAtividadeParaPlanejar] = useState(null);
  
  const [isDeletingActivity, setIsDeletingActivity] = useState({});
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isDeletingMultiple, setIsDeletingMultiple] = useState(false);
  const [isRestoringGlobal, setIsRestoringGlobal] = useState(false);
  const [expandedAtividades, setExpandedAtividades] = useState({});
  
  // Estados para rastreamento de alterações
  const [alteracoesEtapa, setAlteracoesEtapa] = useState([]);
  const [empreendimentoNome, setEmpreendimentoNome] = useState("");
  const [isSavingExecutor, setIsSavingExecutor] = useState({});
  const [isConcluindo, setIsConcluindo] = useState({});
  const [datasInicio, setDatasInicio] = useState({});
  const [atividadesSelecionadasParaPlanejar, setAtividadesSelecionadasParaPlanejar] = useState(new Set());
  const [isConcluindoEtapa, setIsConcluindoEtapa] = useState(false);
  const [etapaParaConcluir, setEtapaParaConcluir] = useState('');
  const [isRevertendoEtapa, setIsRevertendoEtapa] = useState(false);
  const [etapaParaReverter, setEtapaParaReverter] = useState('');
  const [isMudandoEtapaGlobal, setIsMudandoEtapaGlobal] = useState(false);
  const [etapaMudancaGlobal, setEtapaMudancaGlobal] = useState('');
  const [editandoTempo, setEditandoTempo] = useState({});
  const [novosTempoPadrao, setNovosTempoPadrao] = useState({});
  const [atividadesSelecionadasParaExcluir, setAtividadesSelecionadasParaExcluir] = useState(new Set());
  const [isExcluindoMultiplasFolhas, setIsExcluindoMultiplasFolhas] = useState(false);

  const documentosMap = useMemo(() => {
    return new Map((documentos || []).map(doc => [doc.id, doc]));
  }, [documentos]);

  const [planejamentos, setPlanejamentos] = useState([]);

  const [allEmpreendimentos, setAllEmpreendimentos] = useState([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [
        projectActivities, 
        planejamentosData,
        allActivities,
        documentosData,
        disciplinasData,
        empreendimentoData,
        alteracoesData,
        usuariosData,
        todosEmpreendimentos,
        atividadesDoProjetoData,
        atividadesEmpreendimentoData,
        pavimentosData
      ] = await Promise.all([
        retryWithBackoff(() => Atividade.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchProjectActivities'),
        retryWithBackoff(() => PlanejamentoAtividade.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchPlanejamentos'),
        retryWithBackoff(() => Atividade.list(), 3, 500, 'fetchAllActivities'),
        retryWithBackoff(() => Documento.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchDocumentos'),
        retryWithBackoff(() => Disciplina.list(), 3, 500, 'fetchDisciplinas'),
        retryWithBackoff(() => Empreendimento.filter({ id: empreendimentoId }), 3, 500, 'fetchEmpreendimento'),
        retryWithBackoff(() => AlteracaoEtapa.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchAlteracoes'),
        retryWithBackoff(() => Usuario.list(), 3, 500, 'fetchUsuarios'),
        retryWithBackoff(() => Empreendimento.list(), 3, 500, 'fetchAllEmpreendimentos'),
        retryWithBackoff(() => AtividadesDoProjeto.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchAtividadesDoProjeto'),
        retryWithBackoff(() => base44.entities.AtividadesEmpreendimento.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchAtividadesEmpreendimento'),
        retryWithBackoff(() => base44.entities.Pavimento.filter({ empreendimento_id: empreendimentoId }), 3, 500, 'fetchPavimentos')
      ]);

      setDocumentos(documentosData || []);
      setEmpreendimentoNome((empreendimentoData && empreendimentoData[0]?.nome) || "");
      setAlteracoesEtapa(alteracoesData || []);
      setUsuarios(usuariosData || []);
      setPlanejamentos(planejamentosData || []);
      setAllEmpreendimentos(todosEmpreendimentos || []);
      
      // Usar AtividadesDoProjeto se disponível, senão usar projectActivities
       const activitiesToProcess = (atividadesDoProjetoData && atividadesDoProjetoData.length > 0) 
         ? atividadesDoProjetoData 
         : projectActivities;

       // MODIFICADO: Sempre buscar overrides de projectActivities (Atividade) independentemente da fonte
       const overrideActivitiesGlobalMap = new Map(); // Overrides sem documento_id específico
       const overrideActivitiesByDocMap = new Map(); // Overrides com documento_id específico (chave: "docId|atividadeId")
       const excludedActivitiesSet = new Set();
       const excludedFromDocumentMap = new Map();

       // Processar overrides sempre da entidade Atividade (projectActivities)
       (projectActivities || []).forEach(pa => {
           if (pa.id_atividade) {
               if (pa.tempo === -999) {
                   if (pa.documento_id) {
                     if (!excludedFromDocumentMap.has(pa.id_atividade)) {
                       excludedFromDocumentMap.set(pa.id_atividade, new Set());
                     }
                     excludedFromDocumentMap.get(pa.id_atividade).add(pa.documento_id);
                   } else {
                     excludedActivitiesSet.add(pa.id_atividade);
                   }
               } else {
                   if (pa.documento_id) {
                     const key = `${pa.documento_id}|${pa.id_atividade}`;
                     overrideActivitiesByDocMap.set(key, pa);
                   } else {
                     overrideActivitiesGlobalMap.set(pa.id_atividade, pa);
                   }
               }
           }
       });
      
      const allGenericActivitiesMap = new Map((allActivities || [])
        .filter(a => !a.empreendimento_id)
        .map(a => [a.id, a])
      );
      
      const planejamentosMap = new Map((planejamentosData || []).map(p => [`${(p.documento_id === undefined || p.documento_id === null || p.documento_id === 'null') ? 'null' : p.documento_id}-${p.atividade_id}`, p]));

      // Buscar etapas cadastradas no empreendimento
      const empreendimento = (empreendimentoData && empreendimentoData[0]) || null;
      const etapasCadastradas = empreendimento?.etapas || [];
      
      const normalizedProjectActivities = (activitiesToProcess || [])
        .filter(pa => !pa.id_atividade && pa.tempo !== -999)
        .map(ativ => ({
          ...ativ,
          uniqueId: `proj-${ativ.id}`,
          source: 'Projeto',
          status: 'N/A',
          isEditable: true,
          base_atividade_id: ativ.id,
      }));

      // Adicionar atividades de Documentação (sempre visíveis)
      const disciplinasDocumentacao = ['Planejamento', 'Gestão', 'BIM', 'Apoio', 'Coordenação'];
      const atividadesDocumentacao = [];
      
      allGenericActivitiesMap.forEach(baseAtividade => {
        if (disciplinasDocumentacao.includes(baseAtividade.disciplina)) {
          const isExcludedFromProject = excludedActivitiesSet.has(baseAtividade.id);
          if (!isExcludedFromProject) {
            const override = overrideActivitiesGlobalMap.get(baseAtividade.id);
            const etapaCorreta = calcularEtapaCorreta(baseAtividade, etapasCadastradas, override);
            
            // Verificar se existe planejamento geral (sem documento_id) para esta atividade
            const planKey = `null-${baseAtividade.id}`;
            const existingPlan = planejamentosMap.get(planKey);
            
            if (existingPlan) {
              // Se há planejamento geral, mostrar como "Planejada" ou "Concluída"
              atividadesDocumentacao.push({
                ...baseAtividade,
                id: existingPlan.id,
                uniqueId: `plano-${existingPlan.id}`,
                atividade: existingPlan.descritivo || baseAtividade.atividade,
                tempo: existingPlan.tempo_planejado,
                source: 'Catálogo',
                source_documento_id: null,
                status: existingPlan.status === 'concluido' ? 'Concluída' : 'Planejada',
                isEditable: false,
                etapa: existingPlan.etapa || etapaCorreta,
                executor_principal: existingPlan.executor_principal,
                base_atividade_id: baseAtividade.id,
              });
            } else {
              // Se não há planejamento, mostrar como "Disponível"
               const executorPrincipal = override ? override.executor_principal : baseAtividade.executor_principal;

               // Aplicar override de tempo se existir
               const tempoFinal = override?.tempo !== undefined && override?.tempo !== null 
                 ? override.tempo 
                 : (baseAtividade.tempo || 0);

               atividadesDocumentacao.push({
                 ...baseAtividade,
                 uniqueId: `doc-${baseAtividade.id}`,
                 id: baseAtividade.id,
                 tempo: tempoFinal,
                 source: 'Catálogo',
                 source_documento_id: null,
                 status: 'Disponível',
                 isEditable: false,
                 etapa: etapaCorreta,
                 executor_principal: executorPrincipal,
                 base_atividade_id: baseAtividade.id,
               });
            }
          }
        }
      });

      let documentActivities = [];
      (documentosData || []).forEach(doc => {
        const subdisciplinasDoc = doc.subdisciplinas || [];
        const disciplinasDoc = doc.disciplinas?.length > 0 ? doc.disciplinas : [doc.disciplina].filter(Boolean);
        const fatorDificuldade = doc.fator_dificuldade || 1;

        // Adicionar atividades específicas vinculadas a este documento
        const atividadesVinculadasDoc = (projectActivities || []).filter(pa => 
          pa.documento_id === doc.id && 
          !pa.id_atividade && 
          pa.tempo !== -999
        );
        
        atividadesVinculadasDoc.forEach(atividadeVinculada => {
          const planKey = `${doc.id}-${atividadeVinculada.id}`;
          const existingPlan = planejamentosMap.get(planKey);
          const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;
          
          if (existingPlan) {
            documentActivities.push({
              ...atividadeVinculada,
              id: existingPlan.id,
              uniqueId: `plano-${existingPlan.id}`,
              atividade: existingPlan.descritivo || atividadeVinculada.atividade,
              tempo: existingPlan.tempo_planejado,
              source: sourceDisplay,
              source_documento_id: doc.id,
              source_documento_numero: doc.numero,
              source_documento_arquivo: doc.arquivo,
              status: existingPlan.status === 'concluido' ? 'Concluída' : 'Planejada',
              isEditable: false,
              etapa: existingPlan.etapa || atividadeVinculada.etapa,
              executor_principal: existingPlan.executor_principal,
              base_atividade_id: atividadeVinculada.id,
            });
          } else {
            documentActivities.push({
              ...atividadeVinculada,
              uniqueId: `avail-${doc.id}-${atividadeVinculada.id}`,
              id: atividadeVinculada.id,
              tempo: atividadeVinculada.tempo || 0,
              source: sourceDisplay,
              source_documento_id: doc.id,
              source_documento_numero: doc.numero,
              source_documento_arquivo: doc.arquivo,
              status: 'Disponível',
              isEditable: false,
              etapa: atividadeVinculada.etapa,
              base_atividade_id: atividadeVinculada.id,
            });
          }
        });
        
        allGenericActivitiesMap.forEach(baseAtividade => {
          const isExcludedFromProject = excludedActivitiesSet.has(baseAtividade.id);
          const isExcludedFromThisDoc = excludedFromDocumentMap.has(baseAtividade.id) && excludedFromDocumentMap.get(baseAtividade.id).has(doc.id);
          if (isExcludedFromProject || isExcludedFromThisDoc) return;

          const disciplinaMatch = disciplinasDoc.includes(baseAtividade.disciplina);
          const subdisciplinaMatch = subdisciplinasDoc.includes(baseAtividade.subdisciplina);

          if (disciplinaMatch && subdisciplinaMatch) {
            const planKey = `${doc.id}-${baseAtividade.id}`;
            const existingPlan = planejamentosMap.get(planKey);
            const overrideKey = `${doc.id}|${baseAtividade.id}`;
            const override = overrideActivitiesByDocMap.get(overrideKey) || overrideActivitiesGlobalMap.get(baseAtividade.id);
            const etapaCorreta = calcularEtapaCorreta(baseAtividade, etapasCadastradas, override);
            const executorPrincipal = override ? override.executor_principal : baseAtividade.executor_principal;

            const sourceDisplay = `Folha: ${doc.numero} - ${doc.arquivo || 'Sem Nome'}`;

            if (existingPlan) {
                documentActivities.push({
                  ...baseAtividade,
                  id: existingPlan.id,
                  uniqueId: `plano-${existingPlan.id}`,
                  atividade: existingPlan.descritivo || baseAtividade.atividade,
                  tempo: existingPlan.tempo_planejado,
                  source: sourceDisplay,
                  source_documento_id: doc.id,
                  source_documento_numero: doc.numero,
                  source_documento_arquivo: doc.arquivo,
                  status: existingPlan.status === 'concluido' ? 'Concluída' : 'Planejada',
                  isEditable: false,
                  etapa: existingPlan.etapa || etapaCorreta,
                  executor_principal: existingPlan.executor_principal || executorPrincipal,
                  base_atividade_id: baseAtividade.id,
                });
              } else {
                // Aplicar override de tempo se existir
                const tempoComOverride = override?.tempo !== undefined && override?.tempo !== null
                  ? override.tempo
                  : (baseAtividade.tempo || 0);
                const tempoFinal = tempoComOverride * fatorDificuldade;

                documentActivities.push({
                    ...baseAtividade,
                    uniqueId: `avail-${doc.id}-${baseAtividade.id}`,
                    id: baseAtividade.id,
                    tempo: tempoFinal,
                    source: sourceDisplay,
                    source_documento_id: doc.id,
                    source_documento_numero: doc.numero,
                    source_documento_arquivo: doc.arquivo,
                    status: 'Disponível',
                    isEditable: false,
                    etapa: etapaCorreta,
                    executor_principal: executorPrincipal,
                    base_atividade_id: baseAtividade.id,
                  });
              }
          }
        });
      });

      setCombinedActivities([...normalizedProjectActivities, ...documentActivities, ...atividadesDocumentacao]);
      setDisciplinas(disciplinasData || []);

    } catch (error) {
      console.error("Erro ao buscar dados do catálogo:", error);
      setCombinedActivities([]);
      setDisciplinas([]);
      setDocumentos([]);
    } finally {
      setIsLoading(false);
    }
  }, [empreendimentoId]);

  useEffect(() => {
    if (empreendimentoId) {
      fetchData();
    }
  }, [fetchData, empreendimentoId]);

  const debouncedSetSearch = useCallback(debounce((value) => {
    setFilters(prev => ({ ...prev, search: value }));
  }, 300), []);

  const atividadesAgrupadas = useMemo(() => {
    const filtered = combinedActivities.filter(ativ => {
      const searchLower = filters.search.toLowerCase();
      const searchMatch = !filters.search ||
        String(ativ.atividade || '').toLowerCase().includes(searchLower) ||
        String(ativ.disciplina || '').toLowerCase().includes(searchLower) ||
        String(ativ.subdisciplina || '').toLowerCase().includes(searchLower) ||
        String(ativ.etapa || '').toLowerCase().includes(searchLower) ||
        String(ativ.source || '').toLowerCase().includes(searchLower) ||
        String(ativ.status || '').toLowerCase().includes(searchLower);
      
      const disciplinaMatch = filters.disciplina === 'all' || ativ.disciplina === filters.disciplina;
      const etapaMatch = filters.etapa === 'all' || ativ.etapa === 'all' || ativ.etapa === filters.etapa;

      return searchMatch && disciplinaMatch && etapaMatch;
    });

    // Agrupar por atividade base
    const grupos = new Map();
    
    filtered.forEach(ativ => {
      const key = `${ativ.base_atividade_id}-${ativ.etapa}-${ativ.disciplina}-${ativ.subdisciplina}`;
      
      if (!grupos.has(key)) {
        grupos.set(key, {
          baseAtividade: ativ,
          folhas: []
        });
      }
      
      if (ativ.source_documento_id) {
        grupos.get(key).folhas.push(ativ);
      }
    });

    return Array.from(grupos.values());
  }, [combinedActivities, filters]);

  const atividadesPorDisciplina = useMemo(() => {
    const disciplinasDocumentacao = ['Planejamento', 'Gestão', 'BIM', 'Apoio', 'Coordenação'];
    const grupos = {};
    const gruposDocumentacao = {};
    
    // Inicializar todas as disciplinas de Documentação com objetos de subdisciplinas
    disciplinasDocumentacao.forEach(disc => {
      gruposDocumentacao[disc] = {};
    });
    
    atividadesAgrupadas.forEach(grupo => {
      const disciplina = grupo.baseAtividade.disciplina || 'Sem Disciplina';
      
      if (disciplinasDocumentacao.includes(disciplina)) {
        // Agrupar Documentação por subdisciplina dentro da disciplina
        const subdisciplina = grupo.baseAtividade.subdisciplina || 'Sem Subdisciplina';
        if (!gruposDocumentacao[disciplina][subdisciplina]) {
          gruposDocumentacao[disciplina][subdisciplina] = [];
        }
        gruposDocumentacao[disciplina][subdisciplina].push(grupo);
      } else {
        if (!grupos[disciplina]) {
          grupos[disciplina] = [];
        }
        grupos[disciplina].push(grupo);
      }
    });

    const result = Object.entries(grupos).sort((a, b) => a[0].localeCompare(b[0]));
    
    // Adicionar apenas disciplinas de Documentação que têm atividades
    Object.entries(gruposDocumentacao)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([disciplina, subdisciplinas]) => {
        const temAtividades = Object.values(subdisciplinas).flat().length > 0;
        if (temAtividades) {
          result.push([disciplina, subdisciplinas]);
        }
      });
    
    return result;
  }, [atividadesAgrupadas]);
  
  const etapasUnicas = useMemo(() => {
    // Buscar etapas do empreendimento cadastrado
    const empreendimento = allEmpreendimentos?.find(e => e.id === empreendimentoId);
    if (empreendimento?.etapas && empreendimento.etapas.length > 0) {
      return empreendimento.etapas;
    }
    // Fallback: etapas únicas das atividades
    return [...new Set(combinedActivities.map(a => a.etapa).filter(Boolean))];
  }, [combinedActivities, empreendimentoId]);

  // [Restante dos handlers omitido para brevidade - são os mesmos do arquivo original]

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Catálogo de Atividades do Empreendimento</h2>
          <p className="text-gray-500">Visualize todas as atividades planejadas e gerencie as atividades específicas do projeto.</p>
          {alteracoesEtapa.length > 0 && (
            <p className="text-sm text-purple-600 mt-1">
              {alteracoesEtapa.length} alteração(ões) de etapa registrada(s)
            </p>
          )}
        </div>
        <div className="flex gap-2 flex-wrap">
          <PDFListaDesenvolvimento empreendimentoId={empreendimentoId} />
          
          <Button onClick={() => handleOpenModal()}>
            <PlusCircle className="w-4 h-4 mr-2" />
            Nova Atividade de Projeto
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4 p-4 bg-white rounded-lg border shadow-sm">
        <div className="relative flex-grow min-w-[250px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input 
            placeholder="Buscar por descrição, origem, status..."
            className="pl-10"
            onChange={(e) => debouncedSetSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={filters.etapa} onValueChange={(value) => setFilters(prev => ({ ...prev, etapa: value }))}>
                <SelectTrigger className="w-auto md:w-48"><SelectValue placeholder="Filtrar por Etapa" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Etapas</SelectItem>
                    {[...new Set(etapasUnicas)].map(etapa => <SelectItem key={etapa} value={etapa}>{etapa}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
        <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <Select value={filters.disciplina} onValueChange={(value) => setFilters(prev => ({ ...prev, disciplina: value }))}>
                <SelectTrigger className="w-auto md:w-48"><SelectValue placeholder="Filtrar por Disciplina" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todas as Disciplinas</SelectItem>
                    {disciplinas.map(d => <SelectItem key={d.id} value={d.nome}>{d.nome}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      ) : (
        <div>Conteúdo renderizado</div>
      )}
    </div>
  );
}