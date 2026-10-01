/** Solo acepta rutas internas ("/panel"), nunca URLs externas ("//sitio.com"), para evitar redirecciones abiertas. */
export function rutaSegura(volver: string | null): string {
  return volver && volver.startsWith("/") && !volver.startsWith("//") ? volver : "/";
}
