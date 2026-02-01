import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...\n');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@arcticcare.com' },
    update: {},
    create: {
      email: 'admin@arcticcare.com',
      password: adminPassword,
      name: 'Admin ArcticCare',
      role: 'admin',
      points: 1000
    }
  });
  console.log('✅ Admin user created:', admin.email);

  // Create demo users
  const demoPassword = await bcrypt.hash('demo123', 10);
  const users = await Promise.all([
    prisma.user.upsert({
      where: { email: 'maria@demo.com' },
      update: {},
      create: {
        email: 'maria@demo.com',
        password: demoPassword,
        name: 'Maria Silva',
        points: 450
      }
    }),
    prisma.user.upsert({
      where: { email: 'joao@demo.com' },
      update: {},
      create: {
        email: 'joao@demo.com',
        password: demoPassword,
        name: 'João Santos',
        points: 320
      }
    }),
    prisma.user.upsert({
      where: { email: 'ana@demo.com' },
      update: {},
      create: {
        email: 'ana@demo.com',
        password: demoPassword,
        name: 'Ana Costa',
        points: 280
      }
    })
  ]);
  console.log('✅ Demo users created:', users.length);

  // Create sample issues
  const issues = await Promise.all([
    // Critical - Fire
    prisma.issue.create({
      data: {
        title: 'Queimada detectada na região norte',
        description: 'Grande foco de incêndio detectado próximo à área de preservação. Fumaça visível a quilômetros de distância. Bombeiros já foram acionados.',
        category: 'fire',
        severity: 'critical',
        status: 'investigating',
        latitude: -3.1190,
        longitude: -60.0217,
        address: 'Rodovia AM-010, Km 45',
        region: 'Amazonas',
        userId: users[0].id
      }
    }),
    // High - Flood
    prisma.issue.create({
      data: {
        title: 'Nível do rio acima do normal',
        description: 'Rio Guaíba está 2 metros acima do nível normal. Comunidades ribeirinhas em alerta. Previsão de chuvas para os próximos dias.',
        category: 'flood',
        severity: 'high',
        status: 'open',
        latitude: -30.0346,
        longitude: -51.2177,
        address: 'Orla do Guaíba',
        region: 'Porto Alegre, RS',
        userId: users[1].id
      }
    }),
    // Medium - Air Pollution
    prisma.issue.create({
      data: {
        title: 'Qualidade do ar comprometida',
        description: 'Índice de qualidade do ar em nível amarelo. Recomenda-se evitar atividades físicas ao ar livre. Causa: inversão térmica.',
        category: 'pollution',
        severity: 'medium',
        status: 'open',
        latitude: -23.5505,
        longitude: -46.6333,
        address: 'Centro de São Paulo',
        region: 'São Paulo, SP',
        userId: users[2].id
      }
    }),
    // High - Deforestation
    prisma.issue.create({
      data: {
        title: 'Desmatamento irregular detectado',
        description: 'Área de aproximadamente 50 hectares sendo desmatada ilegalmente. Maquinário pesado identificado no local.',
        category: 'deforestation',
        severity: 'high',
        status: 'investigating',
        latitude: -3.4653,
        longitude: -62.2159,
        address: 'Reserva Florestal',
        region: 'Pará',
        userId: admin.id
      }
    }),
    // Low - Waste
    prisma.issue.create({
      data: {
        title: 'Descarte irregular de lixo',
        description: 'Entulho e lixo sendo descartado em área de proteção ambiental. Necessário fiscalização.',
        category: 'waste',
        severity: 'low',
        status: 'open',
        latitude: -22.9068,
        longitude: -43.1729,
        address: 'Zona Oeste',
        region: 'Rio de Janeiro, RJ',
        userId: users[0].id
      }
    }),
    // Critical - Fire
    prisma.issue.create({
      data: {
        title: 'Múltiplos focos de incêndio no Pantanal',
        description: 'Satélites detectaram 15 novos focos de incêndio na região. Condições climáticas desfavoráveis com baixa umidade.',
        category: 'fire',
        severity: 'critical',
        status: 'in_progress',
        latitude: -19.0000,
        longitude: -57.0000,
        address: 'Região do Pantanal',
        region: 'Mato Grosso do Sul',
        userId: users[1].id
      }
    }),
    // Medium - Flood
    prisma.issue.create({
      data: {
        title: 'Alagamento em bairro residencial',
        description: 'Chuvas intensas causaram alagamento em diversas ruas. Moradores relatam água invadindo residências.',
        category: 'flood',
        severity: 'medium',
        status: 'open',
        latitude: -8.0476,
        longitude: -34.8770,
        address: 'Bairro Boa Vista',
        region: 'Recife, PE',
        userId: users[2].id
      }
    })
  ]);
  console.log('✅ Issues created:', issues.length);

  // Create alerts
  const alerts = await Promise.all([
    prisma.alert.create({
      data: {
        type: 'critical',
        title: 'Alerta de Queimadas - Região Norte',
        message: '23 focos de queimada detectados nas últimas 24 horas na região amazônica. Autoridades em estado de alerta máximo.',
        region: 'Região Norte',
        isActive: true
      }
    }),
    prisma.alert.create({
      data: {
        type: 'warning',
        title: 'Risco de Alagamento - Sul',
        message: 'Previsão de chuvas intensas para os próximos 3 dias. Populações em áreas de risco devem ficar atentas.',
        region: 'Região Sul',
        isActive: true
      }
    }),
    prisma.alert.create({
      data: {
        type: 'info',
        title: 'Qualidade do Ar - Monitoramento',
        message: 'Índices de qualidade do ar estão sendo monitorados em tempo real nas principais capitais.',
        region: 'Nacional',
        isActive: true
      }
    })
  ]);
  console.log('✅ Alerts created:', alerts.length);

  // Create insights
  const insights = await Promise.all([
    prisma.insight.create({
      data: {
        title: 'Aumento de 35% em focos de queimada',
        description: 'Comparado ao mesmo período do ano anterior, houve aumento significativo nos focos de incêndio na região Norte. Principais causas: seca prolongada e atividades ilegais.',
        category: 'trend',
        severity: 'danger',
        confidence: 92,
        data: JSON.stringify({
          comparison: 'year_over_year',
          increase: 35,
          affectedArea: 'Região Norte'
        })
      }
    }),
    prisma.insight.create({
      data: {
        title: 'Padrão de enchentes identificado',
        description: 'Análise de dados históricos indica que a região Sul está 45% mais propensa a enchentes durante os meses de janeiro e fevereiro.',
        category: 'prediction',
        severity: 'warning',
        confidence: 78,
        data: JSON.stringify({
          months: ['Janeiro', 'Fevereiro'],
          probability: 45,
          basedOn: '10 anos de dados'
        })
      }
    }),
    prisma.insight.create({
      data: {
        title: 'Melhoria na qualidade do ar em SP',
        description: 'Após implementação de novas políticas de mobilidade, a qualidade do ar em São Paulo melhorou 12% nos últimos 6 meses.',
        category: 'trend',
        severity: 'info',
        confidence: 85,
        data: JSON.stringify({
          improvement: 12,
          period: '6 meses',
          cause: 'Políticas de mobilidade'
        })
      }
    })
  ]);
  console.log('✅ Insights created:', insights.length);

  // Create sample datasets
  const datasets = await Promise.all([
    prisma.dataset.create({
      data: {
        name: 'Temperatura Média - Brasil',
        description: 'Dados de temperatura média por região nos últimos 30 dias',
        category: 'temperature',
        source: 'INMET',
        region: 'Brasil',
        unit: '°C',
        data: JSON.stringify({
          labels: ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'],
          values: [28.5, 27.2, 26.8, 22.4, 18.9],
          trend: [0.5, 0.3, 0.2, -0.1, -0.3]
        })
      }
    }),
    prisma.dataset.create({
      data: {
        name: 'Índice de Qualidade do Ar',
        description: 'IQA das principais capitais brasileiras',
        category: 'air_quality',
        source: 'CETESB',
        region: 'Capitais',
        unit: 'IQA',
        data: JSON.stringify({
          labels: ['São Paulo', 'Rio de Janeiro', 'Belo Horizonte', 'Curitiba', 'Porto Alegre'],
          values: [75, 62, 48, 35, 42],
          status: ['Moderada', 'Boa', 'Boa', 'Boa', 'Boa']
        })
      }
    }),
    prisma.dataset.create({
      data: {
        name: 'Focos de Queimada - Mensal',
        description: 'Quantidade de focos de queimada detectados por mês',
        category: 'fire',
        source: 'INPE',
        region: 'Brasil',
        unit: 'focos',
        data: JSON.stringify({
          labels: ['Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez', 'Jan'],
          values: [2340, 4521, 6780, 5432, 3210, 1890, 2100],
          comparison: [2100, 4200, 6200, 5100, 3000, 1700, 1950]
        })
      }
    })
  ]);
  console.log('✅ Datasets created:', datasets.length);

  // Create climate readings
  const readings = [];
  for (let i = 0; i < 24; i++) {
    const time = new Date();
    time.setHours(time.getHours() - i);
    
    readings.push(
      prisma.climateReading.create({
        data: {
          type: 'temperature',
          value: 22 + Math.random() * 6,
          unit: '°C',
          latitude: -23.5505,
          longitude: -46.6333,
          region: 'São Paulo',
          source: 'sensor_sp_001',
          recordedAt: time
        }
      }),
      prisma.climateReading.create({
        data: {
          type: 'humidity',
          value: 60 + Math.random() * 20,
          unit: '%',
          latitude: -23.5505,
          longitude: -46.6333,
          region: 'São Paulo',
          source: 'sensor_sp_001',
          recordedAt: time
        }
      }),
      prisma.climateReading.create({
        data: {
          type: 'air_quality',
          value: 30 + Math.random() * 50,
          unit: 'AQI',
          latitude: -23.5505,
          longitude: -46.6333,
          region: 'São Paulo',
          source: 'sensor_sp_001',
          recordedAt: time
        }
      })
    );
  }
  await Promise.all(readings);
  console.log('✅ Climate readings created:', readings.length);

  // Create badges
  const badges = await Promise.all([
    prisma.badge.create({
      data: {
        name: 'Primeiro Reporte',
        description: 'Reportou sua primeira issue ambiental',
        icon: '🌱',
        requirement: JSON.stringify({ issues: 1 }),
        points: 10
      }
    }),
    prisma.badge.create({
      data: {
        name: 'Guardião Verde',
        description: 'Reportou 10 issues ambientais',
        icon: '🌲',
        requirement: JSON.stringify({ issues: 10 }),
        points: 50
      }
    }),
    prisma.badge.create({
      data: {
        name: 'Sentinela',
        description: 'Confirmou 20 issues de outros usuários',
        icon: '👁️',
        requirement: JSON.stringify({ confirms: 20 }),
        points: 30
      }
    }),
    prisma.badge.create({
      data: {
        name: 'Colaborador Ativo',
        description: 'Fez 50 comentários em issues',
        icon: '💬',
        requirement: JSON.stringify({ comments: 50 }),
        points: 40
      }
    }),
    prisma.badge.create({
      data: {
        name: 'Defensor do Planeta',
        description: 'Acumulou 500 pontos',
        icon: '🌍',
        requirement: JSON.stringify({ points: 500 }),
        points: 100
      }
    })
  ]);
  console.log('✅ Badges created:', badges.length);

  console.log('\n🎉 Database seeded successfully!');
  console.log('\n📧 Demo accounts:');
  console.log('   Admin: admin@arcticcare.com / admin123');
  console.log('   User:  maria@demo.com / demo123');
  console.log('   User:  joao@demo.com / demo123');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
