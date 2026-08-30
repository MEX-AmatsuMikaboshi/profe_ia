import { notFound } from 'next/navigation';

import { DatosIlustrativos } from '../../../materias/components/DatosIlustrativos';
import { DetalleView } from '../../../materias/components/DetalleView';
import { conoceMateria, detalleDemo } from '../../../materias/demo-data';

/**
 * Detalle de materia (T-CC-05 ← UIUX §6.4).
 *
 * Una materia desconocida da 404 y no una vista vacía: una pantalla de detalle
 * sin contenido se lee como una materia que perdió sus datos.
 */
export default async function DetalleMateria({
  params,
}: {
  readonly params: Promise<{ readonly materiaId: string }>;
}) {
  const { materiaId } = await params;
  if (!conoceMateria(materiaId)) notFound();
  return (
    <>
      <DatosIlustrativos />
      <DetalleView viewModel={detalleDemo(materiaId)} />
    </>
  );
}
