import React, { useContext } from 'react';
import { ActivityTimerContext } from '../contexts/ActivityTimerContext';
import NovoPlanejamentoModal from '../planejamento/NovoPlanejamentoModal';

export default function EditActivityModal({ plano, isOpen, onClose, onSave }) {
  const { allEmpreendimentos, allUsers } = useContext(ActivityTimerContext);

  if (!plano) return null;

  return (
    <NovoPlanejamentoModal
      isOpen={isOpen}
      onClose={onClose}
      empreendimentos={allEmpreendimentos || []}
      usuarios={allUsers || []}
      atividades={[]}
      planoParaEditar={plano}
      onSuccess={() => { onSave?.(); }}
    />
  );
}