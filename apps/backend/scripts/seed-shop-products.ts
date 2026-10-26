/**
 * Seed catalogue products for one cloud shop account.
 *
 * Usage (from apps/backend, with DATABASE_URL set):
 *   pnpm seed:products
 *   pnpm seed:products -- --email shop@example.com --password 'secret'
 *   pnpm seed:products -- --email shop@example.com --password 'secret' --force
 *
 * The script verifies email/password against the User table, then inserts
 * Product rows stamped with that shop's vendorId + fresh serverVersions so
 * signed-in phones receive them on the next sync pull. Other shops never see them.
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

type SeedProduct = {
  name: string;
  localName: string | null;
  aliases: string[];
  sku: string | null;
  hsnCode: string | null;
  unit: 'kg' | 'g' | 'l' | 'ml' | 'pcs' | 'packet' | 'other';
  /** Selling price in paise (₹1 = 100). */
  sellingPricePaise: number;
  /** GST rate in basis points (5% = 500). */
  gstRateBps: number;
  priceInclusive: boolean;
};

/** Default Kerala grocery-style catalogue for demos. */
const CATALOGUE: readonly SeedProduct[] = [
  {
    name: 'Rice',
    localName: 'Ari',
    aliases: ['rice', 'ari', 'matta'],
    sku: 'RICE-1KG',
    hsnCode: '1006',
    unit: 'kg',
    sellingPricePaise: 5000,
    gstRateBps: 500,
    priceInclusive: false,
  },
  {
    name: 'Milk',
    localName: 'Paal',
    aliases: ['milk', 'paal'],
    sku: 'MILK-1L',
    hsnCode: '0401',
    unit: 'l',
    sellingPricePaise: 6000,
    gstRateBps: 500,
    priceInclusive: false,
  },
  {
    name: 'Sugar',
    localName: 'Panjasara',
    aliases: ['sugar', 'panjasara'],
    sku: 'SUGAR-1KG',
    hsnCode: '1701',
    unit: 'kg',
    sellingPricePaise: 4500,
    gstRateBps: 500,
    priceInclusive: false,
  },
  {
    name: 'Tea powder',
    localName: 'Chaya podi',
    aliases: ['tea', 'chaya'],
    sku: 'TEA-500G',
    hsnCode: '0902',
    unit: 'packet',
    sellingPricePaise: 12000,
    gstRateBps: 500,
    priceInclusive: false,
  },
  {
    name: 'Coconut oil',
    localName: 'Velichenna',
    aliases: ['coconut oil', 'velichenna'],
    sku: 'OIL-1L',
    hsnCode: '1513',
    unit: 'l',
    sellingPricePaise: 28000,
    gstRateBps: 500,
    priceInclusive: false,
  },
  {
    name: 'Atta',
    localName: 'Gothambu podi',
    aliases: ['atta', 'wheat flour'],
    sku: 'ATTA-1KG',
    hsnCode: '1101',
    unit: 'kg',
    sellingPricePaise: 5500,
    gstRateBps: 500,
    priceInclusive: false,
  },
  {
    name: 'Eggs',
    localName: 'Mutta',
    aliases: ['egg', 'eggs', 'mutta'],
    sku: 'EGG-PCS',
    hsnCode: '0407',
    unit: 'pcs',
    sellingPricePaise: 700,
    gstRateBps: 0,
    priceInclusive: false,
  },
  {
    name: 'Onion',
    localName: 'Ulli',
    aliases: ['onion', 'ulli'],
    sku: 'ONION-1KG',
    hsnCode: '0703',
    unit: 'kg',
    sellingPricePaise: 4000,
    gstRateBps: 0,
    priceInclusive: false,
  },
  {
    name: 'Tomato',
    localName: 'Thakkali',
    aliases: ['tomato', 'thakkali'],
    sku: 'TOM-1KG',
    hsnCode: '0702',
    unit: 'kg',
    sellingPricePaise: 3500,
    gstRateBps: 0,
    priceInclusive: false,
  },
  {
    name: 'Soap',
    localName: null,
    aliases: ['soap', 'bath soap'],
    sku: 'SOAP-PCS',
    hsnCode: '3401',
    unit: 'pcs',
    sellingPricePaise: 3500,
    gstRateBps: 1800,
    priceInclusive: true,
  },
];

type CliArgs = {
  email: string | null;
  password: string | null;
  force: boolean;
};

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = { email: null, password: null, force: false };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === '--force') {
      args.force = true;
      continue;
    }
    if (token === '--email') {
      args.email = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token === '--password') {
      args.password = argv[index + 1] ?? null;
      index += 1;
      continue;
    }
    if (token?.startsWith('--email=')) {
      args.email = token.slice('--email='.length) || null;
      continue;
    }
    if (token?.startsWith('--password=')) {
      args.password = token.slice('--password='.length) || null;
    }
  }
  return args;
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input, output });
  try {
    const answer = await rl.question(question);
    return answer.trim();
  } finally {
    rl.close();
  }
}

async function nextServerVersion(prisma: PrismaClient): Promise<bigint> {
  const rows = await prisma.$queryRaw<Array<{ nextval: bigint | number | string }>>`
    SELECT nextval('sync_server_version_seq') AS nextval
  `;
  const value = rows[0]?.nextval;
  if (value == null) {
    throw new Error('Failed to allocate serverVersion (is sync_server_version_seq missing?)');
  }
  return BigInt(value);
}

async function main(): Promise<void> {
  const cli = parseArgs(process.argv.slice(2));
  const emailInput = cli.email ?? (await prompt('Shop account email: '));
  const password = cli.password ?? (await prompt('Password: '));
  const email = emailInput.trim().toLowerCase();

  if (!email || !password) {
    throw new Error('Email and password are required.');
  }

  const prisma = new PrismaClient();
  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: { vendor: true },
    });
    if (!user) {
      throw new Error(`No account found for ${email}. Register/sign in from the app first.`);
    }

    const passwordOk = await bcrypt.compare(password, user.passwordHash);
    if (!passwordOk) {
      throw new Error('Incorrect password.');
    }

    const vendorId = user.vendorId;
    const shopName = user.vendor.businessName;
    console.log(`Authenticated. Seeding products for shop "${shopName}" (${vendorId}).`);

    const existing = await prisma.product.findMany({
      where: { vendorId, deletedAt: null },
      select: { id: true, name: true },
    });
    const existingNames = new Set(existing.map((row) => row.name.trim().toLowerCase()));

    let created = 0;
    let skipped = 0;

    for (const item of CATALOGUE) {
      const key = item.name.trim().toLowerCase();
      if (!cli.force && existingNames.has(key)) {
        console.log(`  skip  ${item.name} (already in this shop)`);
        skipped += 1;
        continue;
      }

      const now = new Date();
      const serverVersion = await nextServerVersion(prisma);
      await prisma.product.create({
        data: {
          id: randomUUID(),
          vendorId,
          name: item.name,
          localName: item.localName,
          aliases: item.aliases,
          sku: item.sku,
          hsnCode: item.hsnCode,
          unit: item.unit,
          sellingPricePaise: BigInt(item.sellingPricePaise),
          gstRateBps: item.gstRateBps,
          priceInclusive: item.priceInclusive,
          isActive: true,
          createdAt: now,
          updatedAt: now,
          deletedAt: null,
          serverVersion,
        },
      });
      console.log(
        `  add   ${item.name} · ₹${(item.sellingPricePaise / 100).toFixed(2)} / ${item.unit}`,
      );
      created += 1;
      existingNames.add(key);
    }

    console.log('');
    console.log(`Done. Created ${created}, skipped ${skipped}.`);
    console.log(
      'On the phone: sign in as this account (or pull sync) to download the catalogue.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`\nSeed failed: ${message}`);
  process.exitCode = 1;
});
