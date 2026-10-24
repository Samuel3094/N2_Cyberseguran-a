# Manual do Usuário — Assinatura Digital de Despesas

Este manual ensina a usar o sistema de reembolso de despesas com assinatura digital.

**Endereço:** https://samuel3094.github.io/N2_Cyberseguran-a/

## Sumário
1. [Conceitos rápidos](#1-conceitos-rápidos)
2. [Primeiro acesso](#2-primeiro-acesso)
3. [Funcionário](#3-funcionário)
4. [Supervisor](#4-supervisor)
5. [Gerente](#5-gerente)
6. [Dúvidas comuns](#6-dúvidas-comuns)
7. [Roteiro de demonstração (5 minutos)](#7-roteiro-de-demonstração-5-minutos)

---

## 1. Conceitos rápidos

### Perfis
| Perfil | O que pode fazer |
|---|---|
| **Funcionário** | Enviar despesas e acompanhar as suas |
| **Supervisor** | Tudo do funcionário + validar e assinar despesas de outras pessoas (até R$ 5.000,00) |
| **Gerente** | Tudo do supervisor + assinar qualquer valor, cadastrar funcionários e verificar assinaturas |

### Situação (status) de uma despesa
| Status | Significado |
|---|---|
| **Pendente** | Enviada; aguardando conferência de um supervisor ou gerente |
| **Validado** | Conferida e aprovada; aguardando assinatura digital |
| **Rejeitado** | Recusada; o motivo aparece nos detalhes |
| **Assinado** | Assinada digitalmente. A partir daqui o documento **não pode mais ser alterado** |

### Chave e frase secreta
Para assinar, supervisores e gerentes precisam de uma **chave de assinatura**, gerada uma única vez no próprio navegador. Ela é protegida por uma **frase secreta** que só você conhece. Nem o sistema nem o administrador têm acesso a ela, por isso **ninguém consegue recuperá-la**. Ela garante que só você pode assinar em seu nome.

---

## 2. Primeiro acesso

1. Abra o endereço do sistema.
2. Digite o **e-mail** e a **senha** que o gerente cadastrou para você e clique em **Entrar**.
3. Se aparecer *"Iniciando o servidor... pode levar até 1 minuto"*, aguarde. A hospedagem gratuita desliga o servidor quando ninguém usa por 15 minutos.
4. Você verá o **Painel**, com atalhos para as funções do seu perfil. O menu lateral (ou o botão ☰ no celular) leva às demais telas.

**Regras de acesso**
- Depois de **5 senhas erradas**, a conta fica bloqueada por **15 minutos**.
- A sessão expira em **1 hora** e também termina quando você fecha a aba. Basta entrar de novo.
- Para sair, clique em **Sair** no canto superior direito.

---

## 3. Funcionário

### 3.1 Enviar uma despesa
1. Clique em **Nova despesa**.
2. Preencha:
   - **Descrição** (5 a 500 caracteres). Ex.: *Táxi aeroporto → cliente ACME (visita técnica)*.
   - **Categoria**: Transporte, Hospedagem, Alimentação, Material, Treinamento ou Outros.
   - **Valor**: de R$ 0,01 a R$ 50.000,00.
   - **Data da despesa**: não pode ser futura nem ter mais de **90 dias**.
3. Clique em **Anexar recibo** e escolha o arquivo: **PDF, PNG ou JPG, até 5 MB**. Logo abaixo aparece o código **SHA-256** do arquivo, a "impressão digital" que prova que o recibo não foi trocado depois.
4. Clique em **Enviar relatório**. Os supervisores e gerentes recebem uma notificação.

> O mesmo recibo não pode ser enviado duas vezes, mesmo em outro relatório.

### 3.2 Acompanhar suas despesas
1. Clique em **Minhas despesas**.
2. Veja o status de cada uma. Clique em **Detalhes** para ver o recibo, quem validou ou assinou e, se for o caso, o **motivo da rejeição**.
3. Despesa rejeitada não pode ser editada. Corrija o problema e envie um **novo relatório**.

---

## 4. Supervisor

### 4.1 Gerar sua chave de assinatura (uma vez)
1. Clique em **Minha chave**.
2. Crie uma **frase secreta** com **10 ou mais caracteres**, incluindo maiúscula, minúscula e número, e repita no campo de confirmação.
3. Clique em **Gerar chaves**. Aparecem a **impressão digital** e a chave pública.

> **Anote a frase secreta em local seguro.** Ela não pode ser recuperada. Se esquecê-la, gere uma nova chave nesta mesma tela: a anterior é revogada, e as assinaturas já feitas continuam válidas.

### 4.2 Validar uma despesa
1. Clique em **Pendentes** → aba **A validar** → botão **Validar**.
2. Confira a mensagem de integridade no topo:
   - **Verde:** o recibo é exatamente o arquivo enviado.
   - **Vermelha:** o recibo foi alterado depois do envio. **Rejeite.**
3. Confira valor, data, categoria e se o recibo corresponde à descrição.
4. Escolha uma opção:
   - **Aprovar e seguir para assinatura:** a despesa vai para *Validado* e abre a tela de assinatura.
   - **Rejeitar:** escreva o **motivo** (mínimo de 10 caracteres) no campo de observações. O funcionário é avisado.

### 4.3 Assinar uma despesa
1. Clique em **Pendentes** → aba **A assinar** → botão **Assinar**, ou siga direto da validação.
2. Leia o quadro **Documento que será assinado**. Ele mostra exatamente os dados que a sua assinatura vai garantir: valor, data, código do recibo, quem validou etc.
3. Marque a declaração de concordância (MP 2.200-2/2001 e Lei 14.063/2020).
4. Digite sua **frase secreta** e clique em **Assinar digitalmente**.
5. Aparece a confirmação com o código (hash) do documento assinado.

**Quando o sistema não deixa assinar**
| Mensagem | Motivo |
|---|---|
| *Você não pode assinar sua própria despesa* | Segregação de funções: outra pessoa precisa assinar |
| *Despesas acima de R$ 5.000,00 exigem assinatura do Gerente* | Alçada: só o gerente assina valores altos |
| *Você precisa gerar seu par de chaves* | Faça o passo 4.1 |
| *Frase secreta incorreta* | Digite novamente; se esqueceu, gere uma nova chave |

> Na lista de pendentes, despesas suas aparecem como **"Própria despesa"**, sem botões.

---

## 5. Gerente

O gerente faz tudo o que o supervisor faz (validar, gerar chave e assinar), **sem limite de valor**, e mais:

### 5.1 Cadastrar e gerenciar funcionários
1. Clique em **Funcionários** → **Novo funcionário**.
2. Preencha nome, e-mail, **CPF** (somente números, validado automaticamente), departamento, cargo e **perfil**.
3. Defina uma **senha inicial** com 8 ou mais caracteres, incluindo maiúscula, minúscula, número e símbolo. Ex.: `Inicio@2026`. Passe a senha ao funcionário por um canal seguro.
4. Clique em **Salvar**. O funcionário recebe um e-mail de boas-vindas.

- **Editar:** altera nome, e-mail, departamento, cargo, perfil ou situação. O **CPF não pode ser alterado**.
- **Desativar:** bloqueia o acesso e revoga a chave de assinatura. O cadastro não é apagado, para que as assinaturas antigas continuem verificáveis.
- Por segurança, você não pode desativar nem rebaixar a sua própria conta.
- Na lista, o CPF aparece mascarado (`***.456.789-**`), em cumprimento à LGPD.

### 5.2 Verificar assinaturas
1. Clique em **Assinados** → **Verificar assinatura** na despesa desejada.
2. A tela faz duas verificações independentes: uma **no seu navegador** e outra **no servidor**. Cada uma mostra uma lista de checagens:
   - recibo íntegro;
   - dados íntegros (nada foi alterado depois da assinatura);
   - assinatura digital válida;
   - chave pertence ao signatário e não estava revogada;
   - carimbo de tempo do servidor válido.
3. Se todas estiverem verdes, aparece **ASSINATURA VÁLIDA**. Qualquer item vermelho indica adulteração.
4. **Baixar comprovante (.json):** salva o documento assinado e os dados da assinatura, para arquivo ou auditoria.

**Demonstração de adulteração:** marque *"simular adulteração do valor em R$ 0,01"*. A verificação do navegador refaz o cálculo com o valor alterado e passa a mostrar **ASSINATURA INVÁLIDA**, provando que qualquer mudança é detectada. Os dados reais não são alterados; desmarque para voltar.

---

## 6. Dúvidas comuns

**O login demora ou diz que não foi possível conectar.**
O servidor gratuito estava desligado. Espere até 1 minuto e tente de novo.

**Esqueci minha senha.**
O sistema ainda não tem redefinição de senha pela tela. Fale com o administrador.

**Esqueci a frase secreta da chave.**
Ela não pode ser recuperada. Vá em **Minha chave** e gere uma nova. As assinaturas antigas continuam válidas.

**Meu recibo foi recusado.**
Verifique o formato (PDF, PNG ou JPG), o tamanho (até 5 MB) e se esse recibo já não foi enviado antes. O sistema confere o conteúdo real do arquivo, não apenas a extensão.

**Por que não consigo editar uma despesa assinada?**
Um documento assinado é imutável: alterar qualquer dado invalidaria a assinatura. Se houver erro, envie um novo relatório.

**Não recebi o e-mail de notificação.**
No ambiente de demonstração os e-mails podem estar só registrados no servidor, sem envio real. O status sempre aparece no sistema.

---

## 7. Roteiro de demonstração (5 minutos)

Prepare antes: abra `https://assinatura-digital-api.onrender.com/api/health` uns minutos antes, para ligar o servidor. Use duas janelas anônimas, ou dois navegadores, para trocar de usuário rapidamente.

| # | Quem | Ação | O que mostrar |
|---|---|---|---|
| 1 | Gerente | **Funcionários** → criar um Supervisor e um Funcionário | Validação de CPF, senha forte, CPF mascarado |
| 2 | Funcionário | **Nova despesa** → enviar com recibo | Código SHA-256 do recibo |
| 3 | Supervisor | **Minha chave** → gerar chave | Chave criada no navegador; frase secreta nunca enviada |
| 4 | Supervisor | **Pendentes → Validar → Aprovar** | Checagem de integridade do recibo |
| 5 | Supervisor | **Assinar** → frase secreta | Documento exibido antes de assinar |
| 6 | Gerente | **Assinados → Verificar assinatura** | Duas verificações verdes |
| 7 | Gerente | Marcar *simular adulteração* | Assinatura fica inválida com R$ 0,01 de diferença |
| 8 | Extra | Funcionário envia R$ 6.000; Supervisor tenta assinar | Bloqueio por alçada |
