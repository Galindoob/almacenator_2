import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { deleteCloudinaryImage, uploadCloudinaryImage } from "@/lib/cloudinary-images";

const profileFieldsSchema = z.object({
  fono: z.string().max(25, "El teléfono no puede superar 25 caracteres.").refine((value) => !/['"]/.test(value), "El teléfono no puede contener comillas."),
  direccion: z.string().max(200, "La dirección no puede superar 200 caracteres.").refine((value) => !/['"]/.test(value), "La dirección no puede contener comillas."),
});

export const GET = withAuth(async (request) => {
  try {
    const user = await prisma.user.findUnique({
      where: { correo: request.correo },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        correo: true,
        fono: true,
        direccion: true,
        url_imagen: true,
        role: { select: { role: true } },
      },
    });

    if (!user) {
      return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });
    }

    const [totalVentas, totalAperturas] = await Promise.all([
      prisma.venta.count({ where: { id_vendedor: user.id, estado: "completado" } }),
      prisma.apertura_caja.count({ where: { id_usuario_apertura: user.id } }),
    ]);

    return NextResponse.json({
      perfil: {
        nombre: [user.nombre, user.apellido].filter(Boolean).join(" "),
        correo: user.correo,
        rol: user.role.role,
        fono: user.fono,
        direccion: user.direccion,
        urlImagen: user.url_imagen,
        totalVentas,
        totalAperturas,
      },
    });
  } catch (error) {
    console.error("Error al consultar el perfil:", error);
    return NextResponse.json({ message: "No se pudo cargar el perfil." }, { status: 500 });
  }
});

export const PUT = withAuth(async (request) => {
  let uploadedImageUrl: string | null = null;
  try {
    const formData = await request.formData();
    const parsed = profileFieldsSchema.safeParse({ fono: formData.get("fono"), direccion: formData.get("direccion") });
    if (!parsed.success) {
      return NextResponse.json({ message: parsed.error.issues[0]?.message ?? "Datos inválidos." }, { status: 400 });
    }

    const image = formData.get("imagen");
    if (image instanceof File && image.size > 0 &&
      (!/^(image\/jpeg|image\/png|image\/webp|image\/gif)$/.test(image.type) || image.size > 5 * 1024 * 1024)) {
      return NextResponse.json({ message: "Selecciona una imagen JPG, PNG, WebP o GIF de hasta 5 MB." }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { correo: request.correo }, select: { id: true, url_imagen: true } });
    if (!user) return NextResponse.json({ message: "Usuario no encontrado." }, { status: 404 });

    uploadedImageUrl = await uploadCloudinaryImage(image, "almacenator/usuarios");
    const removeImage = formData.get("removeImage") === "true";
    const nextImageUrl = uploadedImageUrl ?? (removeImage ? null : user.url_imagen);
    await prisma.user.update({
      where: { id: user.id },
      data: {
        fono: parsed.data.fono.trim() || null,
        direccion: parsed.data.direccion.trim() || null,
        url_imagen: nextImageUrl,
      },
    });

    if (user.url_imagen && user.url_imagen !== nextImageUrl) {
      try { await deleteCloudinaryImage(user.url_imagen); }
      catch (cleanupError) { console.error("Error eliminando imagen anterior del perfil:", cleanupError); }
    }

    return NextResponse.json({ message: "Perfil actualizado correctamente.", fono: parsed.data.fono.trim() || null, direccion: parsed.data.direccion.trim() || null, urlImagen: nextImageUrl });
  } catch (error) {
    if (uploadedImageUrl) {
      try { await deleteCloudinaryImage(uploadedImageUrl); }
      catch (cleanupError) { console.error("Error limpiando imagen nueva del perfil:", cleanupError); }
    }
    console.error("Error actualizando el perfil:", error);
    return NextResponse.json({ message: "No se pudo actualizar el perfil." }, { status: 500 });
  }
});
