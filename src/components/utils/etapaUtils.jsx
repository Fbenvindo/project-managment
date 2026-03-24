/**
 * Calcula a etapa correta de uma atividade considerando:
 * - Etapas cadastradas no empreendimento
 * - Etapa original da atividade
 * - Overrides aplicados
 * 
 * Regra: Se a etapa original da atividade for igual à primeira etapa cadastrada,
 * use a etapa padrão cadastrada. Caso contrário, deixe livre para escolha (use a original).
 */
export function calcularEtapaCorreta(baseAtividade, etapasCadastradas, override) {
  // Se há override, usar a etapa do override (já foi escolhida manualmente)
  if (override?.etapa) {
    return override.etapa;
  }

  // Se não há etapas cadastradas, usar a etapa original
  if (!etapasCadastradas || etapasCadastradas.length === 0) {
    return baseAtividade.etapa;
  }

  // Comparar etapa original com a primeira etapa cadastrada
  const etapaPrimeira = etapasCadastradas[0];
  const etapaOriginal = baseAtividade.etapa;

  // Se forem iguais, usa a primeira cadastrada (padrão)
  if (etapaOriginal === etapaPrimeira) {
    return etapaPrimeira;
  }

  // Se forem diferentes, deixa livre (usa a original)
  return etapaOriginal;
}