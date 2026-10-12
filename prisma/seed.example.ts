// ============================================================================
//  SEED DATA — exemples d'astuces pré-chargées (pour le dev / la démo)
//  Lancer avec: npx prisma db seed
// ============================================================================
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // 1) Utilisateur admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {},
    create: { email: 'admin@example.com', name: 'Admin', role: 'ADMIN' },
  })

  // 2) Quelques astuces validées pour la démo
  const tips = [
    {
      slug: 'roule-ton-tabac',
      title: 'Roule ton tabac toi-même',
      category: 'TOBACCO',
      difficulty: 'EASY',
      estimatedMonthlySaving: 120,
      learningTimeHours: 1,
      equipmentCost: 12,
      sourceCredit: 'Le Tabac du Rouleur',
      sourceUrl: 'https://exemples.com/tabac-roulage',
      sourceLicense: 'CC BY 4.0',
      tags: ['tabac', 'économie', 'désabonnement'],
      description: `Comment acheter des feuilles brutes (légal, pas de vente) et les rouler soi-même.
**Matériel nécessaire** : papier à rouler, filtre, broyeuse ou ciseaux.
**Étapes** : acheter le tabac en vrac → broyer → remplir le papier → rouler.
**Astuces** : garde le papier bien sec, humidifie légèrement le bord pour coller.`,
      safetyWarnings: [
        { category: 'LEGAL', text: 'La revente de tabac est illégale. Tu peux seulement consommer ce que tu produis pour toi.', severity: 'HIGH' },
        { category: 'HEALTH', text: 'Le tabac reste dangereux pour la santé. Ce contenu n\'est pas un conseil médical.', severity: 'CRITICAL' },
      ],
    },
    {
      slug: 'pain-maison-4-ingredients',
      title: 'Pain maison en 4 ingrédients (sans machine)',
      category: 'FOOD',
      difficulty: 'EASY',
      estimatedMonthlySaving: 35,
      learningTimeHours: 2,
      equipmentCost: 0,
      sourceCredit: 'La Cuisine du Frugal',
      sourceUrl: 'https://exemples.com/pain-4-ingredients',
      sourceLicense: null,
      tags: ['pain', 'boulangerie', 'zéro-gaspillage'],
      description: `Farine, eau, sel, levain (ou levure). Un pain à 1,50 € au lieu de 3,50 € le pain de tradition.
**Ingrédients** : 500 g de farine T65, 350 ml d'eau, 10 g de sel, 20 g de levure.`,
      safetyWarnings: [],
    },
    {
      slug: 'dentifrice-bicarbonate',
      title: 'Dentifrice maison : bicarbonate + huile de coco',
      category: 'HYGIENE',
      difficulty: 'EASY',
      estimatedMonthlySaving: 8,
      learningTimeHours: 0.5,
      equipmentCost: 5,
      sourceCredit: 'Zéro Déchet FR',
      sourceUrl: 'https://exemples.com/dentifrice-maison',
      sourceLicense: null,
      tags: ['hygiène', 'zéro déchet', 'dentifrice'],
      description: `2 c.à.s de bicarbonate, 2 c.à.s d'huile de coco, 10 gouttes d'huile essentielle de menthe.
Durée de vie : 1 mois au frais.`,
      safetyWarnings: [{ category: 'CHEMICAL', text: 'Ne pas avaler. Tenir hors de portée des enfants.', severity: 'LOW' }],
    },
    {
      slug: 'lessive-paillettes-de-savon',
      title: 'Lessive solide aux paillettes de savon de Marseille',
      category: 'HOUSEHOLD',
      difficulty: 'EASY',
      estimatedMonthlySaving: 15,
      learningTimeHours: 1.5,
      equipmentCost: 4,
      sourceCredit: 'Les Fées au Ménage',
      sourceUrl: 'https://exemples.com/lessive-paillettes',
      sourceLicense: null,
      tags: ['ménage', 'lessive', 'zéro déchet'],
      description: `100 g de paillettes de savon de Marseille + 50 g de carbonate de soude + 500 ml d'eau. Fondre au bain-marie, verser en pots.
Une cuillère par machine, eau tiède > 40 °C.`,
      safetyWarnings: [{ category: 'CHEMICAL', text: 'Le carbonate de soude irrite les yeux et la peau → porte des gants.', severity: 'MEDIUM' }],
    },
    {
      slug: 'produits-menagers-vinaigre-bicarbonate',
      title: '3 produits ménagers universels : vinaigre, bicarbonate, huiles essentielles',
      category: 'HOUSEHOLD',
      difficulty: 'EASY',
      estimatedMonthlySaving: 25,
      learningTimeHours: 1,
      equipmentCost: 10,
      sourceCredit: 'Le Ménage Naturel',
      sourceUrl: 'https://exemples.com/3-produits-menagers',
      sourceLicense: null,
      tags: ['ménage', 'vinaigre blanc', 'économe'],
      description: `Détaillant vitres : vinaigre blanc + eau. Détartrant : vinaigre blanc chaud. Absorbeur d'odeurs : bicarbonate. Nettoyant multi-surfaces : vinaigre + huiles essentielles.`,
      safetyWarnings: [{ category: 'CHEMICAL', text: 'Ne jamais mélanger vinaigre et javel (gaz toxique).', severity: 'CRITICAL' }],
    },
    {
      slug: 'kombucha-maison',
      title: 'Kombucha maison : ferments et sucre',
      category: 'ALCOHOL',
      difficulty: 'MEDIUM',
      estimatedMonthlySaving: 20,
      learningTimeHours: 4,
      equipmentCost: 30,
      sourceCredit: 'Fermes & Co',
      sourceUrl: 'https://exemples.com/kombucha-maison',
      sourceLicense: null,
      tags: ['ferment', 'kombucha', 'probiotique'],
      description: `Thé noir + sucre + SCOBY (champignon) + temps. 2 ferments de 1 L par semaine suffisent pour une famille.
Cycles : 1re fermentation 7-10 j, 2e fermentation 2-4 j pour le goût.`,
      safetyWarnings: [{ category: 'FOOD', text: 'Hygiène irréprochable : les moisissures rouges/noires = à jeter. Laissez aérer (pas de bocal hermétique).', severity: 'MEDIUM' }],
    },
    {
      slug: 'deodorant-solide-2-ingredients',
      title: 'Déodorant solide : bicarbonate + huile de coco',
      category: 'HYGIENE',
      difficulty: 'EASY',
      estimatedMonthlySaving: 10,
      learningTimeHours: 0.5,
      equipmentCost: 3,
      sourceCredit: 'Cosmétiques du Dimanche',
      sourceUrl: 'https://exemples.com/deodorant-solide',
      sourceLicense: null,
      tags: ['déodorant', 'zéro déchet', 'peau sensible'],
      description: `3 c.à.s de noix de coco rapée + 2 c.à.s de bicarbonate + 5 gouttes d'HE lavande. Fondre au bain-marie, verser dans un pot vide.`,
      safetyWarnings: [{ category: 'CHEMICAL', text: 'Le bicarbonate peut irriter les peaux très sensibles → teste une petite zone d\'abord.', severity: 'LOW' }],
    },
    {
      slug: 'shampoing-solide-recomposition',
      title: 'Shampoing solide : faire fondre et recouler un vrai pain',
      category: 'HYGIENE',
      difficulty: 'MEDIUM',
      estimatedMonthlySaving: 12,
      learningTimeHours: 2,
      equipmentCost: 6,
      sourceCredit: 'Têtes Séchées',
      sourceUrl: 'https://exemples.com/shampoing-solide-recouler',
      sourceLicense: null,
      tags: ['shampoing', 'cheveux', 'zéro déchet'],
      description: `Acheter des pains de shampoing bon marché (ou dépareillés) → râper → fondre au bain-marie → couler dans un moule → sécher 48 h.`,
      safetyWarnings: [],
    },
    {
      slug: 'creme-visage-huile-coco-aloe',
      title: 'Crème visage hydratante : aloe vera + huile de coco',
      category: 'COSMETICS',
      difficulty: 'EASY',
      estimatedMonthlySaving: 9,
      learningTimeHours: 1,
      equipmentCost: 8,
      sourceCredit: 'Beauté Verte',
      sourceUrl: 'https://exemples.com/creme-visage-aloe',
      sourceLicense: null,
      tags: ['cosmétique', 'visage', 'naturel'],
      description: `Gel d'aloe vera (80%) + huile de coco (20%) + 2 gouttes HE tea tree. Montrer, malaxer jusqu'à émulsion blanche. Tenir au frais, se conserve 3 semaines.`,
      safetyWarnings: [{ category: 'HEALTH', text: 'Test allergique obligatoire au pli du coude 24 h avant application.', severity: 'MEDIUM' }],
    },
    {
      slug: 'biere-maison-kit-debutant',
      title: 'Bière maison : kit extract pour débutant',
      category: 'ALCOHOL',
      difficulty: 'MEDIUM',
      estimatedMonthlySaving: 25,
      learningTimeHours: 5,
      equipmentCost: 45,
      sourceCredit: 'Brasseurs Amateurs',
      sourceUrl: 'https://exemples.com/biere-kit-extract',
      sourceLicense: null,
      tags: ['bière', 'fermentation', 'apéritif'],
      description: `Kit extract 20 L ≈ 12 €/L au lieu de 30-40 €/L en magasin. Cueillette → brassage → fermentation 2-3 semaines → mise en bouteille avec sucre.`,
      safetyWarnings: [{ category: 'LEGAL', text: 'Consommation personnelle uniquement. La vente d\'alcool maison est illégale.', severity: 'HIGH' }],
    },
  ]

  for (const t of tips) {
    const externalRef = `seed:${t.slug}`
    await prisma.diyTip.upsert({
      where: { externalRef },
      create: {
        externalRef,
        sourceUrl: t.sourceUrl,
        sourceCredit: t.sourceCredit,
        sourceLicense: t.sourceLicense,
        slug: t.slug,
        title: t.title,
        description: t.description,
        category: t.category,
        difficulty: t.difficulty,
        estimatedMonthlySaving: t.estimatedMonthlySaving,
        learningTimeHours: t.learningTimeHours,
        equipmentCost: t.equipmentCost,
        roiMonths: t.estimatedMonthlySaving > 0
          ? Math.ceil(t.equipmentCost / t.estimatedMonthlySaving)
          : 0,
        tags: JSON.stringify(t.tags),
        safetyWarnings: { create: t.safetyWarnings ?? [] },
        isVerified: true,
        moderationStatus: 'APPROVED',
        reviewedBy: admin.id,
        reviewedAt: new Date(),
        views: 0,
      },
      update: {
        title: t.title,
        description: t.description,
        updatedAt: new Date(),
      },
    })
  }

  // 3) Défi "Casse-toi pauv'" #1 — Ménage & Hygiène
  const now = new Date()
  const weekLater = new Date(now.getTime() + 7 * 24 * 3600 * 1000)
  await prisma.weeklyChallenge.create({
    data: {
      title: 'Casse-toi pauv\' #1 — Ménage & Hygiène',
      description: `Réduis tes dépenses de produits ménagers et d'hygiène de 50% ce mois-ci en testant au moins 3 astuces DIY.`,
      category: 'HOUSEHOLD',
      targetPercent: 50,
      activeStartDate: now,
      activeEndDate: weekLater,
      isPublished: true,
    },
  })

  // 4) Une trouvaille communautaire exemple
  await prisma.communityFinding.create({
    data: {
      title: 'Vide-grenier de la rue du Moulin → savons faits maison à 1 €',
      content: `Petite brocante dimanche matin dans le 15e. J'ai trouvé des pains de savon faits maison à 1 € piéc(e). Idéal pour lessive et vaisselle !`,
      category: 'LOCAL',
      location: 'Paris 15e',
      authorName: 'Sophie D.',
      status: 'PENDING',
    },
  })

  console.log('✅ Seed terminé')
}

main().catch((e) => {
  console.error('❌ Erreur seed:', e)
  process.exit(1)
}).finally(() => prisma.$disconnect())
