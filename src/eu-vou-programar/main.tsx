import { createRoot } from "react-dom/client";
import ArenaAudit from "./ArenaAudit";
import EuVouProgramar from "./EuVouProgramar";
import "./programar.css";

const auditMode = new URLSearchParams(window.location.search).get("audit") === "1";

createRoot(document.getElementById("programar-root")!).render(auditMode ? <ArenaAudit /> : <EuVouProgramar />);
