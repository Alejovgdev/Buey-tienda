// Standalone integration test. Always creates its own disposable localhost
// cluster; never reads .env or accepts a connection URL. Requires PostgreSQL 15+.
// Windows: $env:PG_BIN='C:\Program Files\PostgreSQL\18\bin'
// Run: node scripts/check-redsys-postgres.mjs
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scratch = await mkdtemp(path.join(tmpdir(), 'redsys-t1-'));
const dataDir = path.join(scratch, 'data');
const bin = (name) => process.env.PG_BIN ? path.join(process.env.PG_BIN, name) : name;
const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.toUpperCase().startsWith('PG')));
const listener = net.createServer();
await new Promise((resolve) => listener.listen(0, '127.0.0.1', resolve));
const port = listener.address().port;
await new Promise((resolve) => listener.close(resolve));

function command(name, args, input = '') {
  return new Promise((resolve, reject) => {
    const child = spawn(bin(name), args, { env, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk; });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', reject);
    // On Windows the detached server can inherit pg_ctl's pipe handles. Wait
    // for pg_ctl itself to exit; other commands close their streams normally.
    child.on(name === 'pg_ctl' ? 'exit' : 'close', (code) => {
      if (name === 'pg_ctl') { child.stdout.destroy(); child.stderr.destroy(); }
      code === 0 ? resolve(stdout.trim()) : reject(new Error(`${name} (${code}): ${stderr}\n${stdout}`));
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input);
  });
}
const sql = (text, app = 'redsys-test') => command('psql', [
  '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1',
  '-d', `host=127.0.0.1 port=${port} user=postgres dbname=postgres application_name=${app}`,
], text);
const json = async (query) => JSON.parse(await sql(query));
const migration = async (name) => sql(await readFile(path.join(root, 'supabase/migrations', name), 'utf8'));
const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;
let sequence = 0, checks = 0, started = false;
const test = async (name, fn) => { await fn(); checks++; console.log(`OK ${name}`); };

async function fixture({ giftStock = 10, sameVariant = false, productStock = 10 } = {}) {
  const f = { order: randomUUID(), variant: randomUUID(), gift: randomUUID(), promo: randomUUID(), ds: String(260000000000 + ++sequence) };
  const category = randomUUID(), product = randomUUID();
  if (sameVariant) f.gift = f.variant;
  await sql(`INSERT INTO categories(id,slug,name) VALUES ('${category}','${category}','Test');
    INSERT INTO products(id,slug,name,category_id) VALUES ('${product}','${product}','Test','${category}');
    INSERT INTO product_variants(id,product_id,name,price,stock) VALUES ('${f.variant}','${product}','Test',500,${productStock});
    ${sameVariant ? '' : `INSERT INTO product_variants(id,product_id,name,price,stock) VALUES ('${f.gift}','${product}','Gift',500,${giftStock});`}
    INSERT INTO promotions(id,name,gift_variant_id,max_redemptions) VALUES ('${f.promo}','Test','${f.gift}',10);
    INSERT INTO orders(id,order_number,status,customer_name,customer_last_name,customer_email,customer_phone,
      shipping_street,shipping_city,shipping_province,shipping_postal_code,subtotal,total,redsys_ds_order)
    VALUES ('${f.order}','${f.order}','PENDING_PAYMENT','Test','Test','test@example.invalid','0','Test','Test','Test','28001',1000,1000,'${f.ds}');`);
  f.lines = [{ variant_id: f.variant, quantity: 2, item_type: 'PRODUCT' }, { variant_id: f.gift, quantity: 1, item_type: 'GIFT' }];
  return f;
}
const rpc = (f, { amount = 1000, response = '0000', ds = f.ds } = {}) =>
  `SELECT public.decrement_stock_and_confirm_order('${f.order}', ${quote(JSON.stringify(f.lines))}::jsonb,
    ${quote(ds)}, ${quote(response)}, NULL, ${amount}, '${f.promo}');`;
const call = (f, options) => json(rpc(f, options));
const state = (f) => json(`SELECT jsonb_build_object('order', to_jsonb(o),
  'payments', (SELECT coalesce(jsonb_agg(p), '[]') FROM payments p WHERE order_id=o.id),
  'stock', (SELECT stock FROM product_variants WHERE id='${f.variant}'),
  'gift', (SELECT stock FROM product_variants WHERE id='${f.gift}'),
  'redemptions', (SELECT current_redemptions FROM promotions WHERE id='${f.promo}'),
  'history', (SELECT coalesce(jsonb_agg(h), '[]') FROM order_status_history h WHERE order_id=o.id))
  FROM orders o WHERE id='${f.order}';`);

try {
  await command('initdb', ['-D', dataDir, '-A', 'trust', '--no-locale', '-E', 'UTF8', '-U', 'postgres']);
  await command('pg_ctl', ['-D', dataDir, '-l', path.join(scratch, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port} -F`, '-w', 'start']);
  started = true;
  console.log(`PostgreSQL local: ${await sql('SHOW server_version;')} (cluster desechable)`);
  await sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;');
  // Core versioned schema and every historical definition of this RPC.
  // No Supabase storage/cron/seed, network providers or production data.
  for (const name of [
    '20260629111737_0001_initial_schema.sql', '20260629113026_0002_rpc_decrement_stock.sql',
    '20260701110034_0009_fix_atomic_stock_rpc.sql', '20260706090000_0010_idempotent_stock_rpc.sql',
    '20260706120000_0011_gift_stock_optional.sql',
  ]) await migration(name);

  await test('el SQL anterior reproduce T1 tras PREPARING', async () => {
    const f = await fixture();
    const oldCall = `SELECT decrement_stock_and_confirm_order('${f.order}', ${quote(JSON.stringify(f.lines))}::jsonb, '${f.promo}');`;
    await sql(oldCall);
    await sql(`INSERT INTO payments(order_id,redsys_ds_order,amount,status,paid_at)
      VALUES ('${f.order}','${f.ds}',1000,'succeeded',now());`);
    await sql(`UPDATE orders SET status='PREPARING' WHERE id='${f.order}';`);
    await sql(oldCall);
    const s = await state(f);
    assert.equal(s.stock, 6); assert.equal(s.gift, 8); assert.equal(s.redemptions, 2); assert.equal(s.order.status, 'PAID');
    assert.equal(s.payments.length, 1);
  });
  await migration('20261104100000_0023_atomic_redsys_payment.sql');

  await test('firmas antiguas retiradas y ejecución restringida', async () => {
    assert.equal(await sql("SELECT to_regprocedure('public.decrement_stock_and_confirm_order(uuid,jsonb,uuid)') IS NULL;"), 't');
    assert.equal(await sql("SELECT to_regprocedure('public.decrement_stock_and_confirm_order(uuid,jsonb)') IS NULL;"), 't');
    const signature = 'public.decrement_stock_and_confirm_order(uuid,jsonb,text,text,text,integer,uuid)';
    assert.equal(await sql(`SELECT has_function_privilege('anon','${signature}','EXECUTE');`), 'f');
    assert.equal(await sql(`SELECT has_function_privilege('authenticated','${signature}','EXECUTE');`), 'f');
    assert.equal(await sql(`SELECT has_function_privilege('service_role','${signature}','EXECUTE');`), 't');
  });

  for (const status of ['PAID', 'PREPARING', 'CANCELLED']) {
    await test(`primer cobro y duplicado en ${status}: estado, stock, regalo, pago y fechas intactos`, async () => {
      const f = await fixture();
      const first = await call(f);
      assert.equal(first.ok, true); assert.equal(first.already_processed, false); assert.equal(first.promotion_consumed, true);
      let s = await state(f);
      assert.equal(s.stock, 8); assert.equal(s.gift, 9); assert.equal(s.redemptions, 1); assert.equal(s.payments.length, 1);
      assert.equal(s.order.paid_at, first.paid_at); assert.equal(s.payments[0].paid_at, first.paid_at);
      await sql(`UPDATE orders SET status='${status}' WHERE id='${f.order}';`);
      s = await state(f);
      assert.equal((await call(f)).already_processed, true);
      assert.deepEqual(await state(f), s);
      // An inconsistent amount must not overwrite an operational state either.
      assert.equal((await call(f, { amount: 999 })).review_required, true);
      assert.deepEqual(await state(f), s);
    });
  }

  await test('duplicados concurrentes: segunda sesión bloqueada; un pago y un único descuento/canje', async () => {
    const f = await fixture();
    const first = sql(`BEGIN; ${rpc(f)} SELECT pg_sleep(2); COMMIT;`, 'redsys-first');
    // Synchronize on the first session having fulfilled and still holding locks.
    const deadline = Date.now() + 10000;
    while (await sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='redsys-first' AND wait_event='PgSleep';") !== '1') {
      assert.ok(Date.now() < deadline, 'first session did not reach its lock barrier');
    }
    const second = sql(rpc(f), 'redsys-second');
    let blocked = false;
    while (Date.now() < deadline) {
      if (await sql("SELECT count(*) FROM pg_stat_activity WHERE application_name='redsys-second' AND wait_event_type='Lock';") === '1') { blocked = true; break; }
    }
    assert.ok(blocked, 'second session must wait on the real database lock');
    const [a, b] = await Promise.all([first, second]);
    assert.equal(JSON.parse(a.split('\n')[0]).already_processed, false);
    assert.equal(JSON.parse(b).already_processed, true);
    const s = await state(f);
    assert.equal(s.stock, 8); assert.equal(s.gift, 9); assert.equal(s.redemptions, 1); assert.equal(s.payments.length, 1);
  });

  for (const sameVariant of [false, true]) {
    await test(`regalo agotado${sameVariant ? ' compartiendo variante con producto' : ''}: no se reintenta tras reponer`, async () => {
      const f = await fixture({ sameVariant, giftStock: 0, productStock: sameVariant ? 2 : 10 });
      assert.equal((await call(f)).gift_skipped_no_stock, true);
      let s = await state(f);
      assert.equal(s.stock, sameVariant ? 0 : 8); assert.equal(s.gift, 0); assert.equal(s.redemptions, 0);
      await sql(`UPDATE product_variants SET stock=5 WHERE id='${f.gift}'; UPDATE orders SET status='PREPARING' WHERE id='${f.order}';`);
      s = await state(f);
      assert.equal((await call(f)).already_processed, true);
      assert.deepEqual(await state(f), s);
    });
  }

  await test('regalo con variante compartida: descuenta producto + regalo una vez', async () => {
    const f = await fixture({ sameVariant: true });
    assert.equal((await call(f)).promotion_consumed, true);
    assert.equal((await call(f)).already_processed, true);
    assert.equal((await state(f)).stock, 7);
  });

  await test('cupo agotado conserva comportamiento y no repite descuento del regalo', async () => {
    const f = await fixture();
    await sql(`UPDATE promotions SET current_redemptions=10 WHERE id='${f.promo}';`);
    assert.equal((await call(f)).promotion_consumed, false);
    const s = await state(f);
    assert.equal(s.gift, 9); assert.equal(s.redemptions, 10);
    await call(f); assert.deepEqual(await state(f), s);
  });

  await test('fallo de INSERT del pago revierte stock, regalo, canje y pedido; reintento válido funciona', async () => {
    const f = await fixture();
    const before = await state(f);
    await sql(`CREATE FUNCTION reject_payment() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'test payment failure'; END $$;
      CREATE TRIGGER reject_payment BEFORE INSERT ON payments FOR EACH ROW EXECUTE FUNCTION reject_payment();`);
    await assert.rejects(call(f), /test payment failure/);
    assert.deepEqual(await state(f), before);
    await sql('DROP TRIGGER reject_payment ON payments; DROP FUNCTION reject_payment();');
    assert.equal((await call(f)).ok, true);
  });

  await test('stock insuficiente: cobro registrado sin descuento parcial; duplicado no procesa después de reponer', async () => {
    const f = await fixture({ productStock: 1 });
    assert.equal((await call(f)).error, 'STOCK_INSUFICIENTE');
    let s = await state(f);
    assert.equal(s.order.status, 'STOCK_ERROR'); assert.equal(s.payments.length, 1);
    assert.equal(s.stock, 1); assert.equal(s.gift, 10); assert.equal(s.redemptions, 0); assert.equal(s.order.paid_at, null);
    await sql(`UPDATE product_variants SET stock=10 WHERE id='${f.variant}'; UPDATE orders SET status='CANCELLED' WHERE id='${f.order}';`);
    s = await state(f);
    assert.equal((await call(f)).review_required, true);
    assert.deepEqual(await state(f), s);
  });

  for (const kind of ['paid_at sin pago', 'pago sin paid_at', 'pago incoherente', 'PAID sin evidencias', 'CANCELLED sin evidencias']) {
    await test(`datos históricos: ${kind} exige conciliación sin marcas ni cambios`, async () => {
      const f = await fixture();
      if (kind === 'paid_at sin pago' || kind === 'pago incoherente') await sql(`UPDATE orders SET paid_at=now(),status='PREPARING' WHERE id='${f.order}';`);
      if (kind.startsWith('pago ')) await sql(`INSERT INTO payments(order_id,redsys_ds_order,amount,status,paid_at)
        VALUES ('${f.order}','${f.ds}',${kind === 'pago incoherente' ? 999 : 1000},'succeeded',now());`);
      if (kind.endsWith('sin evidencias')) await sql(`UPDATE orders SET status='${kind.split(' ')[0]}' WHERE id='${f.order}';`);
      const before = await state(f);
      assert.equal((await call(f)).review_required, true);
      assert.deepEqual(await state(f), before);
    });
  }

  await test('pago histórico coherente, incluso reembolsado: duplicado sin nueva marca', async () => {
    const f = await fixture();
    await sql(`UPDATE orders SET paid_at=now(),status='CANCELLED' WHERE id='${f.order}';
      INSERT INTO payments(order_id,redsys_ds_order,amount,status,paid_at) VALUES ('${f.order}','${f.ds}',1000,'refunded',now());`);
    const before = await state(f);
    assert.equal((await call(f)).already_processed, true);
    assert.deepEqual(await state(f), before);
  });

  await test('primer pago con importe incorrecto: revisión sin stock ni pago inventado', async () => {
    const f = await fixture();
    assert.equal((await call(f, { amount: 999 })).error, 'IMPORTE_INCOHERENTE');
    const s = await state(f);
    assert.equal(s.order.status, 'NEEDS_REVIEW'); assert.equal(s.stock, 10); assert.equal(s.gift, 10); assert.equal(s.payments.length, 0);
  });
  await test('primer cobro autorizado tras PAYMENT_FAILED sigue funcionando', async () => {
    const f = await fixture();
    await sql(`UPDATE orders SET status='PAYMENT_FAILED' WHERE id='${f.order}';`);
    assert.equal((await call(f)).ok, true);
    const s = await state(f);
    assert.equal(s.order.status, 'PAID'); assert.equal(s.payments.length, 1); assert.equal(s.stock, 8);
  });
  await test('RPC rechaza respuesta no autorizada o identificador de cobro ajeno sin cambios', async () => {
    const f = await fixture();
    const before = await state(f);
    for (const options of [{ response: '0101' }, { response: 'oops' }, { ds: '99999999' }]) {
      assert.equal((await call(f, options)).error, 'PAGO_INVALIDO');
      assert.deepEqual(await state(f), before);
    }
  });
  console.log(`${checks} comprobaciones PostgreSQL correctas; ninguna conexión remota ni envío de correo.`);
} finally {
  if (started) await command('pg_ctl', ['-D', dataDir, '-m', 'immediate', '-w', 'stop']);
  // Only the directory returned by mkdtemp above can be removed.
  assert.equal(path.dirname(scratch), path.resolve(tmpdir()));
  assert.ok(path.basename(scratch).startsWith('redsys-t1-'));
  await rm(scratch, { recursive: true, force: true });
}
