export function getEtapasPadrao(etapasCadastradas) {
  return (etapasCadastradas && etapasCadastradas.length > 0) ? etapasCadastradas : ['Estudo Preliminar'];
}