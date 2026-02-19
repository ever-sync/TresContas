import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed...');

  // Limpar dados existentes (ordem importa por causa das FK)
  await prisma.supportTicket.deleteMany();
  await prisma.user.deleteMany();
  await prisma.client.deleteMany();
  await prisma.accounting.deleteMany();

  console.log('Dados anteriores limpos.');

  // 1. Criar Contabilidade
  const accounting = await prisma.accounting.create({
    data: {
      name: 'Contabilidade Exemplo LTDA',
      cnpj: '12345678000100',
      email: 'contato@exemplo.com.br',
      phone: '11999990000',
      address: 'Rua das Flores, 123, Centro, Sao Paulo - SP',
      plan: 'premium',
    },
  });
  console.log(`Contabilidade criada: ${accounting.name} (${accounting.id})`);

  // 2. Criar Usuario Admin
  const adminHash = await bcrypt.hash('123456', 10);
  const admin = await prisma.user.create({
    data: {
      accounting_id: accounting.id,
      name: 'Administrador',
      email: 'admin@teste.com',
      password_hash: adminHash,
      role: 'admin',
      status: 'active',
      phone: '11999990001',
    },
  });
  console.log(`Admin criado: ${admin.email}`);

  // 3. Criar Usuario Colaborador
  const colabHash = await bcrypt.hash('123456', 10);
  const colab = await prisma.user.create({
    data: {
      accounting_id: accounting.id,
      name: 'Maria Colaboradora',
      email: 'colab@teste.com',
      password_hash: colabHash,
      role: 'collaborator',
      status: 'active',
      phone: '11999990002',
    },
  });
  console.log(`Colaborador criado: ${colab.email}`);

  // 4. Criar Clientes
  const clientHash = await bcrypt.hash('123456', 10);

  const client1 = await prisma.client.create({
    data: {
      accounting_id: accounting.id,
      name: 'Tech Solutions SA',
      cnpj: '98765432000188',
      email: 'contato@techsolutions.com.br',
      phone: '11888880001',
      industry: 'Tecnologia',
      address: 'Av. Paulista, 1000, Bela Vista, Sao Paulo - SP',
      status: 'active',
      tax_regime: 'presumido',
      representative_name: 'Carlos Silva',
      representative_email: 'carlos@techsolutions.com.br',
      password_hash: clientHash,
    },
  });
  console.log(`Cliente criado: ${client1.name}`);

  const client2 = await prisma.client.create({
    data: {
      accounting_id: accounting.id,
      name: 'Comercio Bom Preco LTDA',
      cnpj: '11222333000144',
      email: 'financeiro@bompreco.com.br',
      phone: '11888880002',
      industry: 'Comercio Varejista',
      address: 'Rua Augusta, 500, Consolacao, Sao Paulo - SP',
      status: 'active',
      tax_regime: 'simples',
      representative_name: 'Ana Oliveira',
      representative_email: 'ana@bompreco.com.br',
      password_hash: clientHash,
    },
  });
  console.log(`Cliente criado: ${client2.name}`);

  // 5. Criar Tickets de Suporte
  const ticket1 = await prisma.supportTicket.create({
    data: {
      accounting_id: accounting.id,
      client_id: client1.id,
      subject: 'Duvida sobre fechamento mensal',
      message: 'Gostaria de entender como funciona o fechamento do mes de janeiro. Preciso enviar algum documento adicional?',
      priority: 'medium',
      status: 'open',
    },
  });
  console.log(`Ticket criado: ${ticket1.subject} (aberto)`);

  const ticket2 = await prisma.supportTicket.create({
    data: {
      accounting_id: accounting.id,
      client_id: client1.id,
      subject: 'Erro no relatorio DRE',
      message: 'O relatorio DRE do mes de dezembro esta mostrando valores diferentes do que foi informado. Podem verificar?',
      priority: 'high',
      status: 'in_progress',
    },
  });
  console.log(`Ticket criado: ${ticket2.subject} (em andamento)`);

  const ticket3 = await prisma.supportTicket.create({
    data: {
      accounting_id: accounting.id,
      client_id: client2.id,
      subject: 'Solicitar balancete atualizado',
      message: 'Preciso do balancete atualizado para apresentar ao banco. Podem disponibilizar?',
      priority: 'low',
      status: 'closed',
      closed_at: new Date(),
    },
  });
  console.log(`Ticket criado: ${ticket3.subject} (resolvido)`);

  console.log('\n========================================');
  console.log('Seed concluido com sucesso!');
  console.log('========================================');
  console.log('\nCredenciais de teste:');
  console.log('--------------------------------------');
  console.log('STAFF (Admin):');
  console.log('  Email: admin@teste.com');
  console.log('  Senha: 123456');
  console.log('\nSTAFF (Colaborador):');
  console.log('  Email: colab@teste.com');
  console.log('  Senha: 123456');
  console.log('\nCLIENTE (Tech Solutions):');
  console.log('  CNPJ: 98765432000188');
  console.log('  Email: carlos@techsolutions.com.br');
  console.log('  Senha: 123456');
  console.log('\nCLIENTE (Bom Preco):');
  console.log('  CNPJ: 11222333000144');
  console.log('  Email: ana@bompreco.com.br');
  console.log('  Senha: 123456');
  console.log('--------------------------------------');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('Erro no seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
