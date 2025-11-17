import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, parseISO, isValid, differenceInCalendarDays } from 'date-fns';
import { isActivityOverdue as isOverdue } from '../utils/DateCalculator';

export default function RelatorioAtividades({ planejamentos }) {

    const getStatusInfo = (plano) => {
        const isAtrasado = !plano.isQuickActivity && isOverdue(plano);
        if (isAtrasado) {
            return { text: "Atrasado", color: "bg-red-100 text-red-800" };
        }
        
        const status = plano.isQuickActivity ? (plano.status === 'concluido' ? 'concluido' : 'em_andamento') : plano.status;

        switch (status) {
            case 'concluido':
                return { text: "Concluído", color: "bg-green-100 text-green-800" };
            case 'em_andamento':
                return { text: "Em Andamento", color: "bg-blue-100 text-blue-800" };
            case 'pausado':
                return { text: "Pausado", color: "bg-yellow-100 text-yellow-800" };
            case 'nao_iniciado':
            default:
                return { text: "Não Iniciado", color: "bg-gray-100 text-gray-800" };
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return "N/A";
        try {
            // Adicionar T00:00:00 para tratar como data local e evitar problemas de fuso
            return format(parseISO(`${dateString.split('T')[0]}T00:00:00`), 'dd/MM/yyyy');
        } catch {
            return "Data inválida";
        }
    };

    if (!planejamentos || planejamentos.length === 0) {
        return (
            <div className="text-center py-10 text-gray-500">
                <p>Nenhuma atividade encontrada com os filtros selecionados.</p>
            </div>
        );
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader className="bg-gray-50">
                    <TableRow>
                        <TableHead>Atividade</TableHead>
                        <TableHead>Usuário</TableHead>
                        <TableHead>Empreendimento</TableHead>
                        <TableHead>Folha</TableHead>
                        <TableHead>Início Real</TableHead>
                        <TableHead>Término Real</TableHead>
                        <TableHead className="text-center">Duração (dias)</TableHead>
                        <TableHead className="text-center">Tempo Gasto</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {planejamentos.map((plano) => {
                        const statusInfo = getStatusInfo(plano);
                        
                        let duracaoDias = '-';
                        if (plano.inicio_real && plano.termino_real) {
                            const inicio = parseISO(plano.inicio_real);
                            const termino = parseISO(plano.termino_real);
                            if (isValid(inicio) && isValid(termino)) {
                                duracaoDias = differenceInCalendarDays(termino, inicio) + 1;
                            }
                        }

                        return (
                            <TableRow key={plano.id}>
                                <TableCell className="font-medium">{plano.descritivo || plano.atividade?.atividade || 'N/A'}</TableCell>
                                <TableCell>{plano.executor?.full_name || plano.executor?.nome || plano.executor_principal || 'N/A'}</TableCell>
                                <TableCell>{plano.empreendimento?.nome || 'N/A'}</TableCell>
                                <TableCell>{plano.documento?.numero || (plano.isQuickActivity ? 'Atividade Rápida' : 'N/A')}</TableCell>
                                <TableCell>{formatDate(plano.inicio_real)}</TableCell>
                                <TableCell>{plano.termino_real ? formatDate(plano.termino_real) : (plano.status === 'concluido' ? 'Concluído' : 'Em andamento')}</TableCell>
                                <TableCell className="text-center font-medium">
                                    {duracaoDias}
                                </TableCell>
                                <TableCell className="text-center">
                                    {(plano.tempo_executado || 0).toFixed(1)}h
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge className={statusInfo.color}>{statusInfo.text}</Badge>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                </TableBody>
            </Table>
        </div>
    );
}