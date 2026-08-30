import { DatosIlustrativos } from '../materias/components/DatosIlustrativos';
import { InicioView } from '../materias/components/InicioView';
import { inicioDemo } from '../materias/demo-data';

/**
 * Inicio (T-CC-05 ← UIUX §6.1).
 *
 * En esta fase se alimenta del paquete sintético de desarrollo, y lo declara en
 * pantalla (UIUX §2): no hay `apps/api` sirviendo cursos todavía.
 */
export default function Inicio() {
  return (
    <>
      <DatosIlustrativos />
      <InicioView viewModel={inicioDemo()} />
    </>
  );
}
