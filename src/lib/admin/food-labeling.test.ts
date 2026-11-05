import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  enabled: false,
  authenticated: vi.fn(),
  session: vi.fn(),
  from: vi.fn(),
}));

vi.mock('@/lib/admin/features', () => ({ get FOOD_LABELING_ENABLED() { return mocks.enabled; } }));
vi.mock('@/lib/admin-session', () => ({ isAdminAuthenticated: mocks.authenticated, getAdminSession: mocks.session }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
  notFound: () => { throw new Error('notFound'); },
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
}));

import { POST as generate } from '@/app/api/admin/pedidos/[id]/etiquetas/route';
import { POST as prepared } from '@/app/api/admin/pedidos/[id]/preparado/route';
import { PATCH as edit } from '@/app/api/admin/etiquetas/[id]/route';
import { POST as cancel } from '@/app/api/admin/etiquetas/[id]/anular/route';
import { POST as print } from '@/app/api/admin/etiquetas/imprimir/route';
import { PATCH as operator } from '@/app/api/admin/configuracion/etiquetas/operador/route';
import { POST as createProfile } from '@/app/api/admin/configuracion/etiquetas/perfiles/route';
import { PATCH as editProfile } from '@/app/api/admin/configuracion/etiquetas/perfiles/[id]/route';
import { PATCH as editProduct } from '@/app/api/admin/configuracion/etiquetas/productos/[id]/route';
import PreparePage from '@/app/admin/pedidos/[id]/etiquetar/page';
import PreviewPage from '@/app/admin/pedidos/[id]/etiquetas/[labelId]/vista-previa/page';
import PrintPage from '@/app/admin/pedidos/[id]/etiquetas/imprimir/page';
import SettingsPage from '@/app/admin/configuracion/etiquetas/page';
import OrderPage from '@/app/admin/pedidos/[id]/page';
import ProductLabelConfigForm from '@/components/Admin/Labels/ProductLabelConfigForm';

const context = { params: Promise.resolve({ id: 'order-1' }) };
const shared = {
  countryOfOrigin: 'España', ingredients: 'Carne, sal', allergens: ['leche'],
  allergensNotes: 'Puede contener huevo', storageConditions: 'Entre 0 y 4 °C',
  prepInstructions: 'Cocinar antes de consumir', cookingMethod: 'A la plancha',
};
const internal = {
  labelProfileId: '11111111-1111-4111-8111-111111111111', labelDisplayName: 'Denominación conservada',
  usualUnitsPerPackage: 4, suggestedPackageCount: 2,
};
const request = (body: unknown) => new Request('http://localhost/api/admin/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.enabled = false;
  mocks.authenticated.mockResolvedValue(true);
  mocks.session.mockResolvedValue({ workerName: 'Ana', sid: 'session-1' });
  mocks.from.mockImplementation(() => { throw new Error('Consulta inesperada'); });
});

const exclusiveEndpoints = [
  { name: 'generar', call: (req: Request) => generate(req, context) },
  { name: 'preparado', call: (req: Request) => prepared(req, context) },
  { name: 'editar', call: (req: Request) => edit(req, context) },
  { name: 'anular', call: (req: Request) => cancel(req, context) },
  { name: 'imprimir', call: (req: Request) => print(req) },
  { name: 'operador', call: (req: Request) => operator(req) },
  { name: 'crear perfil', call: (req: Request) => createProfile(req) },
  { name: 'editar perfil', call: (req: Request) => editProfile(req, context) },
];
const exclusivePages = [
  { name: 'preparación', call: () => PreparePage(context) },
  { name: 'vista previa', call: () => PreviewPage({ params: Promise.resolve({ id: 'order-1', labelId: 'label-1' }) }) },
  { name: 'impresión', call: () => PrintPage({ ...context, searchParams: Promise.resolve({ ids: 'label-1' }) }) },
];

describe('acceso directo al etiquetado desactivado', () => {
  for (const endpoint of exclusiveEndpoints) {
    it(`${endpoint.name}: autentica antes de devolver 404, sin leer el body ni acceder a la base`, async () => {
      const req = request({});
      const readBody = vi.spyOn(req, 'json');
      const response = await endpoint.call(req);
      expect(response.status).toBe(404);
      expect(mocks.authenticated.mock.calls.length + mocks.session.mock.calls.length).toBe(1);
      expect(readBody).not.toHaveBeenCalled();
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it(`${endpoint.name}: conserva el 401 sin sesión`, async () => {
      mocks.authenticated.mockResolvedValue(false);
      mocks.session.mockResolvedValue(null);
      expect((await endpoint.call(request({}))).status).toBe(401);
      expect(mocks.from).not.toHaveBeenCalled();
    });
  }

  for (const page of exclusivePages) {
    it(`${page.name}: devuelve 404 antes de cargar datos o montar la impresión`, async () => {
      await expect(page.call()).rejects.toThrow('notFound');
      expect(mocks.authenticated).toHaveBeenCalledOnce();
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it(`${page.name}: redirige al login sin sesión`, async () => {
      mocks.authenticated.mockResolvedValue(false);
      await expect(page.call()).rejects.toThrow('redirect:/admin/login');
      expect(mocks.from).not.toHaveBeenCalled();
    });

    it(`${page.name}: permite recuperar el flujo al reactivar la constante`, async () => {
      mocks.enabled = true;
      await expect(page.call()).rejects.toThrow('Consulta inesperada');
      expect(mocks.from).toHaveBeenCalled();
    });
  }
});

describe('escritura de datos compartidos del producto', () => {
  function productDatabase() {
    const stored = {
      label_profile_id: internal.labelProfileId, label_display_name: internal.labelDisplayName,
      usual_units_per_package: internal.usualUnitsPerPackage, suggested_package_count: internal.suggestedPackageCount,
    };
    const update = vi.fn((values: object) => ({ eq: vi.fn(async () => {
      Object.assign(stored, values);
      return { error: null };
    }) }));
    mocks.from.mockReturnValue({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: 'product-1' } }) }) }), update,
    });
    return { stored, update };
  }

  it('guarda todos los campos compartidos y conserva los valores internos existentes', async () => {
    const { stored, update } = productDatabase();
    expect((await editProduct(request(shared), context)).status).toBe(200);
    expect(update).toHaveBeenCalledWith({
      country_of_origin: shared.countryOfOrigin, ingredients: shared.ingredients, allergens: shared.allergens,
      allergens_notes: shared.allergensNotes, storage_conditions: shared.storageConditions,
      prep_instructions: shared.prepInstructions, cooking_method: shared.cookingMethod, updated_at: expect.any(String),
    });
    expect(stored).toMatchObject({
      label_profile_id: internal.labelProfileId, label_display_name: internal.labelDisplayName,
      usual_units_per_package: 4, suggested_package_count: 2,
    });
  });

  for (const [field, value] of Object.entries({ ...internal, label_profile_id: internal.labelProfileId, price: 1 })) {
    it(`rechaza el campo no compartido ${field} sin consultas ni escrituras`, async () => {
      expect((await editProduct(request({ ...shared, [field]: value }), context)).status).toBe(400);
      expect(mocks.from).not.toHaveBeenCalled();
    });
  }

  it('conserva la autenticación en la edición compartida', async () => {
    mocks.authenticated.mockResolvedValue(false);
    expect((await editProduct(request(shared), context)).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('recupera la edición interna con la constante activada', async () => {
    mocks.enabled = true;
    const { stored } = productDatabase();
    expect((await editProduct(request({ ...shared, ...internal, suggestedPackageCount: 7 }), context)).status).toBe(200);
    expect(stored.suggested_package_count).toBe(7);
  });
});

describe('interfaz y consultas de pedidos y productos', () => {
  function readDatabase(rows: Record<string, unknown>, singles: Record<string, unknown> = {}) {
    const selects: { table: string; columns: string }[] = [];
    mocks.from.mockImplementation((table: string) => {
      if (!(table in rows) && !(table in singles)) throw new Error(`Tabla inesperada: ${table}`);
      const query = {
        select: (columns: string) => { selects.push({ table, columns }); return query; },
        eq: () => query, in: () => query, order: () => query,
        returns: async () => ({ data: rows[table] ?? [] }),
        maybeSingle: async () => ({ data: singles[table] ?? null }),
      };
      return query;
    });
    return selects;
  }

  it('muestra datos alimentarios editables sin consultar operador/perfiles ni mostrar herramientas internas', async () => {
    const selects = readDatabase({ products: [{
      id: 'product-1', name: 'Hamburguesas', country_of_origin: shared.countryOfOrigin,
      ingredients: shared.ingredients, allergens: shared.allergens, allergens_notes: shared.allergensNotes,
      storage_conditions: shared.storageConditions, prep_instructions: shared.prepInstructions, cooking_method: shared.cookingMethod,
    }] });
    const html = renderToStaticMarkup(await SettingsPage());
    for (const text of ['Datos de productos', 'Ingredientes', 'Alérgenos', 'Notas de alérgenos', 'Condiciones de conservación',
      'Instrucciones de uso', 'Modo de cocinado', 'País/lugar de origen', shared.ingredients, shared.storageConditions]) {
      expect(html).toContain(text);
    }
    for (const text of ['Configuración de etiquetas', 'Datos del operador', 'Perfiles de etiquetado', 'Perfil de etiquetado',
      'Denominación de etiqueta', 'Unidades habituales por envase', 'Envases sugeridos', 'Sin perfil asignado', 'por defecto del perfil']) {
      expect(html).not.toContain(text);
    }
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('products');
    expect(selects[0].columns).not.toMatch(/label_|package/);
  });

  it('conserva el detalle operativo, regalos, incidencias e histórico sin consultar etiquetas ni mostrar sus marcas', async () => {
    const selects = readDatabase({
      order_items: [{
        id: 'item-1', product_name_snapshot: 'Hamburguesas', variant_name_snapshot: 'Pack de 4',
        quantity: 2, line_total: 2400, allergens_snapshot: ['leche'], allergens_notes_snapshot: 'Contiene leche', item_type: 'GIFT',
      }],
      order_status_history: [
        { id: 'event-1', event_type: 'PEDIDO_ETIQUETADO', created_at: '2026-10-29T12:00:00Z' },
        { id: 'event-2', event_type: 'IMPORTE_INCOHERENTE', created_at: '2026-10-29T12:00:00Z', metadata: {} },
      ],
    }, { payments: { amount: 3400 }, orders: {
      id: 'order-1', order_number: 'BM-1', status: 'PAID', created_at: '2026-10-29T12:00:00Z',
      labeled_at: '2026-10-29T12:00:00Z', labeled_by: 'Trabajador histórico',
      subtotal: 2400, shipping_cost: 1000, total: 3400, admin_notes: 'Preparar con cuidado',
    } });
    const html = renderToStaticMarkup(await OrderPage(context));
    for (const text of ['Productos a preparar', 'Hamburguesas', 'Pack de 4', '× 2', 'REGALO PROMO', 'Contiene leche',
      'Notas internas', 'Preparar con cuidado', 'Histórico del pedido', 'Cambiar estado', 'Pedido marcado como preparado/etiquetado', 'Incidencias']) {
      expect(html).toContain(text);
    }
    expect(html).not.toContain('Preparar y etiquetar');
    expect(html).not.toContain('impresos/anulados');
    expect(html).not.toContain('Trabajador histórico');
    expect(selects.find((query) => query.table === 'orders')?.columns).not.toContain('labeled_');
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('product_labels');
  });

  it('recupera los controles de etiquetado del producto al activar la constante', () => {
    mocks.enabled = true;
    const html = renderToStaticMarkup(createElement(ProductLabelConfigForm, {
      productId: 'product-1', initial: { ...shared, ...internal }, profiles: [],
    }));
    expect(html).toContain('Perfil de etiquetado');
    expect(html).toContain('Unidades habituales por envase');
    expect(html).toContain('Envases sugeridos');
  });

  it('recupera operador, perfiles y consultas de configuración al reactivar el módulo', async () => {
    mocks.enabled = true;
    const selects = readDatabase({ products: [], label_profiles: [] }, { shop_settings: {} });
    const html = renderToStaticMarkup(await SettingsPage());
    expect(html).toContain('Configuración de etiquetas');
    expect(html).toContain('Datos del operador alimentario');
    expect(html).toContain('Perfiles de etiquetado');
    expect(selects.map(({ table }) => table)).toEqual(['shop_settings', 'label_profiles', 'products']);
    expect(selects.find(({ table }) => table === 'products')?.columns).toContain('label_profile_id');
  });
});
