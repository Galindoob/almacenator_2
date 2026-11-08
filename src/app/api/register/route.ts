import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { authEmailSchema, registrationPasswordSchema } from "@/lib/auth-validation";
import { deleteCloudinaryImage, uploadCloudinaryImage } from "@/lib/cloudinary-images";
import {
  AppInputValidationError,
  assertSafePayloadText,
  unsafeInputMessage,
} from "@/lib/input-validation";

const registrationFieldsSchema = z.object({
  correo: z.string(),
  contrasena: z.string(),
  nombre: z.string(),
  apellido: z.string(),
});

export async function POST(request: NextRequest) {
  const isMultipart = request.headers.get("content-type")?.includes("multipart/form-data");
  const formData = isMultipart ? await request.formData().catch(() => null) : null;
  const rawFields = isMultipart
    ? {
        correo: formData?.get("correo"),
        contrasena: formData?.get("contrasena"),
        nombre: formData?.get("nombre"),
        apellido: formData?.get("apellido"),
      }
    : request.headers.get("content-type")?.includes("application/json")
      ? await request.json().catch(() => null)
      : {
          correo: request.headers.get("correo"),
          contrasena: request.headers.get("contrasena"),
          nombre: request.headers.get("nombre"),
          apellido: request.headers.get("apellido"),
        };
  const fields = registrationFieldsSchema.safeParse(rawFields);

  if (!fields.success) {
    return NextResponse.json(
      { status: "error", message: "Completa todos los datos de registro." },
      { status: 400 },
    );
  }

  const correo = fields.data.correo.trim();
  const contrasena = fields.data.contrasena;
  const nombre = fields.data.nombre.trim();
  const apellido = fields.data.apellido.trim();

  try {
    assertSafePayloadText({ nombre, apellido });
  } catch (error) {
    if (error instanceof AppInputValidationError) {
      return NextResponse.json(
        { status: "error", message: unsafeInputMessage },
        { status: 400 },
      );
    }
  }

  if (!nombre || !apellido || !correo || !contrasena) {
    return NextResponse.json(
      { status: "error", message: "Nombre, apellido, correo y contraseña son obligatorios." },
      { status: 400 },
    );
  }

  const validatedEmail = authEmailSchema.safeParse(correo);
  if (!validatedEmail.success) {
    return NextResponse.json(
      { status: "error", message: validatedEmail.error.issues[0]?.message ?? "Correo inválido." },
      { status: 400 },
    );
  }

  const validatedPassword = registrationPasswordSchema.safeParse(contrasena);
  if (!validatedPassword.success) {
    return NextResponse.json(
      { status: "error", message: validatedPassword.error.issues[0]?.message ?? "Contraseña inválida." },
      { status: 400 },
    );
  }

  let uploadedImageUrl: string | null = null;
  try {
    const image = formData?.get("imagen");
    if (image instanceof File && image.size > 0) {
      if (!/^(image\/jpeg|image\/png|image\/webp|image\/gif)$/.test(image.type) || image.size > 5 * 1024 * 1024) {
        return NextResponse.json({ status: "error", message: "Selecciona una imagen válida de hasta 5 MB." }, { status: 400 });
      }
    }

    if (await prisma.user.findUnique({ where: { correo: validatedEmail.data }, select: { id: true } })) {
      return NextResponse.json({ status: "error", message: "El correo ya está registrado." }, { status: 409 });
    }

    uploadedImageUrl = await uploadCloudinaryImage(image ?? null, "almacenator/usuarios");
    const hashedPassword = await bcrypt.hash(contrasena, 10);

    await prisma.$transaction(async (transaction) => {
      const company = await transaction.empresa.findFirst({
        orderBy: { idEmpresa: "asc" },
        select: { idEmpresa: true },
      });
      if (!company) throw new Error("No existe una empresa configurada.");

      await transaction.user.create({
        data: {
          nombre,
          apellido,
          correo: validatedEmail.data,
          contrasena: hashedPassword,
          url_imagen: uploadedImageUrl,
          configuracion: {
            create: { empresaId: company.idEmpresa },
          },
        },
      });
    });

    return NextResponse.json(
      { status: "ok", message: "Usuario registrado correctamente." },
      { status: 201 },
    );
  } catch (error) {
    if (uploadedImageUrl) {
      try { await deleteCloudinaryImage(uploadedImageUrl); }
      catch (cleanupError) { console.error("Error limpiando imagen de registro:", cleanupError); }
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "El correo ya está registrado.",
        },
        { status: 409 },
      );
    }

    const message = error instanceof Error ? error.message : "Error al registrar usuario.";

    if (
      message.toLowerCase().includes("duplicate") ||
      message.toLowerCase().includes("unique")
    ) {
      return NextResponse.json(
        {
          status: "error",
          message: "El correo ya está registrado.",
        },
        { status: 409 },
      );
    }

    return NextResponse.json(
      {
        status: "error",
        message: "No se pudo registrar el usuario. Inténtalo nuevamente.",
      },
      { status: 500 },
    );
  }
}
