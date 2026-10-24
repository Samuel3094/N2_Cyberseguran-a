export const brl = (v) => Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export const dateBR = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '-');

export const dateTimeBR = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR') : '-');

export const CATEGORIES = {
  TRANSPORTE: 'Transporte',
  HOSPEDAGEM: 'Hospedagem',
  ALIMENTACAO: 'Alimentação',
  MATERIAL: 'Material',
  TREINAMENTO: 'Treinamento',
  OUTROS: 'Outros',
};

export const ROLES = {
  FUNCIONARIO: 'Funcionário',
  SUPERVISOR: 'Supervisor',
  GERENTE: 'Gerente',
};

export const MANAGER_ONLY_ABOVE = 5000;
