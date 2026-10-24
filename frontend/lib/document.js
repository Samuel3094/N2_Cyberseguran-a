// Monta o DOCUMENTO CANÔNICO que é assinado.
// ATENÇÃO: deve ser idêntico em lógica a backend/src/services/document.js.

export function canonicalize(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

export function buildSignedDocument(expense, signerId) {
  return canonicalize({
    tipo: 'RELATORIO_DE_DESPESA',
    versao: 1,
    finalidade: 'Aprovacao e assinatura de relatorio de despesa',
    despesaId: expense.id,
    funcionarioId: expense.employee.id,
    funcionarioNome: expense.employee.name,
    descricao: expense.description,
    categoria: expense.category,
    valor: Number(expense.amount).toFixed(2),
    moeda: 'BRL',
    dataDespesa: String(expense.expenseDate).slice(0, 10),
    reciboSha256: expense.receiptSha256,
    validadoPorId: expense.validation.by.id,
    validadoEm: new Date(expense.validation.at).toISOString(),
    signatarioId: signerId,
  });
}
