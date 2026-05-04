import { Badge } from "@/components/ui/badge";

export const statusColors = {
  solicitado: "bg-gray-100 text-gray-800",
  em_analise: "bg-yellow-100 text-yellow-800",
  aprovado: "bg-green-100 text-green-800",
  reprovado: "bg-red-100 text-red-800"
};

export const statusLabels = {
  solicitado: "Solicitado",
  em_analise: "Aguardando Aprovação",
  aprovado: "Aprovado",
  reprovado: "Não Aprovado"
};

export const statusCardStyles = {
  solicitado: 'bg-gray-50 border-gray-200 text-gray-800',
  em_analise: 'bg-yellow-50 border-yellow-200 text-yellow-800',
  aprovado: 'bg-green-50 border-green-200 text-green-800',
  reprovado: 'bg-red-50 border-red-200 text-red-800'
};

export const statusDotStyles = {
  solicitado: 'bg-gray-400',
  em_analise: 'bg-yellow-400',
  aprovado: 'bg-green-500',
  reprovado: 'bg-red-500'
};

export const normalizeStatus = (raw) => {
  if (raw === undefined || raw === null) return 'solicitado';
  let s = String(raw).toLowerCase().trim();
  s = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const key = s.replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (['aprovado', 'aprovada'].includes(key)) return 'aprovado';
  if (['reprovado', 'nao_aprovado', 'naoaprovado', 'nao_aprovada'].includes(key)) return 'reprovado';
  if (key.includes('nao') && (key.includes('aprov') || key.includes('reprov'))) return 'reprovado';
  if (key.includes('analise') || key.includes('aguard')) return 'em_analise';
  if (key.includes('solicit')) return 'solicitado';
  if (['aprovado', 'reprovado', 'em_analise', 'solicitado'].includes(key)) return key;
  return 'solicitado';
};

export default function PropostaStatusBadge({ status, className = '' }) {
  const normalized = normalizeStatus(status);
  const label = normalized === 'em_analise' ? 'Ag. Aprovação' : (statusLabels[normalized] || normalized);
  return (
    <Badge className={`${statusColors[normalized]} ${className}`}>
      {label}
    </Badge>
  );
}