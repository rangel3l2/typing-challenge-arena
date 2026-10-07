import { useEffect, useState } from "react";
import { Capacitor, registerPlugin } from "@capacitor/core";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/components/ui/use-toast";
import { isNewerVersion, parseAndroidUpdate, type AndroidRelease } from "@/lib/androidUpdate";

interface AppUpdaterPlugin {
  getVersion(): Promise<{ versionName: string }>;
  installUpdate(options: { url: string; sha256: string }): Promise<{ permissionRequired: boolean }>;
}

const AppUpdaterNative = registerPlugin<AppUpdaterPlugin>("AppUpdater");
const LATEST_RELEASE_URL =
  "https://api.github.com/repos/rangel3l2/typing-challenge-arena/releases/latest";

export default function AndroidUpdater() {
  const [update, setUpdate] = useState<ReturnType<typeof parseAndroidUpdate>>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let active = true;
    const checkForUpdate = async () => {
      try {
        const [installed, response] = await Promise.all([
          AppUpdaterNative.getVersion(),
          fetch(LATEST_RELEASE_URL, {
            headers: { Accept: "application/vnd.github+json" },
          }),
        ]);
        if (!response.ok) return;

        const release = (await response.json()) as AndroidRelease;
        const latest = parseAndroidUpdate(release);
        if (active && latest && isNewerVersion(latest.version, installed.versionName)) {
          setUpdate(latest);
          setOpen(true);
        }
      } catch {
        // Update checks are best-effort; the installed app remains usable offline.
      }
    };

    void checkForUpdate();
    return () => {
      active = false;
    };
  }, []);

  const installUpdate = async () => {
    if (!update) return;
    setBusy(true);
    try {
      const result = await AppUpdaterNative.installUpdate({ url: update.url, sha256: update.sha256 });
      if (result.permissionRequired) {
        setNeedsPermission(true);
        return;
      }
      setOpen(false);
    } catch {
      toast({
        variant: "destructive",
        title: "Não foi possível preparar a atualização",
        description: "Confira sua conexão e tente novamente.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Atualização disponível</AlertDialogTitle>
          <AlertDialogDescription>
            A versão {update?.version} está pronta para baixar. O Android pedirá sua confirmação para instalar.
            {needsPermission && (
              <span className="mt-2 block">
                Permita a instalação para este app nas configurações abertas e toque em continuar.
              </span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Depois</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={(event) => {
              event.preventDefault();
              void installUpdate();
            }}
          >
            {busy ? "Preparando..." : needsPermission ? "Continuar" : "Baixar atualização"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}