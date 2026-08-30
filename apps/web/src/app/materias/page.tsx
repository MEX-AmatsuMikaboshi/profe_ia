import { DatosIlustrativos } from '../../materias/components/DatosIlustrativos';
import { MisMateriasView } from '../../materias/components/MisMateriasView';
import { misMateriasDemo } from '../../materias/demo-data';

/** Mis materias (T-CC-05 ← UIUX §6.2, UI-CORR-01). */
export default function MisMaterias() {
  return (
    <>
      <DatosIlustrativos />
      <MisMateriasView viewModel={misMateriasDemo()} />
    </>
  );
}
