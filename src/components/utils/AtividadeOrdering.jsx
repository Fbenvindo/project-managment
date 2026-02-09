// **UTILITÁRIO**: Ordenação de Atividades - Centralizar lógica
export const ORDEM_ETAPAS = [
  'Planejamento',
  'Concepção',
  'Estudo Preliminar',
  'Ante-Projeto',
  'Projeto Básico',
  'Projeto Executivo',
  'Liberado para Obra'
];

export const ordenarAtividades = (atividades) => {
  return [...atividades].sort((a, b) => {
    const ordemA = ORDEM_ETAPAS.indexOf(a.etapa);
    const ordemB = ORDEM_ETAPAS.indexOf(b.etapa);
    
    // Se a etapa não estiver na lista, coloca no final
    const indexA = ordemA === -1 ? 999 : ordemA;
    const indexB = ordemB === -1 ? 999 : ordemB;
    
    // Primeiro ordena por etapa
    if (indexA !== indexB) {
      return indexA - indexB;
    }
    
    // Depois ordena por disciplina
    const discA = String(a.disciplina || '');
    const discB = String(b.disciplina || '');
    if (discA !== discB) {
      return discA.localeCompare(discB);
    }
    
    // Por último ordena por subdisciplina
    const subdA = String(a.subdisciplina || '');
    const subdB = String(b.subdisciplina || '');
    if (subdA !== subdB) {
      return subdA.localeCompare(subdB);
    }
    
    // Por último ordena por nome da atividade
    const atA = String(a.atividade || '');
    const atB = String(b.atividade || '');
    return atA.localeCompare(atB);
  });
};

export const agruparAtividadesPorEtapa = (atividades) => {
  const atividadesOrdenadas = ordenarAtividades(atividades);
  const grouped = atividadesOrdenadas.reduce((acc, atividade) => {
    const etapa = atividade.etapa || 'Sem Etapa';
    if (!acc[etapa]) acc[etapa] = [];
    acc[etapa].push(atividade);
    return acc;
  }, {});

  // Reordenar as chaves do objeto seguindo a ordem das etapas
  const orderedGrouped = {};
  ORDEM_ETAPAS.forEach(etapa => {
    if (grouped[etapa]) {
      orderedGrouped[etapa] = grouped[etapa];
    }
  });

  // Adicionar etapas não previstas no final
  Object.keys(grouped).forEach(etapa => {
    if (!ORDEM_ETAPAS.includes(etapa)) {
      orderedGrouped[etapa] = grouped[etapa];
    }
  });

  return orderedGrouped;
};