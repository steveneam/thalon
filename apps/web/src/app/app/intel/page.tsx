import { Intel } from "@/components/intel/intel";
import "@/components/intel/intel.css";

/**
 * The Intel surface. STEP 1 of the exact-mock rebuild renders the pure port
 * of Intel.dc.html — the structural verdict point; step 2 wires the real
 * reads, the capture doors and the ?tab= deep link back on.
 */
export default function IntelPage() {
  return <Intel />;
}
