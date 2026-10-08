import { NextResponse } from "next/server";
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth";
import {
  AppInputValidationError,
  assertSafePayloadText,
  getSafeFormString,
  unsafeInputMessage,
} from "@/lib/input-validation";
import type {
  ProductoUncheckedCreateInput,
  ProductoUncheckedUpdateInput,
} from "@/generated/prisma/models/Producto";

type ProductPayload = {
  id?: string;
  nombre?: string;
  descripcion?: string | null;
  marcaId?: string;
  marcaNombre?: string;
  codigoBarra?: string | null;
  categoriaId?: string;
  categoriaNombre?: string;
  unidadId?: string;
  empaque?: string | null;
  empaqueNombre?: string;
  id_proveedor?: string | null;
  contenido?: number | null;
  unidad_medida?: string | null;
  precioVenta?: number;
  stock?: number;
  urlImagen?: string | null;
  costo?: number;
};

const productSelect = {
  id: true,
  nombre: true,
  descripcion: true,
  marcaId: true,
  codigoBarra: true,
  categoriaId: true,
  unidadId: true,
  contenido: true,
  unidad_medida: true,
  precioVenta: true,
  stock: true,
  urlImagen: true,
  costo: true,
  unidad: {
    select: {
      unidad: true,
    },
  },
  marca: {
    select: {
      nombre: true,
    },
  },
  categoria: {
    select: {
      nombreCategoria: true,
    },
  },
  unidad_medida_productos_unidad_medidaTounidad_medida: {
    select: {
      nombre: true,
    },
  },
} as const;

function buildProductCreateData(
  product: ProductPayload,
): ProductoUncheckedCreateInput {
  return {
    nombre: product.nombre ?? "",
    descripcion: product.descripcion,
    marcaId: product.marcaId ?? "",
    codigoBarra: product.codigoBarra,
    categoriaId: product.categoriaId ?? "",
    unidadId: product.unidadId ?? "",
    contenido:
      typeof product.contenido === "number"
        ? Math.round(product.contenido)
        : product.contenido,
    unidad_medida: product.unidad_medida,
    precioVenta:
      typeof product.precioVenta === "number"
        ? Math.round(product.precioVenta)
        : 0,
    stock: typeof product.stock === "number" ? Math.round(product.stock) : undefined,
    urlImagen: product.urlImagen,
    costo: typeof product.costo === "number" ? Math.round(product.costo) : undefined,
  };
}

function buildProductUpdateData(
  product: ProductPayload,
): ProductoUncheckedUpdateInput {
  return {
    nombre: product.nombre,
    descripcion: product.descripcion,
    marcaId: product.marcaId,
    codigoBarra: product.codigoBarra,
    categoriaId: product.categoriaId,
    unidadId: product.unidadId,
    contenido:
      typeof product.contenido === "number"
        ? Math.round(product.contenido)
        : product.contenido,
    unidad_medida: product.unidad_medida,
    precioVenta:
      typeof product.precioVenta === "number"
        ? Math.round(product.precioVenta)
        : undefined,
    stock: typeof product.stock === "number" ? Math.round(product.stock) : undefined,
    urlImagen: product.urlImagen,
    costo: typeof product.costo === "number" ? Math.round(product.costo) : undefined,
  };
}

function isPrismaError(error: unknown, code: string) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase("es-CL");
}

function getFormString(formData: FormData, key: string) {
  return getSafeFormString(formData, key);
}

function getFormNumber(formData: FormData, key: string) {
  const value = getFormString(formData, key);

  if (!value) {
    return undefined;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function getOptionalFormString(formData: FormData, key: string) {
  const value = getFormString(formData, key)?.trim();
  return value ? value : null;
}

function parseProductFormData(formData: FormData): {
  product: ProductPayload;
  imageFile: FormDataEntryValue | null;
  removeImage: boolean;
} {
  return {
    product: {
      id: getFormString(formData, "id"),
      nombre: getFormString(formData, "nombre"),
      descripcion: getOptionalFormString(formData, "descripcion"),
      marcaId: getFormString(formData, "marcaId"),
      marcaNombre: getFormString(formData, "marcaNombre"),
      codigoBarra: getOptionalFormString(formData, "codigoBarra"),
      categoriaId: getFormString(formData, "categoriaId"),
      categoriaNombre: getFormString(formData, "categoriaNombre"),
      unidadId: getFormString(formData, "unidadId"),
      empaque: getOptionalFormString(formData, "empaque"),
      empaqueNombre: getFormString(formData, "empaqueNombre"),
      id_proveedor: getOptionalFormString(formData, "id_proveedor"),
      contenido: getFormNumber(formData, "contenido") ?? null,
      unidad_medida: getOptionalFormString(formData, "unidad_medida"),
      precioVenta: getFormNumber(formData, "precioVenta"),
      costo: getFormNumber(formData, "costo"),
      stock: getFormNumber(formData, "stock"),
    },
    imageFile: formData.get("imagen"),
    removeImage: getFormString(formData, "removeImage") === "true",
  };
}

function configureCloudinary() {
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME ??
    process.env.CLOUDINARY_PROJECT_NAME ??
    process.env.CLOUDINARY_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY ?? process.env.CLOUDINARY_KEY;
  const apiSecret =
    process.env.CLOUDINARY_API_SECRET ??
    process.env.CLOUDINARY_SECRET_KEY ??
    process.env.CLOUDINARY_SECRET;

  if (!cloudName || !apiKey || !apiSecret) {
    throw new Error("Cloudinary no está configurado.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

async function uploadProductImage(imageFile: FormDataEntryValue | null) {
  if (!(imageFile instanceof File) || imageFile.size === 0) {
    return null;
  }

  if (!imageFile.type.startsWith("image/")) {
    throw new Error("El archivo seleccionado debe ser una imagen.");
  }

  configureCloudinary();

  const bytes = await imageFile.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return new Promise<string>((resolve, reject) => {
    const upload = cloudinary.uploader.upload_stream(
      {
        folder: "almacenator/productos",
        resource_type: "image",
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error("Cloudinary no retornó una URL."));
          return;
        }

        resolve(result.secure_url);
      },
    );

    upload.end(buffer);
  });
}

function getCloudinaryPublicId(imageUrl: string) {
  try {
    const pathname = new URL(imageUrl).pathname;
    const uploadMarker = "/upload/";
    const uploadIndex = pathname.indexOf(uploadMarker);

    if (uploadIndex === -1) {
      return null;
    }

    const pathAfterUpload = pathname.slice(uploadIndex + uploadMarker.length);
    const withoutVersion = pathAfterUpload.replace(/^v\d+\//, "");
    const withoutExtension = withoutVersion.replace(/\.[^/.]+$/, "");

    return decodeURIComponent(withoutExtension);
  } catch {
    return null;
  }
}

async function deleteProductImage(imageUrl: string | null | undefined) {
  if (!imageUrl) {
    return;
  }

  const publicId = getCloudinaryPublicId(imageUrl);

  if (!publicId) {
    return;
  }

  configureCloudinary();

  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
}

type ProductWithPackaging = {
  id: string;
  empaque: string | null;
  id_proveedor: string | null;
  empaque_productos_empaqueToempaque: { nombre_empaque: string } | null;
  proveedores: { nombre: string } | null;
};

type PackagingOption = {
  id: string;
  id_empaque: string;
  nombre_empaque: string;
};

type ProviderOption = {
  id: string;
  id_proveedor: string;
  nombre: string;
};

async function getPackagingOptions() {
  return prisma.$queryRaw<PackagingOption[]>`
    SELECT
      id_empaque::text AS id,
      id_empaque::text AS id_empaque,
      nombre_empaque
    FROM empaque
    ORDER BY nombre_empaque ASC
  `;
}

async function getProviderOptions() {
  return prisma.$queryRaw<ProviderOption[]>`
    SELECT
      id_proveedor::text AS id,
      id_proveedor::text AS id_proveedor,
      nombre
    FROM proveedores
    ORDER BY nombre ASC
  `;
}

async function attachPackagingToProducts<T extends { id: string }>(
  products: T[],
) {
  if (products.length === 0) {
    return [] as (T & ProductWithPackaging)[];
  }

  const productIds = products.map((product) => product.id);
  const rows = await prisma.$queryRaw<
    {
      id: string;
      empaque: string | null;
      nombre_empaque: string | null;
      id_proveedor: string | null;
      proveedor_nombre: string | null;
    }[]
  >`
    SELECT
      p.id_productos::text AS id,
      p.empaque::text AS empaque,
      e.nombre_empaque,
      p.id_proveedor::text AS id_proveedor,
      pr.nombre AS proveedor_nombre
    FROM productos p
    LEFT JOIN empaque e ON e.id_empaque = p.empaque
    LEFT JOIN proveedores pr ON pr.id_proveedor = p.id_proveedor
    WHERE p.id_productos = ANY(${productIds}::uuid[])
  `;
  const packagingByProduct = new Map(rows.map((row) => [row.id, row]));

  return products.map((product) => {
    const packaging = packagingByProduct.get(product.id);

    return {
      ...product,
      empaque: packaging?.empaque ?? null,
      id_proveedor: packaging?.id_proveedor ?? null,
      empaque_productos_empaqueToempaque: packaging?.nombre_empaque
        ? { nombre_empaque: packaging.nombre_empaque }
        : null,
      proveedores: packaging?.proveedor_nombre
        ? { nombre: packaging.proveedor_nombre }
        : null,
    };
  });
}

async function createPackaging(nombreEmpaque: string) {
  const [createdPackaging] = await prisma.$queryRaw<{ id_empaque: string }[]>`
    INSERT INTO empaque (nombre_empaque)
    VALUES (${nombreEmpaque})
    RETURNING id_empaque::text AS id_empaque
  `;

  return createdPackaging;
}

async function setProductPackaging(productId: string, packagingId: string | null) {
  await prisma.$executeRaw`
    UPDATE productos
    SET empaque = ${packagingId}::uuid
    WHERE id_productos = ${productId}::uuid
  `;
}

async function setProductProvider(productId: string, providerId: string | null) {
  await prisma.$executeRaw`
    UPDATE productos
    SET id_proveedor = ${providerId}::uuid
    WHERE id_productos = ${productId}::uuid
  `;
}

async function getProductWithPackaging(productId: string) {
  const product = await prisma.producto.findUnique({
    where: { id: productId },
    select: productSelect,
  });

  if (!product) {
    return null;
  }

  const [productWithPackaging] = await attachPackagingToProducts([product]);
  return productWithPackaging;
}

export const GET = withAuth(async () => {
  try {
    const [
      productos,
      marcas,
      categorias,
      unidades,
      unidadesMedida,
      empaques,
      proveedores,
    ] =
      await Promise.all([
        prisma.producto.findMany({
          orderBy: { nombre: "asc" },
          select: productSelect,
        }),
        prisma.marca.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
        prisma.categoria.findMany({
          orderBy: { nombreCategoria: "asc" },
          select: { id: true, nombreCategoria: true },
        }),
        prisma.unidad.findMany({
          orderBy: { unidad: "asc" },
          select: { id: true, unidad: true },
        }),
        prisma.unidad_medida.findMany({
          orderBy: { nombre: "asc" },
          select: { id: true, nombre: true },
        }),
        getPackagingOptions(),
        getProviderOptions(),
      ]);
    const productsWithPackaging = await attachPackagingToProducts(productos);

    return NextResponse.json({
      status: "ok",
      productos: productsWithPackaging,
      opciones: {
        marcas,
        categorias,
        unidades,
        unidadesMedida,
        empaques,
        proveedores,
      },
    });
  } catch (error) {
    console.error("Error cargando productos:", error);

    return NextResponse.json(
      { status: "error", message: "No se pudieron cargar los productos." },
      { status: 500 },
    );
  }
});

export const POST = withAuth(async (request) => {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const imageRequest = contentType.includes("multipart/form-data");
    const parsed = imageRequest
      ? parseProductFormData(await request.formData())
      : { product: (await request.json()) as ProductPayload, imageFile: null };
    const product = parsed.product;
    assertSafePayloadText(product);
    const marcaNombre = product.marcaNombre?.trim();
    const categoriaNombre = product.categoriaNombre?.trim();
    const empaqueNombre = product.empaqueNombre?.trim();
    const hasExistingMarca = Boolean(product.marcaId && product.marcaId !== "new");
    const hasExistingCategoria = Boolean(
      product.categoriaId && product.categoriaId !== "new",
    );
    const hasExistingEmpaque = Boolean(product.empaque && product.empaque !== "new");

    if (
      !product.nombre ||
      (!hasExistingMarca && !marcaNombre) ||
      (!hasExistingCategoria && !categoriaNombre) ||
      (!hasExistingEmpaque && !empaqueNombre) ||
      !product.unidadId ||
      typeof product.precioVenta !== "number"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "Faltan datos obligatorios para crear el producto.",
        },
        { status: 400 },
      );
    }

    if (marcaNombre) {
      const marcas = await prisma.marca.findMany({
        select: { id: true, nombre: true },
      });
      const duplicatedMarca = marcas.find(
        (marca) => normalizeName(marca.nombre) === normalizeName(marcaNombre),
      );

      if (duplicatedMarca) {
        return NextResponse.json(
          { status: "error", message: "La marca ingresada ya existe." },
          { status: 409 },
        );
      }

      const marca = await prisma.marca.create({
        data: { nombre: marcaNombre },
        select: { id: true },
      });
      product.marcaId = marca.id;
    }

    if (product.marcaId === "new") {
      product.marcaId = undefined;
    }

    if (categoriaNombre) {
      const categorias = await prisma.categoria.findMany({
        select: { id: true, nombreCategoria: true },
      });
      const duplicatedCategoria = categorias.find(
        (categoria) =>
          normalizeName(categoria.nombreCategoria) ===
          normalizeName(categoriaNombre),
      );

      if (duplicatedCategoria) {
        return NextResponse.json(
          { status: "error", message: "La categoria ingresada ya existe." },
          { status: 409 },
        );
      }

      const categoria = await prisma.categoria.create({
        data: { nombreCategoria: categoriaNombre },
        select: { id: true },
      });
      product.categoriaId = categoria.id;
    }

    if (product.categoriaId === "new") {
      product.categoriaId = undefined;
    }

    if (empaqueNombre) {
      const empaques = await getPackagingOptions();
      const duplicatedEmpaque = empaques.find(
        (empaque) =>
          normalizeName(empaque.nombre_empaque) === normalizeName(empaqueNombre),
      );

      if (duplicatedEmpaque) {
        return NextResponse.json(
          { status: "error", message: "El empaque ingresado ya existe." },
          { status: 409 },
        );
      }

      const empaque = await createPackaging(empaqueNombre);
      product.empaque = empaque.id_empaque;
    }

    if (product.empaque === "new") {
      product.empaque = undefined;
    }

    const imageUrl = await uploadProductImage(parsed.imageFile);
    if (imageUrl) {
      product.urlImagen = imageUrl;
    }

    const createdProductBase = await prisma.producto.create({
      data: buildProductCreateData(product),
      select: productSelect,
    });
    if (product.empaque) {
      await setProductPackaging(createdProductBase.id, product.empaque);
    }
    if (product.id_proveedor) {
      await setProductProvider(createdProductBase.id, product.id_proveedor);
    }
    const createdProduct =
      (await getProductWithPackaging(createdProductBase.id)) ?? createdProductBase;

    return NextResponse.json({ status: "ok", producto: createdProduct });
  } catch (error) {
    console.error("Error creando producto:", error);

    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: error.message || unsafeInputMessage },
        { status: 400 },
      );
    }

    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { status: "error", message: "Ya existe un producto con datos únicos repetidos." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo crear el producto." },
      { status: 500 },
    );
  }
});

export const PUT = withAuth(async (request) => {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    const imageRequest = contentType.includes("multipart/form-data");
    const parsed = imageRequest
      ? parseProductFormData(await request.formData())
      : { product: (await request.json()) as ProductPayload, imageFile: null, removeImage: false };
    const product = parsed.product;
    assertSafePayloadText(product);

    if (!product.id) {
      return NextResponse.json(
        { status: "error", message: "Debe enviar el id del producto." },
        { status: 400 },
      );
    }

    const currentProduct = imageRequest
      ? await prisma.producto.findUnique({
          where: { id: product.id },
          select: { urlImagen: true },
        })
      : null;

    const imageUrl = await uploadProductImage(parsed.imageFile);
    const shouldClearImage = parsed.removeImage || Boolean(imageUrl);

    if (imageUrl) {
      product.urlImagen = imageUrl;
    } else if (parsed.removeImage) {
      product.urlImagen = null;
    }

    const updatedProductBase = await prisma.producto.update({
      where: { id: product.id },
      data: buildProductUpdateData(product),
      select: productSelect,
    });
    await setProductPackaging(updatedProductBase.id, product.empaque ?? null);
    await setProductProvider(updatedProductBase.id, product.id_proveedor ?? null);
    const updatedProduct =
      (await getProductWithPackaging(updatedProductBase.id)) ?? updatedProductBase;

    if (shouldClearImage && currentProduct?.urlImagen) {
      try {
        await deleteProductImage(currentProduct.urlImagen);
      } catch (cloudinaryError) {
        console.error("Error eliminando imagen anterior de Cloudinary:", cloudinaryError);
      }
    }

    return NextResponse.json({ status: "ok", producto: updatedProduct });
  } catch (error) {
    console.error("Error actualizando producto:", error);

    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: error.message || unsafeInputMessage },
        { status: 400 },
      );
    }

    if (isPrismaError(error, "P2025")) {
      return NextResponse.json(
        { status: "error", message: "El producto no existe." },
        { status: 404 },
      );
    }

    if (isPrismaError(error, "P2002")) {
      return NextResponse.json(
        { status: "error", message: "Ya existe un producto con datos únicos repetidos." },
        { status: 409 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo actualizar el producto." },
      { status: 500 },
    );
  }
});

export const PATCH = PUT;

export const DELETE = withAuth(async (request) => {
  try {
    const { id } = (await request.json()) as { id?: string };
    assertSafePayloadText(id);

    if (!id) {
      return NextResponse.json(
        { status: "error", message: "Debe enviar el id del producto." },
        { status: 400 },
      );
    }

    await prisma.producto.delete({ where: { id } });

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Error eliminando producto:", error);

    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: error.message || unsafeInputMessage },
        { status: 400 },
      );
    }

    if (isPrismaError(error, "P2025")) {
      return NextResponse.json(
        { status: "error", message: "El producto no existe." },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { status: "error", message: "No se pudo eliminar el producto." },
      { status: 500 },
    );
  }
});
