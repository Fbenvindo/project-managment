import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, Users, RefreshCw, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { format, addDays, startOfWeek, parseISO, isValid } from "date-fns";
import { ptBR } from "date-fns/locale";
import { PlanejamentoAtividade, Empreendimento, Documento, Equipe, Usuario } from "@/entities/all";
import { retryWithBackoff } from "../utils/apiUtils";

// Função para parsear datas locais
const parseLocalDate = (dateString) => {
  if (!dateString) return null;
  if (dateString instanceof Date) return dateString;
  if (typeof dateString === 'string' && dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

export default function AlocacaoEquipeTab({
  planejamentos: planejamentosProp,
  usuarios: usuariosProp = [],
  empreendimentos: empreendimentosProp,
  documentos: documentosProp,
  equipes: equipesProp
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [planejamentosLocal, setPlanejamentosLocal] = useState([]);
  const [empreendimentosLocal, setEmpreendimentosLocal] = useState([]);
  const [documentosLocal, setDocumentosLocal] = useState([]);
  const [equipesLocal, setEquipesLocal] = useState([]);
  const [usuariosLocal, setUsuariosLocal] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  // Modal de gerenciamento de equipes
  const [showEquipeModal, setShowEquipeModal] = useState(false);
  const [showEquipeForm, setShowEquipeForm] = useState(false);
  const [editingEquipe, setEditingEquipe] = useState(null);
  const [equipeFormData, setEquipeFormData] = useState({ nome: '', cor: '#3B82F6', descricao: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Modal de membros
  const [showMembrosModal, setShowMembrosModal] = useState(false);
  const [selectedEquipe, setSelectedEquipe] = useState(null);

  // Usar dados props se disponíveis, senão usar local
  const planejamentos = planejamentosProp?.length > 0 ? planejamentosProp : planejamentosLocal;
  const empreendimentos = empreendimentosProp?.length > 0 ? empreendimentosProp : empreendimentosLocal;
  const documentos = documentosProp?.length > 0 ? documentosProp : documentosLocal;
  const equipes = equipesProp?.length > 0 ? equipesProp : equipesLocal;
  const usuarios = usuariosProp?.length > 0 ? usuariosProp : usuariosLocal;

  // Carregar dados se não recebeu via props
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [plans, emps, docs, teams, users] = await Promise.all([
        retryWithBackoff(() => PlanejamentoAtividade.list(), 3, 2000, 'AlocacaoEquipe-Planejamentos'),
        retryWithBackoff(() => Empreendimento.list(), 3, 2000, 'AlocacaoEquipe-Empreendimentos'),
        retryWithBackoff(() => Documento.list(), 3, 2000, 'AlocacaoEquipe-Documentos'),
        retryWithBackoff(() => Equipe.list(), 3, 2000, 'AlocacaoEquipe-Equipes'),
        retryWithBackoff(() => Usuario.list(), 3, 2000, 'AlocacaoEquipe-Usuarios')
      ]);
      
      setPlanejamentosLocal(plans || []);
      setEmpreendimentosLocal(emps || []);
      setDocumentosLocal(docs || []);
      setEquipesLocal(teams || []);
      setUsuariosLocal(users || []);
    } catch (error) {
      console.error('Erro ao carregar dados de alocação:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!planejamentosProp?.length) {
      loadData();
    }
  }, [planejamentosProp]);

  // Funções para gerenciar equipes
  const handleSaveEquipe = async (e) => {
    e.preventDefault();
    if (!equipeFormData.nome.trim()) {
      alert('Nome da equipe é obrigatório.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEquipe) {
        await retryWithBackoff(() => Equipe.update(editingEquipe.id, equipeFormData), 3, 1000, 'updateEquipe');
      } else {
        await retryWithBackoff(() => Equipe.create(equipeFormData), 3, 1000, 'createEquipe');
      }
      setShowEquipeForm(false);
      setEditingEquipe(null);
      setEquipeFormData({ nome: '', cor: '#3B82F6', descricao: '' });
      await loadData();
    } catch (error) {
      console.error('Erro ao salvar equipe:', error);
      alert('Erro ao salvar equipe.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditEquipe = (equipe) => {
    setEditingEquipe(equipe);
    setEquipeFormData({
      nome: equipe.nome || '',
      cor: equipe.cor || '#3B82F6',
      descricao: equipe.descricao || ''
    });
    setShowEquipeForm(true);
  };

  const handleDeleteEquipe = async (equipe) => {
    const membros = usuarios.filter(u => u.equipe_id === equipe.id);
    if (membros.length > 0) {
      alert(`Esta equipe possui ${membros.length} membro(s). Remova-os antes de excluir.`);
      return;
    }
    if (!window.confirm(`Deseja excluir a equipe "${equipe.nome}"?`)) return;
    try {
      await retryWithBackoff(() => Equipe.delete(equipe.id), 3, 1000, 'deleteEquipe');
      await loadData();
    } catch (error) {
      console.error('Erro ao excluir equipe:', error);
      alert('Erro ao excluir equipe.');
    }
  };

  const handleOpenMembros = (equipe) => {
    console.log('Abrindo modal de membros para:', equipe);
    setSelectedEquipe(equipe);
    setShowEquipeModal(false); // Fechar modal de gerenciar equipes
    setShowMembrosModal(true);
  };

  const handleAddMembro = async (usuario) => {
    if (!selectedEquipe?.id) {
      alert('Nenhuma equipe selecionada.');
      return;
    }
    try {
      console.log('Adicionando membro:', usuario.id, 'à equipe:', selectedEquipe.id);
      await retryWithBackoff(() => Usuario.update(usuario.id, { equipe_id: selectedEquipe.id }), 3, 1000, 'addMembro');
      console.log('✅ Membro adicionado com sucesso');
      // Recarregar dados
      await loadData();
    } catch (error) {
      console.error('Erro ao adicionar membro:', error);
      alert('Erro ao adicionar membro: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const handleRemoveMembro = async (usuario) => {
    try {
      console.log('Removendo membro:', usuario.id, 'da equipe');
      await retryWithBackoff(() => Usuario.update(usuario.id, { equipe_id: null }), 3, 1000, 'removeMembro');
      console.log('✅ Membro removido com sucesso');
      // Recarregar dados
      await loadData();
    } catch (error) {
      console.error('Erro ao remover membro:', error);
      alert('Erro ao remover membro: ' + (error.message || 'Erro desconhecido'));
    }
  };

  const getMembros = (equipeId) => usuarios.filter(u => u.equipe_id === equipeId);
  const getUsuariosSemEquipe = () => usuarios.filter(u => !u.equipe_id);

  // Gerar dias da semana atual + offset (3 semanas = 21 dias)
  const diasExibidos = useMemo(() => {
    const hoje = new Date();
    const inicioSemana = startOfWeek(addDays(hoje, weekOffset * 7), { weekStartsOn: 1 }); // Segunda
    const dias = [];
    for (let i = 0; i < 21; i++) { // 3 semanas
      dias.push(addDays(inicioSemana, i));
    }
    return dias;
  }, [weekOffset]);

  // Criar mapa de empreendimentos
  const empreendimentosMap = useMemo(() => {
    const map = {};
    (empreendimentos || []).forEach(emp => {
      map[emp.id] = emp;
    });
    return map;
  }, [empreendimentos]);

  // Criar mapa de documentos
  const documentosMap = useMemo(() => {
    const map = {};
    (documentos || []).forEach(doc => {
      map[doc.id] = doc;
    });
    return map;
  }, [documentos]);

  // Criar mapa de equipes por ID
  const equipesMap = useMemo(() => {
    const map = {};
    (equipes || []).forEach(eq => {
      map[eq.id] = eq;
    });
    return map;
  }, [equipes]);

  // Agrupar usuários por equipe (usando equipe_id)
  const usuariosPorEquipe = useMemo(() => {
    const grupos = {};
    
    (usuarios || []).forEach(user => {
      if (!user.nome && !user.full_name) return; // Ignorar usuários sem nome
      
      // Usar equipe_id para agrupar, senão fallback para departamento/cargo
      let nomeEquipe = 'Sem Equipe';
      if (user.equipe_id && equipesMap[user.equipe_id]) {
        nomeEquipe = equipesMap[user.equipe_id].nome;
      } else if (user.departamento) {
        nomeEquipe = user.departamento;
      } else if (user.cargo) {
        nomeEquipe = user.cargo;
      }
      
      if (!grupos[nomeEquipe]) {
        grupos[nomeEquipe] = [];
      }
      grupos[nomeEquipe].push(user);
    });

    // Ordenar usuários dentro de cada equipe
    Object.keys(grupos).forEach(equipe => {
      grupos[equipe].sort((a, b) => {
        const nomeA = a.nome || a.full_name || '';
        const nomeB = b.nome || b.full_name || '';
        return nomeA.localeCompare(nomeB, 'pt-BR');
      });
    });

    return grupos;
  }, [usuarios, equipesMap]);

  // Processar planejamentos por usuário e dia
  const alocacaoPorUsuarioDia = useMemo(() => {
    const alocacao = {};

    (planejamentos || []).forEach(plan => {
      const executor = plan.executor_principal;
      if (!executor) return;

      if (!alocacao[executor]) {
        alocacao[executor] = {
          planejado: {},
          reprogramado: {}
        };
      }

      // Processar horas_por_dia para datas planejadas
      if (plan.horas_por_dia && typeof plan.horas_por_dia === 'object') {
        Object.entries(plan.horas_por_dia).forEach(([dataStr, horas]) => {
          if (Number(horas) > 0) {
            if (!alocacao[executor].planejado[dataStr]) {
              alocacao[executor].planejado[dataStr] = new Set();
            }
            
            // Identificar o empreendimento
            const empId = plan.empreendimento_id;
            const emp = empreendimentosMap[empId];
            const empNome = emp?.nome || 'Sem Emp.';
            
            // Extrair número do documento se houver
            const doc = plan.documento_id ? documentosMap[plan.documento_id] : null;
            const docNumero = doc?.numero || null;
            
            // Adicionar identificador único
            if (docNumero) {
              alocacao[executor].planejado[dataStr].add(docNumero);
            } else if (empNome) {
              alocacao[executor].planejado[dataStr].add(empNome.substring(0, 3).toUpperCase());
            }
          }
        });
      }

      // Verificar se foi reprogramado (inicio_ajustado diferente de inicio_planejado)
      if (plan.inicio_ajustado && plan.inicio_planejado) {
        const ajustado = parseLocalDate(plan.inicio_ajustado);
        const planejado = parseLocalDate(plan.inicio_planejado);
        
        if (ajustado && planejado && ajustado.getTime() !== planejado.getTime()) {
          // Foi reprogramado - marcar nos dias ajustados
          if (plan.horas_por_dia && typeof plan.horas_por_dia === 'object') {
            Object.entries(plan.horas_por_dia).forEach(([dataStr, horas]) => {
              if (Number(horas) > 0) {
                if (!alocacao[executor].reprogramado[dataStr]) {
                  alocacao[executor].reprogramado[dataStr] = new Set();
                }
                
                const doc = plan.documento_id ? documentosMap[plan.documento_id] : null;
                const docNumero = doc?.numero || null;
                const emp = empreendimentosMap[plan.empreendimento_id];
                const empNome = emp?.nome || 'Sem Emp.';
                
                if (docNumero) {
                  alocacao[executor].reprogramado[dataStr].add(docNumero);
                } else if (empNome) {
                  alocacao[executor].reprogramado[dataStr].add(empNome.substring(0, 3).toUpperCase());
                }
              }
            });
          }
        }
      }
    });

    return alocacao;
  }, [planejamentos, empreendimentosMap, documentosMap]);

  // Função para obter cor de fundo baseada em reprogramação
  const getCellStyle = (items, isReprogramado) => {
    if (!items || items.size === 0) return {};
    
    if (isReprogramado) {
      return { backgroundColor: '#FFFF00', color: '#000' }; // Amarelo
    }
    return { backgroundColor: '#90EE90', color: '#000' }; // Verde claro
  };

  return (
    <>
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Alocação por Equipe/Colaborador
        </CardTitle>
        <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset(prev => prev - 1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(0)}>
            Hoje
          </Button>
          <Button variant="outline" size="sm" onClick={() => setWeekOffset(prev => prev + 1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-gray-800 text-white">
                <th className="border border-gray-600 p-1 text-left sticky left-0 bg-gray-800 z-10 min-w-[120px]">Nome</th>
                <th className="border border-gray-600 p-1 text-left min-w-[60px]">Item</th>
                {diasExibidos.map(dia => (
                  <th 
                    key={format(dia, 'yyyy-MM-dd')} 
                    className={`border border-gray-600 p-1 text-center min-w-[40px] ${
                      dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-700' : ''
                    }`}
                  >
                    <div>{format(dia, 'd/MM')}</div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Object.entries(usuariosPorEquipe).map(([equipe, usuariosEquipe]) => (
                <React.Fragment key={equipe}>
                  {/* Linha de cabeçalho da equipe */}
                  <tr className="bg-gray-900 text-white font-bold">
                    <td colSpan={2 + diasExibidos.length} className="border border-gray-600 p-1">
                      {equipe.toUpperCase()}
                    </td>
                  </tr>
                  
                  {/* Linhas de cada usuário */}
                  {usuariosEquipe.map(usuario => {
                    const email = usuario.email;
                    const alocacaoUser = alocacaoPorUsuarioDia[email] || { planejado: {}, reprogramado: {} };
                    
                    return (
                      <React.Fragment key={usuario.id}>
                        {/* Linha Programado */}
                        <tr className="bg-gray-100">
                          <td className="border border-gray-300 p-1 sticky left-0 bg-gray-100 z-10" rowSpan={2}>
                            <div className="font-medium">{usuario.nome || usuario.full_name}</div>
                            <div className="text-gray-500 text-xs">{usuario.cargo || ''}</div>
                          </td>
                          <td className="border border-gray-300 p-1 text-xs">Programado</td>
                          {diasExibidos.map(dia => {
                            const dataStr = format(dia, 'yyyy-MM-dd');
                            const items = alocacaoUser.planejado[dataStr];
                            const hasItems = items && items.size > 0;
                            
                            return (
                              <td 
                                key={dataStr}
                                className={`border border-gray-300 p-0.5 text-center ${
                                  dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-200' : ''
                                }`}
                                style={hasItems ? { backgroundColor: '#90EE90' } : {}}
                                title={hasItems ? Array.from(items).join(', ') : ''}
                              >
                                {hasItems ? Array.from(items).slice(0, 2).join(', ') : ''}
                              </td>
                            );
                          })}
                        </tr>
                        
                        {/* Linha Reprogramado */}
                        <tr className="bg-gray-50">
                          <td className="border border-gray-300 p-1 text-xs">Reprogramado</td>
                          {diasExibidos.map(dia => {
                            const dataStr = format(dia, 'yyyy-MM-dd');
                            const items = alocacaoUser.reprogramado[dataStr];
                            const hasItems = items && items.size > 0;
                            
                            return (
                              <td 
                                key={dataStr}
                                className={`border border-gray-300 p-0.5 text-center ${
                                  dia.getDay() === 0 || dia.getDay() === 6 ? 'bg-gray-200' : ''
                                }`}
                                style={hasItems ? { backgroundColor: '#FFFF00' } : {}}
                                title={hasItems ? Array.from(items).join(', ') : ''}
                              >
                                {hasItems ? Array.from(items).slice(0, 2).join(', ') : ''}
                              </td>
                            );
                          })}
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="flex flex-col items-center justify-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-600">Carregando dados de alocação...</p>
          </div>
        )}

        {!isLoading && Object.keys(usuariosPorEquipe).length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
            <p>Nenhum usuário encontrado para exibir a alocação.</p>
          </div>
        )}
      </CardContent>
    </Card>

      {/* Modal de Gerenciamento de Equipes */}
    <Dialog open={showEquipeModal} onOpenChange={setShowEquipeModal}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Gerenciar Equipes</span>
            <Button size="sm" onClick={() => { setShowEquipeForm(true); setEditingEquipe(null); setEquipeFormData({ nome: '', cor: '#3B82F6', descricao: '' }); }}>
              <Plus className="w-4 h-4 mr-1" />
              Nova Equipe
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {showEquipeForm ? (
          <form onSubmit={handleSaveEquipe} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nome">Nome da Equipe *</Label>
              <Input
                id="nome"
                value={equipeFormData.nome}
                onChange={(e) => setEquipeFormData({ ...equipeFormData, nome: e.target.value })}
                placeholder="Ex: Projetos, Coordenação"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cor">Cor</Label>
              <div className="flex gap-2">
                <Input
                  id="cor"
                  type="color"
                  value={equipeFormData.cor}
                  onChange={(e) => setEquipeFormData({ ...equipeFormData, cor: e.target.value })}
                  className="w-16 h-10 p-1"
                />
                <Input
                  value={equipeFormData.cor}
                  onChange={(e) => setEquipeFormData({ ...equipeFormData, cor: e.target.value })}
                  placeholder="#3B82F6"
                  className="flex-1"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição</Label>
              <Input
                id="descricao"
                value={equipeFormData.descricao}
                onChange={(e) => setEquipeFormData({ ...equipeFormData, descricao: e.target.value })}
                placeholder="Descrição opcional"
              />
            </div>
            <div className="flex justify-end gap-3">
              <Button type="button" variant="outline" onClick={() => setShowEquipeForm(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {editingEquipe ? 'Salvar' : 'Criar'}
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {equipes.map(equipe => {
              const membros = getMembros(equipe.id);
              return (
                <div key={equipe.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: equipe.cor || '#3B82F6' }} />
                    <div>
                      <div className="font-medium">{equipe.nome}</div>
                      <div className="text-xs text-gray-500">{membros.length} membro(s)</div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" onClick={() => handleOpenMembros(equipe)}>
                      <UserPlus className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleEditEquipe(equipe)}>
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => handleDeleteEquipe(equipe)} className="text-red-600">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
            {equipes.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Users className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                <p>Nenhuma equipe cadastrada</p>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>

    {/* Modal de Membros */}
    <Dialog open={showMembrosModal} onOpenChange={setShowMembrosModal}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Membros: {selectedEquipe?.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label className="text-sm font-medium">Membros Atuais</Label>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {selectedEquipe && getMembros(selectedEquipe.id).map(membro => (
                <div key={membro.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                  <div>
                    <span className="font-medium">{membro.nome}</span>
                    <span className="text-xs text-gray-500 ml-2">{membro.cargo || ''}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleRemoveMembro(membro)} className="text-red-600">
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {selectedEquipe && getMembros(selectedEquipe.id).length === 0 && (
                <p className="text-sm text-gray-500 italic">Nenhum membro</p>
              )}
            </div>
          </div>

          <div>
            <Label className="text-sm font-medium">Adicionar Membros</Label>
            <div className="mt-2 space-y-2 max-h-40 overflow-y-auto">
              {getUsuariosSemEquipe().map(usuario => (
                <div key={usuario.id} className="flex items-center justify-between p-2 bg-blue-50 rounded">
                  <div>
                    <span className="font-medium">{usuario.nome}</span>
                    <span className="text-xs text-gray-500 ml-2">{usuario.cargo || ''}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleAddMembro(usuario)} className="text-blue-600">
                    <UserPlus className="w-4 h-4" />
                  </Button>
                </div>
              ))}
              {getUsuariosSemEquipe().length === 0 && (
                <p className="text-sm text-gray-500 italic">Todos já estão em equipes</p>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}