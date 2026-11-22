This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Recuperación de contraseña

Configura estas variables en `.env` para enviar los códigos por [Resend](https://resend.com/features/email-api):

```env
RESEND_API_KEY=...
RESEND_FROM="Mini Gest <seguridad@tu-dominio-verificado.cl>"
```

El remitente debe pertenecer a un dominio verificado en Resend. Sin estas variables, la app no afirmará que se envió un código y mostrará un error de configuración. Los códigos vencen en 10 minutos y admiten hasta cinco intentos.

### Expiración de ventas pendientes

Las ventas pendientes sin pagos caducan tras una hora desde la última modificación de productos. La limpieza también se ejecuta al consultar ventas, transacciones o caja. Para ejecutar la limpieza sin usuarios conectados, configura un programador externo para enviar cada cinco minutos una solicitud GET a `/api/tareas/ventas-expiradas`, con el encabezado `Authorization: Bearer <CRON_SECRET>`. Configura `CRON_SECRET` como una clave larga y aleatoria en las variables de entorno del despliegue; sin ella, la ruta rechaza las solicitudes. No publiques la clave en el repositorio. El plan Hobby de Vercel no ofrece cron cada cinco minutos. La tarea procesa hasta 100 ventas por ejecución; ejecuciones posteriores procesan el resto. La migración debe aplicarse antes de desplegar el código.

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
