import { notFound } from 'next/navigation';

import { DatosIlustrativos } from '../../../../materias/components/DatosIlustrativos';
import { ProgresoView } from '../../../../materias/components/ProgresoView';
import { conoceMateria, progresoDemo } from '../../../../materias/demo-data';

/** Progreso (T-CC-05 ← UIUX §6.6). Dos ramas según la autoridad de evaluación. */
export default async function Progreso({
  params,
}: {
  readonly params: Promise<{ readonly materiaId: string }>;
}) {
  const { materiaId } = await params;
  if (!conoceMateria(materiaId)) notFound();
  return (
    <>
      <DatosIlustrativos />
      <ProgresoView viewModel={progresoDemo(materiaId)} />
    </>
  );
}
