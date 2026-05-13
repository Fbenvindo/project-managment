import { useState, useEffect, useCallback } from 'react';
import { AtividadeFuncao, PlanejamentoAtividade, Usuario } from '@/entities/all';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { PlusCircle, Edit, Trash2, Loader2, PackageOpen, Calendar as CalendarIcon, Bell, ChevronDown, ChevronRight, PlayCircle, CheckCircle } from 'lucide-react';
import { retryWithBackoff } from '../utils/apiUtils';
import { ptBR } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { format, addDays, addWeeks, addMonths, isWeekend, parseISO, setDate } from 'date-fns';
import { distribuirHorasSimples } from '../utils/DateCalculator';

const DIAS_DA_SEMANA = [
  { value: 1, label: 'S' }, // Segunda
  { value: 2, label: 'T' }, // Terça
  { value: 3, label: 'Q' }, // Quarta
  { value: 4, label: 'Q' }, // Quinta
  { value: 5, label: 'S' }, // Sexta
  { value: 6, label: 'S' }, // Sábado
  { value: 0, label: 'D' }  // Domingo
];


export default function AtividadeFuncaoManager() {
  const [atividadesFuncao, setAtividadesFuncao] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAtividade, setEditingAtividade] = useState(null);
  const [isSaving, setIsSaving] = useState(false);
  const [gruposColapsados, setGruposColapsados] = useState(null); // null = ainda não inicializado

  // Modal de gerar planejamento
  const [showPlanejamentoModal, setShowPlanejamentoModal] = useState(false);
  const [funcaoSelecionada, setFuncaoSelecionada] = useState(null);
  const [usuarioSelecionado, setUsuarioSelecionado] = useState('');
  const [dataInicioPlanejamento, setDataInicioPlanejamento] = useState(null);
  const [isGerandoPlanejamento, setIsGerandoPlanejamento] = useState(false);
  const [resultadoPlanejamento, setResultadoPlanejamento] = useState(null);

  const [formData, setFormData] = useState({
    funcao: '',
    atividade: '',
    frequencia: 'semanal',
    tempo_estimado: 1,
    dias_semana: [1, 2, 3, 4, 5],
    dia_mes: 1,
  });

  useEffect(() => {
    Usuario.list().then(data => setUsuarios(data || [])).catch(console.error);
  }, []);

  const loadAtividadesFuncao = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await retryWithBackoff(() => AtividadeFuncao.list('-created_date'), 3, 1000, 'loadAtividadesFuncao');
      
      // NOVO: Ordenar por função (cargo) alfabeticamente
      const dataOrdenada = (data || []).sort((a, b) => {
        const funcaoA = (a.funcao || '').toLowerCase();
        const funcaoB = (b.funcao || '').toLowerCase();
        return funcaoA.localeCompare(funcaoB, 'pt-BR');
      });
      
      setAtividadesFuncao(dataOrdenada);
      setError(null);
    } catch (err) {
      console.error("Erro ao carregar atividades por função:", err);
      setError("Não foi possível carregar os modelos de atividade.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAtividadesFuncao();
  }, [loadAtividadesFuncao]);

  useEffect(() => {
    // Auto-select weekdays if frequency is daily
    if (formData.frequencia === 'diaria') {
      setFormData(prev => ({ ...prev, dias_semana: [1, 2, 3, 4, 5] }));
    }
  }, [formData.frequencia]);

  const handleDiaSemanaToggle = (dia) => {
    if (formData.frequencia === 'diaria') return; // Do not allow changes for daily
    setFormData(prev => {
      const dias = prev.dias_semana.includes(dia)
        ? prev.dias_semana.filter(d => d !== dia)
        : [...prev.dias_semana, dia];
      return { ...prev, dias_semana: dias };
    });
  };

  const handleAddNew = () => {
    setEditingAtividade(null);
    setFormData({
      funcao: '',
      atividade: '',
      frequencia: 'semanal',
      tempo_estimado: 1,
      dias_semana: [1, 2, 3, 4, 5],
      dia_mes: 1,
    });
    setShowForm(true);
  };

  const handleEdit = (atividade) => {
    setEditingAtividade(atividade);
    setFormData({
      ...atividade,
      dias_semana: atividade.dias_semana || [1, 2, 3, 4, 5],
      dia_mes: atividade.dia_mes || 1,
    });
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Tem certeza que deseja excluir este modelo de atividade?")) return;
    try {
      await retryWithBackoff(() => AtividadeFuncao.delete(id), 3, 1000, 'deleteAtividadeFuncao');
      loadAtividadesFuncao();
    } catch (err) {
      console.error("Erro ao excluir:", err);
      alert("Falha ao excluir o modelo.");
    }
  };
  
  const handleSave = async (e) => {
    e.preventDefault();
    if (!formData.funcao || !formData.atividade || !formData.tempo_estimado) {
      alert("Por favor, preencha Função, Atividade e Tempo Estimado.");
      return;
    }
    setIsSaving(true);
    try {
      const dataToSave = { ...formData, tempo_estimado: Number(formData.tempo_estimado), dia_mes: Number(formData.dia_mes) };
      if (editingAtividade) {
        await retryWithBackoff(() => AtividadeFuncao.update(editingAtividade.id, dataToSave), 3, 1000, 'updateAtividadeFuncao');
      } else {
        await retryWithBackoff(() => AtividadeFuncao.create(dataToSave), 3, 1000, 'createAtividadeFuncao');
      }
      setShowForm(false);
      loadAtividadesFuncao();
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Falha ao salvar o modelo.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAbrirPlanejamento = (funcao, e) => {
    e.stopPropagation();
    setFuncaoSelecionada(funcao);
    setUsuarioSelecionado('');
    setDataInicioPlanejamento(null);
    setResultadoPlanejamento(null);
    setShowPlanejamentoModal(true);
  };

  const calcularDataAtividade = (dataInicio, atividade) => {
    const { frequencia, dias_semana, dia_mes } = atividade;
    let data = new Date(dataInicio);

    if (frequencia === 'diaria' || frequencia === 'semanal' || frequencia === 'quinzenal') {
      // Encontrar o próximo dia da semana válido a partir da data de início
      const diasValidos = dias_semana && dias_semana.length > 0 ? dias_semana : [1];
      let tentativas = 0;
      while (!diasValidos.includes(data.getDay()) && tentativas < 14) {
        data = addDays(data, 1);
        tentativas++;
      }
    } else if (frequencia === 'mensal') {
      // Ir para o dia do mês
      data = setDate(data, dia_mes || 1);
      if (data < dataInicio) data = addMonths(data, 1);
    }

    // Se cair no fim de semana, avançar para segunda
    while (isWeekend(data)) data = addDays(data, 1);
    return data;
  };

  const handleGerarPlanejamento = async () => {
    if (!usuarioSelecionado || !dataInicioPlanejamento || !funcaoSelecionada) return;

    setIsGerandoPlanejamento(true);
    setResultadoPlanejamento(null);

    try {
      const atividadesDaFuncao = gruposPorFuncao[funcaoSelecionada] || [];
      // Excluir ocasionais (essas são geradas por notificação)
      const atividadesParaPlanejar = atividadesDaFuncao.filter(a => a.frequencia !== 'ocasional');

      let criadas = 0;
      let erros = 0;

      for (const atividade of atividadesParaPlanejar) {
        const dataAtividade = calcularDataAtividade(dataInicioPlanejamento, atividade);
        const { distribuicao, dataTermino } = distribuirHorasSimples(dataAtividade, atividade.tempo_estimado, 8);

        await PlanejamentoAtividade.create({
          descritivo: atividade.atividade,
          base_descritivo: atividade.atividade,
          tempo_planejado: atividade.tempo_estimado,
          executor_principal: usuarioSelecionado,
          executores: [usuarioSelecionado],
          status: 'nao_iniciado',
          inicio_planejado: format(dataAtividade, 'yyyy-MM-dd'),
          termino_planejado: format(dataTermino, 'yyyy-MM-dd'),
          horas_por_dia: distribuicao,
          prioridade: 1,
          etapa: 'Execução'
        });
        criadas++;
      }

      setResultadoPlanejamento({ criadas, erros, total: atividadesParaPlanejar.length });
    } catch (err) {
      console.error('Erro ao gerar planejamento:', err);
      setResultadoPlanejamento({ erro: err.message });
    } finally {
      setIsGerandoPlanejamento(false);
    }
  };

  const formatFrequencia = (atividade) => {
    const { frequencia, dias_semana, dia_mes } = atividade;
    const diasMap = { 0: 'Dom', 1: 'Seg', 2: 'Ter', 3: 'Qua', 4: 'Qui', 5: 'Sex', 6: 'Sáb' };
    
    switch (frequencia) {
      case 'diaria': return 'Diariamente (Seg-Sex)';
      case 'semanal':
      case 'quinzenal':
        const diasOrdenados = dias_semana.sort();
        const diasStr = diasOrdenados.length > 0 ? diasOrdenados.map(d => diasMap[d]).join(', ') : 'Nenhum dia';
        return `${frequencia.charAt(0).toUpperCase() + frequencia.slice(1)} (${diasStr})`;
      case 'mensal':
        return `Todo dia ${dia_mes}`;
      case 'ocasional':
        return 'Ocasional (Notifica sexta-feira)';
      default:
        return 'N/A';
    }
  };

  // Agrupar atividades por função
  const gruposPorFuncao = atividadesFuncao.reduce((acc, item) => {
    const funcao = item.funcao || 'Sem função';
    if (!acc[funcao]) acc[funcao] = [];
    acc[funcao].push(item);
    return acc;
  }, {});

  // Inicializa todos os grupos como colapsados quando os dados chegam
  const estadoColapsados = gruposColapsados ?? Object.fromEntries(Object.keys(gruposPorFuncao).map(f => [f, true]));

  const toggleGrupo = (funcao) => {
    setGruposColapsados(prev => ({ ...(prev ?? estadoColapsados), [funcao]: !(prev ?? estadoColapsados)[funcao] }));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Modelos de Atividade por Função</CardTitle>
        <Button onClick={handleAddNew}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Adicionar Modelo
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center items-center h-40">
            <Loader2 className="w-8 h-8 animate-spin text-gray-500" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : atividadesFuncao.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            <PackageOpen className="w-12 h-12 mx-auto mb-4 text-gray-300"/>
            <h3 className="text-lg font-medium">Nenhum modelo encontrado</h3>
            <p className="text-sm">Comece adicionando modelos de atividade para automatizar planejamentos.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Função (Cargo)</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Frequência</TableHead>
                <TableHead>Tempo Estimado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {Object.entries(gruposPorFuncao).map(([funcao, itens]) => {
                const colapsado = !!estadoColapsados[funcao];
                return (
                  <>
                    {/* Linha de cabeçalho do grupo */}
                    <TableRow
                      key={`group-${funcao}`}
                      className="bg-gray-50 cursor-pointer hover:bg-gray-100"
                      onClick={() => toggleGrupo(funcao)}
                    >
                      <TableCell colSpan={5}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex items-center gap-2 font-semibold text-gray-700">
                            {colapsado ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            {funcao}
                            <span className="text-xs font-normal text-gray-400 ml-1">({itens.length} {itens.length === 1 ? 'atividade' : 'atividades'})</span>
                          </div>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs h-7 gap-1"
                            onClick={(e) => handleAbrirPlanejamento(funcao, e)}
                          >
                            <PlayCircle className="w-3 h-3" />
                            Gerar Planejamento
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {/* Linhas de atividades do grupo */}
                    {!colapsado && itens.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="pl-8 text-gray-400 text-sm">{item.funcao}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.frequencia === 'ocasional' && (
                              <Bell className="w-4 h-4 text-amber-500" title="Atividade Ocasional" />
                            )}
                            {item.atividade}
                          </div>
                        </TableCell>
                        <TableCell>
                          {item.frequencia === 'ocasional' ? (
                            <Badge className="bg-amber-100 text-amber-800">
                              {formatFrequencia(item)}
                            </Badge>
                          ) : (
                            formatFrequencia(item)
                          )}
                        </TableCell>
                        <TableCell>{item.tempo_estimado}h</TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(item)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Modal de Gerar Planejamento */}
      <Dialog open={showPlanejamentoModal} onOpenChange={setShowPlanejamentoModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar Planejamento — {funcaoSelecionada}</DialogTitle>
          </DialogHeader>
          {resultadoPlanejamento ? (
            <div className="py-4 space-y-4">
              {resultadoPlanejamento.erro ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                  Erro: {resultadoPlanejamento.erro}
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-semibold text-green-800">{resultadoPlanejamento.criadas} de {resultadoPlanejamento.total} atividades planejadas com sucesso!</p>
                  <p className="text-xs text-green-600 mt-1">Atividades ocasionais são agendadas via notificação toda sexta-feira.</p>
                </div>
              )}
              <DialogFooter>
                <Button onClick={() => setShowPlanejamentoModal(false)}>Fechar</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Usuário</Label>
                <Select value={usuarioSelecionado} onValueChange={setUsuarioSelecionado}>
                  <SelectTrigger><SelectValue placeholder="Selecione o usuário..." /></SelectTrigger>
                  <SelectContent>
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={u.email}>{u.nome} ({u.email})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Data de Início</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-normal">
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {dataInicioPlanejamento ? format(dataInicioPlanejamento, 'dd/MM/yyyy') : 'Selecione a data...'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={dataInicioPlanejamento}
                      onSelect={setDataInicioPlanejamento}
                      locale={ptBR}
                      disabled={(d) => isWeekend(d)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                Serão criados planejamentos para todas as atividades de <strong>{funcaoSelecionada}</strong> exceto as ocasionais (agendadas via notificação).
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowPlanejamentoModal(false)}>Cancelar</Button>
                <Button
                  onClick={handleGerarPlanejamento}
                  disabled={!usuarioSelecionado || !dataInicioPlanejamento || isGerandoPlanejamento}
                >
                  {isGerandoPlanejamento ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</> : 'Gerar Planejamento'}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAtividade ? 'Editar' : 'Adicionar'} Modelo de Atividade</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSave}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="funcao">Função (Cargo)</Label>
                <Input id="funcao" value={formData.funcao} onChange={(e) => setFormData(prev => ({...prev, funcao: e.target.value}))} placeholder="Ex: Projetista" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="atividade">Atividade</Label>
                <Input id="atividade" value={formData.atividade} onChange={(e) => setFormData(prev => ({...prev, atividade: e.target.value}))} placeholder="Ex: Reunião de alinhamento semanal" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="frequencia">Frequência</Label>
                  <Select value={formData.frequencia} onValueChange={(value) => setFormData(prev => ({...prev, frequencia: value}))}>
                    <SelectTrigger id="frequencia"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="diaria">Diária</SelectItem>
                      <SelectItem value="semanal">Semanal</SelectItem>
                      <SelectItem value="quinzenal">Quinzenal</SelectItem>
                      <SelectItem value="mensal">Mensal</SelectItem>
                      <SelectItem value="ocasional">
                        <div className="flex items-center gap-2">
                          <Bell className="w-4 h-4 text-amber-500" />
                          Ocasional
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tempo_estimado">Tempo Estimado (horas)</Label>
                  <Input id="tempo_estimado" type="number" min="0.1" step="0.1" value={formData.tempo_estimado} onChange={(e) => setFormData(prev => ({...prev, tempo_estimado: e.target.value}))} />
                </div>
              </div>
              
              {formData.frequencia === 'ocasional' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <div className="flex items-start gap-2">
                    <Bell className="w-5 h-5 text-amber-600 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-amber-900">Atividade Ocasional</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Usuários com esta função receberão uma notificação toda sexta-feira 
                        perguntando em qual dia querem agendar esta atividade.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {['semanal', 'quinzenal', 'diaria'].includes(formData.frequencia) && (
                <div className="space-y-2">
                  <Label>Dias da Semana</Label>
                  <div className="flex gap-2">
                    {DIAS_DA_SEMANA.map(dia => (
                      <Button
                        key={dia.value}
                        type="button"
                        variant={formData.dias_semana.includes(dia.value) ? 'default' : 'outline'}
                        size="icon"
                        onClick={() => handleDiaSemanaToggle(dia.value)}
                        className={`h-8 w-8 rounded-full ${formData.frequencia === 'diaria' ? 'cursor-not-allowed opacity-50' : ''}`}
                        title={dia.label}
                      >
                        {dia.label}
                      </Button>
                    ))}
                  </div>
                   {formData.frequencia === 'diaria' && <p className="text-xs text-gray-500">A frequência diária sempre inclui de Segunda a Sexta.</p>}
                </div>
              )}

              {formData.frequencia === 'mensal' && (
                <div className="space-y-2">
                  <Label htmlFor="dia_mes">Dia do Mês</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-full justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        <span>Dia {formData.dia_mes} de cada mês</span>
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar
                        mode="single"
                        selected={new Date(new Date().getFullYear(), new Date().getMonth(), formData.dia_mes)}
                        onSelect={(date) => {
                          if (date) {
                            setFormData(prev => ({...prev, dia_mes: date.getDate()}));
                          }
                        }}
                        locale={ptBR}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>Cancelar</Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Salvar
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}