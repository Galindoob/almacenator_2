import { v2 as cloudinary, type UploadApiResponse } from "cloudinary";

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
    throw new Error("Cloudinary no esta configurado.");
  }

  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
  });
}

export async function uploadCloudinaryImage(
  imageFile: FormDataEntryValue | null,
  folder: string,
) {
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
        folder,
        resource_type: "image",
        transformation: [
          {
            width: 800,
            height: 800,
            crop: "pad",
            gravity: "center",
            background: "#ffffff",
          },
        ],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result?.secure_url) {
          reject(error ?? new Error("Cloudinary no retorno una URL."));
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
    return decodeURIComponent(withoutVersion.replace(/\.[^/.]+$/, ""));
  } catch {
    return null;
  }
}

export async function deleteCloudinaryImage(imageUrl: string | null | undefined) {
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
