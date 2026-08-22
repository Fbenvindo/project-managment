import { useState, useEffect } from "react";
import { Feriado } from "@/entities/all";

const HORAS_POR_DIA = 8;

export function formatarDataISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function parseDataISO(isoStr) {
  if (!isoStr) return null;
  const parts = String(isoStr).split("-").map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

export function formatarDataBR(isoStr) {
  if (!isoStr) return "-";
  const parts = String(isoStr).split("-");
  if (parts.length !== 3) return isoStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Hook que carrega os feriados cadastrados e os organiza em conjuntos
 * para consulta rápida: recorrentes (MM-DD) e específicos (YYYY-MM-DD).
 */
export function useFeriados() {
  const [feriados, setFeriados] = useState({ recorrentes: new Set(), especificos: new Set() });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    Feriado.list()
      .then((lista) => {
        if (!mounted) return;
        const recorrentes = new Set();
        const especificos = new Set();
        (lista || []).forEach((f) => {
          if (!f.data) return;
          const parts = String(f.data).split("-");
          if (parts.length !== 3) return;
          const [, mes, dia] = parts;
          if (f.recorrente) {
            recorrentes.add(`${mes}-${dia}`);
          } else {
            especificos.add(f.data);
          }
        });
        setFeriados({ recorrentes, especificos });
      })
      .catch(() => {})
      .finally(() => mounted && setIsLoading(false));
    return () => {
      mounted = false;
    };
  }, []);

  return { feriados, isLoading };
}

export function ehFeriado(date, feriados) {
  if (!feriados) return false;
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  if (feriados.especificos && feriados.especificos.has(`${y}-${m}-${d}`)) return true;
  if (feriados.recorrentes && feriados.recorrentes.has(`${m}-${d}`)) return true;
  return false;
}

export function ehDiaUtil(date, feriados) {
  const dia = date.getDay(); // 0 = Domingo, 6 = Sábado
  if (dia === 0 || dia === 6) return false;
  if (ehFeriado(date, feriados)) return false;
  return true;
}

export function proximoDiaUtil(date, feriados) {
  const d = new Date(date);
  while (!ehDiaUtil(d, feriados)) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Calcula a data de término somando horasTotais a partir de dataInicio,
 * considerando 8h/dia em dias úteis (segunda a sexta), excluindo feriados.
 * Retorna { dataTermino (ISO), diasUteis }.
 */
export function calcularDataTermino(dataInicioISO, horasTotais, feriados) {
  if (!dataInicioISO || !horasTotais || horasTotais <= 0) return null;

  let horasRestantes = Number(horasTotais);
  let current = parseDataISO(dataInicioISO);
  if (!current) return null;

  // Se a data inicial não for útil, avança para o próximo dia útil
  if (!ehDiaUtil(current, feriados)) {
    current = proximoDiaUtil(current, feriados);
  }

  let diasUteis = 0;

  // Consome o primeiro dia útil
  diasUteis += 1;
  horasRestantes -= HORAS_POR_DIA;

  // Continua consumindo dias úteis enquanto houver horas
  while (horasRestantes > 0) {
    current.setDate(current.getDate() + 1);
    if (ehDiaUtil(current, feriados)) {
      diasUteis += 1;
      horasRestantes -= HORAS_POR_DIA;
    }
  }

  return { dataTermino: formatarDataISO(current), diasUteis };
}