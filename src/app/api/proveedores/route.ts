import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  deleteCloudinaryImage,
  uploadCloudinaryImage,
} from "@/lib/cloudinary-images";
import {
  AppInputValidationError,
  assertSafePayloadText,
  getSafeFormString,
  unsafeInputMessage,
} from "@/lib/input-validation";

type ProviderRow = {
  id_proveedor: string;
  nombre: string;
  nombre_vendedor: string | null;
  correo_contacto: string | null;
  telefono: string | null;
  url_imagen: string | null;
};

type ProviderProductRow = {
  id_producto: string;
  id_proveedor: string | null;
  nombre: string;
  stock: number;
  controla_stock: boolean;
  costo: number;
  contenido: number | null;
  nombre_empaque: string | null;
  unidad_medida_nombre: string | null;
};

type ProviderPayload = {
  id_proveedor?: string;
  nombre?: string;
  nombre_vendedor?: string | null;
  correo_contacto?: string | null;
  telefono?: string | null;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function optionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function getFormString(formData: FormData, key: string) {
  return getSafeFormString(formData, key);
}

export const GET = withAuth(async () => {
  try {
    const [providers, products] = await Promise.all([
      prisma.$queryRaw<ProviderRow[]>`
        SELECT
          id_proveedor::text AS id_proveedor,
          nombre,
          nombre_vendedor,
          correo_contacto,
          telefono,
          url_imagen
        FROM proveedores
        ORDER BY nombre ASC
      `,
      prisma.$queryRaw<ProviderProductRow[]>`
        SELECT
          p.id_productos::text AS id_producto,
          p.id_proveedor::text AS id_proveedor,
          p.nombre,
          p.stock,
          p.controla_stock,
          p.costo,
          p.contenido,
          e.nombre_empaque,
          um.nombre AS unidad_medida_nombre
        FROM productos p
        LEFT JOIN empaque e ON e.id_empaque = p.empaque
        LEFT JOIN unidad_medida um ON um.id = p.unidad_medida
        ORDER BY p.nombre ASC
      `,
    ]);

    const productsByProvider = new Map<string, ProviderProductRow[]>();

    for (const product of products) {
      if (!product.id_proveedor) {
        continue;
      }

      const current = productsByProvider.get(product.id_proveedor) ?? [];
      current.push(product);
      productsByProvider.set(product.id_proveedor, current);
    }

    return NextResponse.json({
      status: "ok",
      proveedores: providers.map((provider) => ({
        ...provider,
        productos: (productsByProvider.get(provider.id_proveedor) ?? []).map(
          (product) => ({
            id: product.id_producto,
            nombre: product.nombre,
            stock: product.stock,
            controlaStock: product.controla_stock,
            costoConIva: Math.round(product.costo * 1.19),
            contenido: product.contenido,
            nombreEmpaque: product.nombre_empaque,
            unidadMedida: product.unidad_medida_nombre,
          }),
        ),
      })),
      productos: products.map((product) => ({
        id: product.id_producto,
        id_proveedor: product.id_proveedor,
        nombre: product.nombre,
        stock: product.stock,
        controlaStock: product.controla_stock,
        costoConIva: Math.round(product.costo * 1.19),
        contenido: product.contenido,
        nombreEmpaque: product.nombre_empaque,
        unidadMedida: product.unidad_medida_nombre,
      })),
    });
  } catch (error) {
    console.error("Error cargando proveedores:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudieron cargar los proveedores." },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request) => {
  let uploadedImageUrl: string | null = null;

  try {
    const formData = await request.formData();
    const name = getFormString(formData, "nombre")?.trim();
    const email = optionalText(getFormString(formData, "correo_contacto"));

    if (!name) {
      return NextResponse.json(
        { status: "error", message: "El nombre del proveedor es obligatorio." },
        { status: 400 },
      );
    }

    if (email && !emailPattern.test(email)) {
      return NextResponse.json(
        { status: "error", message: "Ingresa un correo con formato valido." },
        { status: 400 },
      );
    }

    uploadedImageUrl = await uploadCloudinaryImage(
      formData.get("imagen"),
      "almacenator/proveedores",
    );

    const [createdProvider] = await prisma.$queryRaw<ProviderRow[]>`
      INSERT INTO proveedores (
        nombre,
        nombre_vendedor,
        correo_contacto,
        telefono,
        url_imagen
      )
      VALUES (
        ${name},
        ${optionalText(getFormString(formData, "nombre_vendedor"))},
        ${email},
        ${optionalText(getFormString(formData, "telefono"))},
        ${uploadedImageUrl}
      )
      RETURNING
        id_proveedor::text AS id_proveedor,
        nombre,
        nombre_vendedor,
        correo_contacto,
        telefono,
        url_imagen
    `;

    return NextResponse.json({
      status: "ok",
      proveedor: { ...createdProvider, productos: [] },
    });
  } catch (error) {
    console.error("Error creando proveedor:", error);

    if (uploadedImageUrl) {
      try {
        await deleteCloudinaryImage(uploadedImageUrl);
      } catch (cloudinaryError) {
        console.error("Error limpiando imagen de proveedor:", cloudinaryError);
      }
    }

    const message =
      error instanceof AppInputValidationError
        ? unsafeInputMessage
        : error instanceof Error && error.message.includes("imagen")
          ? error.message
          : "No se pudo crear el proveedor.";

    return NextResponse.json(
      { status: "error", message },
      { status: error instanceof AppInputValidationError ? 400 : 500 },
    );
  }
});

export const PUT = withAuth(async (request) => {
  try {
    const payload = (await request.json()) as ProviderPayload;
    assertSafePayloadText(payload);
    const providerId = payload.id_proveedor?.trim();
    const name = payload.nombre?.trim();
    const email = optionalText(payload.correo_contacto);

    if (!providerId || !name) {
      return NextResponse.json(
        { status: "error", message: "El nombre del proveedor es obligatorio." },
        { status: 400 },
      );
    }

    if (email && !emailPattern.test(email)) {
      return NextResponse.json(
        { status: "error", message: "Ingresa un correo con formato valido." },
        { status: 400 },
      );
    }

    const [updatedProvider] = await prisma.$queryRaw<ProviderRow[]>`
      UPDATE proveedores
      SET
        nombre = ${name},
        nombre_vendedor = ${optionalText(payload.nombre_vendedor)},
        correo_contacto = ${email},
        telefono = ${optionalText(payload.telefono)}
      WHERE id_proveedor = ${providerId}::uuid
      RETURNING
        id_proveedor::text AS id_proveedor,
        nombre,
        nombre_vendedor,
        correo_contacto,
        telefono,
        url_imagen
    `;

    if (!updatedProvider) {
      return NextResponse.json(
        { status: "error", message: "El proveedor no existe." },
        { status: 404 },
      );
    }

    return NextResponse.json({ status: "ok", proveedor: updatedProvider });
  } catch (error) {
    console.error("Error actualizando proveedor:", error);

    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo actualizar el proveedor." },
      { status: 500 },
    );
  }
});

export const PATCH = withAuth(async (request) => {
  try {
    const payload = (await request.json()) as {
      id_proveedor?: string;
      productos_asignados?: string[];
    };
    assertSafePayloadText(payload);
    const providerId = payload.id_proveedor?.trim();
    const assignedProductIds = [
      ...new Set(
        (payload.productos_asignados ?? []).filter(
          (productId): productId is string =>
            typeof productId === "string" && Boolean(productId.trim()),
        ),
      ),
    ];

    if (!providerId || !Array.isArray(payload.productos_asignados)) {
      return NextResponse.json(
        { status: "error", message: "La asignacion de productos no es valida." },
        { status: 400 },
      );
    }

    const provider = await prisma.proveedores.findUnique({
      where: { id_proveedor: providerId },
      select: { id_proveedor: true },
    });

    if (!provider) {
      return NextResponse.json(
        { status: "error", message: "El proveedor no existe." },
        { status: 404 },
      );
    }

    const currentProducts = await prisma.producto.findMany({
      where: { id_proveedor: providerId },
      select: { id: true },
    });
    const assignedSet = new Set(assignedProductIds);
    const removedProductIds = currentProducts
      .map((product) => product.id)
      .filter((productId) => !assignedSet.has(productId));
    const updates = [];

    if (removedProductIds.length > 0) {
      updates.push(
        prisma.producto.updateMany({
          where: { id: { in: removedProductIds } },
          data: { id_proveedor: null },
        }),
      );
    }

    if (assignedProductIds.length > 0) {
      updates.push(
        prisma.producto.updateMany({
          where: { id: { in: assignedProductIds } },
          data: { id_proveedor: providerId },
        }),
      );
    }

    if (updates.length > 0) {
      await prisma.$transaction(updates);
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error administrando productos del proveedor:", error);

    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudieron actualizar los productos." },
      { status: 500 },
    );
  }
});
