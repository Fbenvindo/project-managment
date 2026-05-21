import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { PlusCircle, MoreHorizontal, Edit, Trash2, Loader2, PackageOpen, XCircle, FileX, Edit2, ChevronRight, ChevronDown, Calendar, CheckCircle2, Users2, CheckCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import AnaliticoFolhaRow from './AnaliticoFolhaRow';

export default function AnaliticoRenderContent({
  isLoading, atividadesAgrupadas, atividadesPorDisciplina, handleOpenModal,
  selectedIds, editableActivities: editableActivitiesProp, isDeletingMultiple, handleSelectAll, handleDeleteSelected,
  atividadesSelecionadasParaPlanejar, setAtividadesSelecionadasParaPlanejar,
  atividadesSelecionadasParaExcluir, setAtividadesSelecionadasParaExcluir, handleExcluirMultiplas, isExcluindoMultiplasFolhas,
  expandedAtividades, toggleAtividadeExpansion, isDeletingActivity, isConcluindo, isSavingExecutor,
  datasInicio, setDatasInicio, planejamentos, empreendimentoId,
  handleSelectItem, handleOpenEtapaModal, handleOpenEditarEtapaEmFolhasModal, handleConcluirEmTodasFolhas,
  handleOpenExcluirDeFolhasModal, handleExcluirAtividade, handleOpenModal: handleOpenModalEdit,
  handleDelete, handleSaveExecutor, handlePlanejarMultiplas, usuarios,
  editandoTempo, novosTempoPadrao, setNovosTempoPadrao, setEditandoTempo, handleSalvarTempoPadrao,
  itensPRE,
}) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        <p className="ml-4 text-gray-600">Carregando catálogo de atividades...</p>
      </div>
    );
  }

  if (atividadesAgrupadas.length === 0 && itensPRE.length === 0 && !isLoading) {
    return (
      <div className="text-center py-16 px-6 bg-gray-50 rounded-lg">
        <PackageOpen className="w-16 h-16 mx-auto text-gray-300 mb-4" />
        <h3 className="text-xl font-semibold text-gray-800">Catálogo Vazio</h3>
        <p className="text-gray-500 mt-2 mb-6">Nenhuma atividade encontrada para este empreendimento.</p>
        <Button onClick={() => handleOpenModal()}>
          <PlusCircle className="w-4 h-4 mr-2" />
          Criar Atividade de Projeto
        </Button>
      </div>
    );
  }

  const editableActivities = atividadesAgrupadas.filter(grupo => grupo.baseAtividade.isEditable);
  const hasCheckboxColumn = editableActivities.length > 0;

  // Agrupar itens PRE com etapa por disciplina virtual "PRE"
  const itensPREComEtapa = (itensPRE || []).filter(item => item.etapa_adicional);

  const renderRow = (grupo, hasCheckboxColumn) => {
    const ativ = grupo.baseAtividade;
    const key = `${ativ.base_atividade_id}-${ativ.etapa}-${ativ.disciplina}-${ativ.subdisciplina}`;
    const isExpanded = expandedAtividades[key];
    const genericAtividadeIdToExclude = ativ.base_atividade_id || ativ.id;
    const uniqueKey = ativ.source_documento_id ? `${genericAtividadeIdToExclude}-${ativ.source_documento_id}` : genericAtividadeIdToExclude;
    const isDeleting = isDeletingActivity[uniqueKey] || isDeletingActivity[genericAtividadeIdToExclude];

    return (
      <React.Fragment key={key}>
        <TableRow className="hover:bg-gray-50">
          {hasCheckboxColumn && (<TableCell>{ativ.isEditable && (<Checkbox checked={selectedIds.has(ativ.uniqueId)} onCheckedChange={() => handleSelectItem(ativ.uniqueId)} disabled={isDeletingMultiple} />)}</TableCell>)}
          <TableCell>{!ativ.isEditable && <Checkbox checked={atividadesSelecionadasParaExcluir.has(ativ.base_atividade_id || ativ.id)} onCheckedChange={(checked) => { setAtividadesSelecionadasParaExcluir(prev => { const ns = new Set(prev); const id = ativ.base_atividade_id || ativ.id; if (checked) ns.add(id); else ns.delete(id); return ns; }); }} />}</TableCell>
          <TableCell>{grupo.folhas.length > 0 && (<Button variant="ghost" size="icon" onClick={() => toggleAtividadeExpansion(key)} className="h-8 w-8">{isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}</Button>)}</TableCell>
          <TableCell className="font-medium">
            <div>{String(ativ.atividade || '')}</div>
            {ativ.subdisciplina && <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-0.5 inline-block">{ativ.subdisciplina}</span>}
          </TableCell>
          <TableCell><Badge variant="outline">{grupo.folhas.length} {grupo.folhas.length === 1 ? 'folha' : 'folhas'}</Badge></TableCell>
          <TableCell>
            {grupo.folhas.length === 0 ? (
              ativ.source === 'Projeto' ? <Badge>Projeto</Badge> : ativ.status === 'Concluída' ? <Badge className="bg-blue-600 text-white flex items-center gap-1 w-fit"><CheckCircle2 className="w-4 h-4"/>Concluída</Badge> : ativ.status === 'Planejada' ? <Badge className="bg-green-600 text-white flex items-center gap-1 w-fit"><CheckCircle2 className="w-4 h-4"/>Planejada</Badge> : <Badge variant="secondary">Disponível</Badge>
            ) : (<div className="flex gap-1">{grupo.folhas.some(f=>f.status==='Concluída')&&<Badge className="bg-blue-600 text-white font-semibold shadow-md flex items-center gap-1 w-fit"><CheckCircle2 className="w-4 h-4"/>Concluída</Badge>}{grupo.folhas.some(f=>f.status==='Planejada')&&<Badge className="bg-green-600 text-white font-semibold shadow-md flex items-center gap-1 w-fit"><CheckCircle2 className="w-4 h-4"/>Planejada</Badge>}{grupo.folhas.some(f=>f.status==='Disponível')&&<Badge variant="outline" className="text-gray-600">Disponível</Badge>}</div>)}
          </TableCell>
          <TableCell>
            <button onClick={() => handleOpenEtapaModal(ativ)} className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer" title="Clique para editar a etapa">{ativ.etapa}</button>
          </TableCell>
          <TableCell>
            <div className="w-[210px]">
              {ativ.executor_principal ? (
                <div className="flex items-center justify-between p-1 bg-green-50 border border-green-200 rounded">
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-xs font-medium text-green-800">{usuarios.find(u => u.email === ativ.executor_principal)?.nome || ativ.executor_principal}</span>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => handleSaveExecutor(ativ, "")} className="text-xs text-red-600 hover:text-red-700 h-6" disabled={isSavingExecutor[genericAtividadeIdToExclude]}>Remover</Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Checkbox checked={atividadesSelecionadasParaPlanejar.has(genericAtividadeIdToExclude)} onCheckedChange={(checked) => { setAtividadesSelecionadasParaPlanejar(prev => { const ns = new Set(prev); if (checked) ns.add(genericAtividadeIdToExclude); else ns.delete(genericAtividadeIdToExclude); return ns; }); }} disabled={isSavingExecutor[genericAtividadeIdToExclude]} />
                  <Select onValueChange={(value) => { if (atividadesSelecionadasParaPlanejar.size > 0 && atividadesSelecionadasParaPlanejar.has(genericAtividadeIdToExclude)) { handlePlanejarMultiplas(value, datasInicio[genericAtividadeIdToExclude]); } else { handleSaveExecutor(ativ, value, datasInicio[genericAtividadeIdToExclude]); } }} disabled={isSavingExecutor[genericAtividadeIdToExclude]}>
                    <SelectTrigger className="w-full text-xs h-7 border-blue-500 text-blue-600 hover:bg-blue-50"><Users2 className="w-3 h-3 mr-1" /><SelectValue placeholder="Selecionar Executor" /></SelectTrigger>
                    <SelectContent>{usuarios.filter(u => u.status === 'ativo').sort((a,b)=>(a.nome||'').localeCompare(b.nome||'')).map(u => (<SelectItem key={u.email} value={u.email} className="text-xs">{u.nome || u.email}</SelectItem>))}</SelectContent>
                  </Select>
                  <Popover>
                    <PopoverTrigger asChild><Button variant="outline" size="icon" className={`h-7 w-7 ${datasInicio[genericAtividadeIdToExclude] ? 'border-green-500 text-green-600' : ''}`} disabled={isSavingExecutor[genericAtividadeIdToExclude]}><Calendar className="w-3 h-3" /></Button></PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent mode="single" selected={datasInicio[genericAtividadeIdToExclude]} onSelect={(date) => setDatasInicio(prev => ({ ...prev, [genericAtividadeIdToExclude]: date }))} disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))} locale={ptBR} />
                      {datasInicio[genericAtividadeIdToExclude] && (<div className="p-2 border-t"><Button variant="ghost" size="sm" onClick={() => setDatasInicio(prev => ({ ...prev, [genericAtividadeIdToExclude]: null }))} className="w-full text-xs">Limpar Data</Button></div>)}
                    </PopoverContent>
                  </Popover>
                </div>
              )}
              {isSavingExecutor[genericAtividadeIdToExclude] && (<div className="flex items-center gap-1 text-xs text-blue-600 mt-1"><Loader2 className="w-3 h-3 animate-spin" />Planejando...</div>)}
            </div>
          </TableCell>
          <TableCell>
            {datasInicio[genericAtividadeIdToExclude] ? (
              <div className="flex items-center gap-1 text-blue-600 text-xs"><Calendar className="w-3 h-3" /><span>Início: {format(datasInicio[genericAtividadeIdToExclude], 'dd/MM/yyyy')}</span></div>
            ) : grupo.folhas.some(f => f.status === 'Planejada') ? (() => {
              const folhasPlanejadas = grupo.folhas.filter(f => f.status === 'Planejada');
              const planejamentosComDatas = folhasPlanejadas.map(f => planejamentos?.find(p => p.documento_id === f.source_documento_id && p.atividade_id === f.base_atividade_id)).filter(p => p?.inicio_planejado && p?.termino_planejado);
              if (planejamentosComDatas.length > 0) {
                const datas = planejamentosComDatas.map(p => ({ inicio: parseISO(p.inicio_planejado), termino: parseISO(p.termino_planejado) }));
                const dataInicio = datas.reduce((min, d) => d.inicio < min ? d.inicio : min, datas[0].inicio);
                const dataTermino = datas.reduce((max, d) => d.termino > max ? d.termino : max, datas[0].termino);
                return (<div className="flex items-center gap-1 text-gray-600 text-xs"><Calendar className="w-3 h-3" /><span>{format(dataInicio, 'dd/MM')} - {format(dataTermino, 'dd/MM')}</span></div>);
              }
              return <span className="text-xs text-gray-400">-</span>;
            })() : <span className="text-xs text-gray-400">-</span>}
          </TableCell>
          <TableCell>
            {editandoTempo[genericAtividadeIdToExclude] ? (
              <div className="flex items-center gap-1">
                <Input type="number" step="0.1" min="0" value={novosTempoPadrao[genericAtividadeIdToExclude] ?? ativ.tempo ?? 0} onChange={(e) => setNovosTempoPadrao(prev => ({ ...prev, [genericAtividadeIdToExclude]: e.target.value }))} className="w-20 h-7 text-xs" onKeyDown={(e) => { if (e.key === 'Enter') handleSalvarTempoPadrao(ativ, genericAtividadeIdToExclude); else if (e.key === 'Escape') setEditandoTempo(prev => ({ ...prev, [genericAtividadeIdToExclude]: false })); }} autoFocus />
                <Button size="icon" variant="ghost" onClick={() => handleSalvarTempoPadrao(ativ, genericAtividadeIdToExclude)} className="h-7 w-7"><CheckCircle className="w-4 h-4 text-green-600" /></Button>
                <Button size="icon" variant="ghost" onClick={() => setEditandoTempo(prev => ({ ...prev, [genericAtividadeIdToExclude]: false }))} className="h-7 w-7"><XCircle className="w-4 h-4 text-gray-400" /></Button>
              </div>
            ) : (
              <button onClick={() => { setEditandoTempo(prev => ({ ...prev, [genericAtividadeIdToExclude]: true })); setNovosTempoPadrao(prev => ({ ...prev, [genericAtividadeIdToExclude]: ativ.tempo ?? 0 })); }} className="text-blue-600 hover:text-blue-800 hover:underline font-medium cursor-pointer" title="Clique para editar o tempo padrão">{ativ.tempo ? `${Number(ativ.tempo).toFixed(1)}h` : '-'}</button>
            )}
          </TableCell>
          <TableCell className="font-semibold text-blue-600">{grupo.folhas.length > 0 ? `${grupo.folhas.reduce((sum, f) => sum + (Number(f.tempo) || 0), 0).toFixed(1)}h` : '-'}</TableCell>
          <TableCell className="text-center">
            {!ativ.isEditable && (
              <div className="flex items-center gap-2 justify-center">
                <Button size="icon" onClick={() => handleOpenEditarEtapaEmFolhasModal(ativ)} variant="outline" className="border-blue-500 text-blue-600 hover:bg-blue-50" title="Editar Etapa"><Edit2 className="w-4 h-4" /></Button>
                <Button size="icon" onClick={() => handleConcluirEmTodasFolhas(ativ)} variant="outline" className="border-green-500 text-green-600 hover:bg-green-50" disabled={isConcluindo[genericAtividadeIdToExclude]} title="Concluir em Todas as Folhas">{isConcluindo[genericAtividadeIdToExclude] ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}</Button>
                <Button size="icon" onClick={() => handleOpenExcluirDeFolhasModal(ativ)} variant="outline" className="border-orange-500 text-orange-600 hover:bg-orange-50" disabled={isDeleting} title="Excluir de Folhas Específicas">{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileX className="w-4 h-4" />}</Button>
                <Button size="icon" onClick={() => handleExcluirAtividade(ativ)} variant="outline" className="border-red-500 text-red-600 hover:bg-red-50 shadow-sm" disabled={isDeleting} title="Excluir de Todas as Folhas">{isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}</Button>
              </div>
            )}
          </TableCell>
          <TableCell>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" disabled={isDeleting || isDeletingMultiple}>{isDeleting || isDeletingMultiple ? <Loader2 className="w-4 h-4 animate-spin" /> : <MoreHorizontal className="w-4 h-4" />}</Button></DropdownMenuTrigger>
              <DropdownMenuContent>
                {ativ.isEditable ? (<><DropdownMenuItem onClick={() => handleOpenModal(ativ)}><Edit className="w-4 h-4 mr-2" /> Editar Atividade</DropdownMenuItem><DropdownMenuItem onClick={() => handleDelete(ativ.id)} className="text-red-600"><Trash2 className="w-4 h-4 mr-2" /> Excluir Atividade de Projeto</DropdownMenuItem></>) : (<><DropdownMenuItem onClick={() => handleOpenEtapaModal(ativ)}><Edit2 className="w-4 h-4 mr-2 text-blue-600" /> Editar Etapa (Empreendimento)</DropdownMenuItem><DropdownMenuItem onClick={() => handleOpenEditarEtapaEmFolhasModal(ativ)} className="text-blue-600"><Edit2 className="w-4 h-4 mr-2" /> Editar Etapa em Folhas Específicas</DropdownMenuItem></>)}
              </DropdownMenuContent>
            </DropdownMenu>
          </TableCell>
        </TableRow>
        {isExpanded && grupo.folhas.map(folha => (<AnaliticoFolhaRow key={folha.uniqueId} folha={folha} hasCheckboxColumn={hasCheckboxColumn} planejamentos={planejamentos} atividadesSelecionadasParaExcluir={atividadesSelecionadasParaExcluir} setAtividadesSelecionadasParaExcluir={setAtividadesSelecionadasParaExcluir} empreendimentoId={empreendimentoId} onConcluirFolha={() => {}} />))}
      </React.Fragment>
    );
  };

  const tableHeaders = (hasCheckboxColumn) => (
    <TableRow>
      {hasCheckboxColumn && <TableHead className="w-[50px]"></TableHead>}
      <TableHead className="w-[50px]"></TableHead>
      <TableHead className="w-[50px]"></TableHead>
      <TableHead>Atividade</TableHead>
      <TableHead>Folhas</TableHead>
      <TableHead>Status</TableHead>
      <TableHead>Etapa</TableHead>
      <TableHead>Executor</TableHead>
      <TableHead>Datas Planejadas</TableHead>
      <TableHead>Tempo Padrão</TableHead>
      <TableHead>Tempo Total</TableHead>
      <TableHead className="text-center w-[120px]">Ações</TableHead>
      <TableHead className="w-[50px]"></TableHead>
    </TableRow>
  );

  return (
    <div className="space-y-6">
      {editableActivities.length > 0 && (
        <div className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm">
          <div className="flex items-center gap-3">
            <Checkbox id="selectAll" checked={selectedIds.size === editableActivities.length && editableActivities.length > 0} onCheckedChange={handleSelectAll} disabled={editableActivities.length === 0 || isDeletingMultiple} />
            <label htmlFor="selectAll" className="text-sm font-medium text-gray-700 cursor-pointer">Selecionar todas as {editableActivities.length} atividades de projeto</label>
          </div>
          {selectedIds.size > 0 && (<Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={isDeletingMultiple}>{isDeletingMultiple ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Excluindo...</> : <><Trash2 className="w-4 h-4 mr-2" />Excluir Selecionadas ({selectedIds.size})</>}</Button>)}
        </div>
      )}

      {atividadesSelecionadasParaPlanejar.size > 0 && (
        <div className="flex items-center justify-between p-4 border-2 border-blue-500 rounded-lg bg-blue-50 shadow-sm">
          <div className="flex items-center gap-3"><Badge className="bg-blue-600 text-white">{atividadesSelecionadasParaPlanejar.size} atividade{atividadesSelecionadasParaPlanejar.size > 1 ? 's' : ''} selecionada{atividadesSelecionadasParaPlanejar.size > 1 ? 's' : ''}</Badge><span className="text-sm text-gray-700">Selecione executor e data para planejar em lote</span></div>
          <Button variant="outline" size="sm" onClick={() => setAtividadesSelecionadasParaPlanejar(new Set())}>Cancelar</Button>
        </div>
      )}

      {atividadesSelecionadasParaExcluir.size > 0 && (
        <div className="flex items-center justify-between p-4 border-2 border-red-500 rounded-lg bg-red-50 shadow-sm">
          <div className="flex items-center gap-3"><Badge className="bg-red-600 text-white">{atividadesSelecionadasParaExcluir.size} atividade{atividadesSelecionadasParaExcluir.size > 1 ? 's' : ''} selecionada{atividadesSelecionadasParaExcluir.size > 1 ? 's' : ''}</Badge><span className="text-sm text-gray-700">Excluir selecionadas</span></div>
          <div className="flex gap-2"><Button onClick={() => handleExcluirMultiplas()} className="bg-red-600 hover:bg-red-700" disabled={isExcluindoMultiplasFolhas} size="sm"><Trash2 className="w-4 h-4 mr-2" />Excluir do Empreendimento</Button><Button variant="outline" size="sm" onClick={() => setAtividadesSelecionadasParaExcluir(new Set())}>Cancelar</Button></div>
        </div>
      )}

      {atividadesPorDisciplina.map(([disciplina, grupos]) => {
        const isDocumentacao = ['Planejamento', 'Gestão', 'BIM', 'Apoio', 'Coordenação'].includes(disciplina);
        const subdisciplinasMap = isDocumentacao ? grupos : null;
        const atividadesList = isDocumentacao ? null : grupos;
        return (
          <div key={disciplina} className="border rounded-lg overflow-hidden">
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 border-b">
              <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
                <div className="w-1 h-6 bg-blue-600 rounded-full"></div>
                {disciplina}
                <Badge variant="secondary" className="ml-2">{isDocumentacao ? Object.values(subdisciplinasMap).flat().length : atividadesList.length} {isDocumentacao ? (Object.values(subdisciplinasMap).flat().length === 1 ? 'atividade' : 'atividades') : (atividadesList.length === 1 ? 'atividade' : 'atividades')}</Badge>
              </h3>
            </div>
            <div className="overflow-x-auto">
              {isDocumentacao ? (
                <div className="space-y-4 p-4">
                  {Object.entries(subdisciplinasMap).sort((a,b)=>a[0].localeCompare(b[0])).map(([subdisciplina, atividadesSubgrupo]) => (
                    <div key={subdisciplina} className="border rounded-lg overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b"><h4 className="font-medium text-sm text-gray-700">{subdisciplina} ({atividadesSubgrupo.length})</h4></div>
                      <Table className="text-sm">
                        <TableHeader className="bg-white">
                          <TableRow>
                            {hasCheckboxColumn && <TableHead className="w-[50px]"></TableHead>}
                            <TableHead className="w-[50px]"><Checkbox checked={atividadesSelecionadasParaExcluir.size > 0 && atividadesSubgrupo.every(g => atividadesSelecionadasParaExcluir.has(g.baseAtividade.base_atividade_id || g.baseAtividade.id))} onCheckedChange={(checked) => { const ids = atividadesSubgrupo.map(g => g.baseAtividade.base_atividade_id || g.baseAtividade.id); setAtividadesSelecionadasParaExcluir(prev => { const ns = new Set(prev); ids.forEach(id => { if (checked) ns.add(id); else ns.delete(id); }); return ns; }); }} /></TableHead>
                            {tableHeaders(false).props.children.slice(2)}
                          </TableRow>
                        </TableHeader>
                        <TableBody>{atividadesSubgrupo.map(grupo => renderRow(grupo, hasCheckboxColumn))}</TableBody>
                      </Table>
                    </div>
                  ))}
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-gray-50">
                    <TableRow>
                      {hasCheckboxColumn && <TableHead className="w-[50px]"></TableHead>}
                      <TableHead className="w-[50px]"><Checkbox checked={atividadesSelecionadasParaExcluir.size > 0 && grupos.every(g => atividadesSelecionadasParaExcluir.has(g.baseAtividade.base_atividade_id || g.baseAtividade.id))} onCheckedChange={(checked) => { const ids = grupos.map(g => g.baseAtividade.base_atividade_id || g.baseAtividade.id); setAtividadesSelecionadasParaExcluir(prev => { const ns = new Set(prev); ids.forEach(id => { if (checked) ns.add(id); else ns.delete(id); }); return ns; }); }} /></TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                      <TableHead>Atividade</TableHead><TableHead>Folhas</TableHead><TableHead>Status</TableHead><TableHead>Etapa</TableHead><TableHead>Executor</TableHead><TableHead>Datas Planejadas</TableHead><TableHead>Tempo Padrão</TableHead><TableHead>Tempo Total</TableHead><TableHead className="text-center w-[120px]">Ações</TableHead><TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>{grupos.map(grupo => renderRow(grupo, hasCheckboxColumn))}</TableBody>
                </Table>
              )}
            </div>
          </div>
        );
      })}

      {/* Seção de Itens PRE com Etapa */}
      {itensPREComEtapa.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gradient-to-r from-orange-50 to-amber-50 px-4 py-3 border-b">
            <h3 className="font-semibold text-lg text-gray-800 flex items-center gap-2">
              <div className="w-1 h-6 bg-orange-500 rounded-full"></div>
              Comentários PRE
              <Badge variant="secondary" className="ml-2 bg-orange-100 text-orange-800">{itensPREComEtapa.length} {itensPREComEtapa.length === 1 ? 'item' : 'itens'}</Badge>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-gray-50">
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Assunto / Descritiva</TableHead>
                  <TableHead>Etapa</TableHead>
                  <TableHead>Disciplina</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tempo (h)</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {itensPREComEtapa.map(item => (
                  <TableRow key={item.id} className="hover:bg-orange-50">
                    <TableCell className="font-medium text-sm">{item.item}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{item.assunto || item.descritiva || '-'}</TableCell>
                    <TableCell><Badge className="bg-orange-100 text-orange-800 border border-orange-300">{item.etapa_adicional}</Badge></TableCell>
                    <TableCell className="text-sm text-gray-600">{item.descritiva || '-'}</TableCell>
                    <TableCell>
                      {item.status === 'Concluído' ? <Badge className="bg-green-100 text-green-800">Concluído</Badge>
                      : item.status === 'Em andamento' ? <Badge className="bg-yellow-100 text-yellow-800">Em andamento</Badge>
                      : item.status === 'Pendente' ? <Badge className="bg-red-100 text-red-800">Pendente</Badge>
                      : <Badge variant="secondary">{item.status || '-'}</Badge>}
                    </TableCell>
                    <TableCell className="text-sm">{item.tempo_atendimento ? `${item.tempo_atendimento}h` : '-'}</TableCell>
                    <TableCell className="text-sm text-gray-500">{item.data ? item.data.substring(0,10).split('-').reverse().join('/') : '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  );
}