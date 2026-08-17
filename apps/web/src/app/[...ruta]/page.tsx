import { NoImplementado } from '../no-implementado';

/**
 * Catch-all: cualquier ruta que no sea Clase responde `NO_IMPLEMENTADO` (D-11).
 * La ruta de Clase es más específica y gana la resolución del App Router.
 */
export default async function RutaNoImplementada({
  params,
}: {
  readonly params: Promise<{ readonly ruta: readonly string[] }>;
}) {
  const { ruta } = await params;
  return <NoImplementado ruta={`/${ruta.join('/')}`} />;
}
