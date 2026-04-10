/**
 * Helper para processar documentos vinculados a uma atividade durante planejamento
 */
export const getDocumentosParaPlanejar = (atividadeOriginal, documentos) => {
  // Se a atividade tem documento_ids específicos, usar esses
  if (atividadeOriginal.documento_ids && 
      Array.isArray(atividadeOriginal.documento_ids) && 
      atividadeOriginal.documento_ids.length > 0) {
    console.log(`   📋 Atividade tem documento_ids específicos: ${atividadeOriginal.documento_ids.join(', ')}`);
    const docs = documentos.filter(doc => atividadeOriginal.documento_ids.includes(doc.id));
    docs.forEach(doc => {
      console.log(`   ✅ Documento vinculado: ${doc.numero} - ${doc.arquivo}`);
    });
    return docs;
  }
  
  // Senão, buscar documentos compatíveis por disciplina/subdisciplina
  console.log(`   🔍 Buscando documentos compatíveis por disciplina/subdisciplina...`);
  return documentos.filter(doc => {
    const disciplinaMatch = doc.disciplina === atividadeOriginal.disciplina;
    const subdisciplinasDoc = doc.subdisciplinas || [];
    const subdisciplinaMatch = subdisciplinasDoc.includes(atividadeOriginal.subdisciplina);
    const matches = disciplinaMatch && subdisciplinaMatch;
    
    if (matches) {
      console.log(`   ✅ Documento compatível: ${doc.numero} - ${doc.arquivo}`);
    }
    
    return matches;
  });
};