import { NextResponse } from "next/server";
import { withAuth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  deleteCloudinaryImage,
  uploadCloudinaryImage,
} from "@/lib/cloudinary-images";
import {
  AppInputValidationError,
  getSafeFormString,
  unsafeInputMessage,
} from "@/lib/input-validation";

function getFormString(formData: FormData, key: string) {
  return getSafeFormString(formData, key);
}

export const PUT = withAuth(async (request) => {
  let uploadedImageUrl: string | null = null;

  try {
    const formData = await request.formData();
    const providerId = getFormString(formData, "id_proveedor")?.trim();
    const removeImage = getFormString(formData, "removeImage") === "true";

    if (!providerId) {
      return NextResponse.json(
        { status: "error", message: "Debe indicar el proveedor." },
        { status: 400 },
      );
    }

    const currentProvider = await prisma.proveedores.findUnique({
      where: { id_proveedor: providerId },
      select: { id_proveedor: true, url_imagen: true },
    });

    if (!currentProvider) {
      return NextResponse.json(
        { status: "error", message: "El proveedor no existe." },
        { status: 404 },
      );
    }

    uploadedImageUrl = await uploadCloudinaryImage(
      formData.get("imagen"),
      "almacenator/proveedores",
    );

    if (!uploadedImageUrl && !removeImage) {
      return NextResponse.json({
        status: "ok",
        url_imagen: currentProvider.url_imagen,
      });
    }

    const nextImageUrl = uploadedImageUrl ?? null;
    await prisma.proveedores.update({
      where: { id_proveedor: providerId },
      data: { url_imagen: nextImageUrl },
    });

    if (
      currentProvider.url_imagen &&
      currentProvider.url_imagen !== nextImageUrl
    ) {
      try {
        await deleteCloudinaryImage(currentProvider.url_imagen);
      } catch (cloudinaryError) {
        console.error(
          "Error eliminando imagen anterior del proveedor:",
          cloudinaryError,
        );
      }
    }

    return NextResponse.json({ status: "ok", url_imagen: nextImageUrl });
  } catch (error) {
    console.error("Error actualizando imagen del proveedor:", error);

    if (uploadedImageUrl) {
      try {
        await deleteCloudinaryImage(uploadedImageUrl);
      } catch (cloudinaryError) {
        console.error("Error limpiando la imagen nueva:", cloudinaryError);
      }
    }

    const message =
      error instanceof AppInputValidationError
        ? unsafeInputMessage
        : error instanceof Error && error.message.includes("imagen")
          ? error.message
          : "No se pudo actualizar la imagen del proveedor.";

    return NextResponse.json(
      { status: "error", message },
      { status: error instanceof AppInputValidationError ? 400 : 500 },
    );
  }
});
