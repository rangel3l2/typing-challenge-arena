import { useEffect, useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "@/hooks/use-toast";

// GitHub repo onde ficam o APK + latest.json + sha256.txt.
// Para publicar uma nova versão: faça commit dos arquivos novos em /releases na branch main.
const GITHUB_OWNER = "rangel3l21";
const GITHUB_REPO = "tablet-EPT-Manager";
const GITHUB_BRANCH = "main";
const GITHUB_RELEASES_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}/releases`;
const LATEST_JSON_URL = `${GITHUB_RELEASES_BASE}/latest.json`;

// Fallback caso o fetch do GitHub falhe (último APK conhecido).
const FALLBACK_APK_URL = `${GITHUB_RELEASES_BASE}/Amarok-v0.10.1+fd95cb3-foss.apk`;
const DEFAULT_SIGNATURE_CHECKSUM =
  "Mqr2ZGXF59CT2y8SZHUooartzIhy0Ypzk6hUJ2GZNIY";

interface LatestManifest {
  releaseFile?: string;
  downloadUrl?: string;
  signatureChecksum?: string;
  version?: string;
}

// Validation helpers
const isValidChecksum = (checksum: string): boolean =>
  /^[A-Za-z0-9_-]{43}$/.test(checksum);
const isValidSsid = (ssid: string): boolean => ssid.length >= 1 && ssid.length <= 32;
const isValidWifiPassword = (pw: string): boolean => pw.length >= 8 && pw.length <= 63;

export default function Provisionamento() {
  const [component, setComponent] = useState(
    "deltazero.amarok.foss/deltazero.amarok.receivers.AdminReceiver"
  );
  const [apkUrl, setApkUrl] = useState(getDefaultApkUrl);
  const [checksum, setChecksum] = useState(DEFAULT_SIGNATURE_CHECKSUM);
  const [ssid, setSsid] = useState("Rangel");
  const [password, setPassword] = useState("211292abc");
  const [touched, setTouched] = useState({
    checksum: false,
    ssid: false,
    password: false,
  });
  const restoreDefaultChecksum = () => {
    setChecksum(DEFAULT_SIGNATURE_CHECKSUM);
    setTouched((p) => ({ ...p, checksum: true }));
    toast({ title: "Checksum restaurado", description: DEFAULT_SIGNATURE_CHECKSUM });
  };

  // Validate fields
  const errors = useMemo(() => {
    return {
      checksum: !isValidChecksum(checksum),
      ssid: !isValidSsid(ssid),
      password: !isValidWifiPassword(password),
    };
  }, [checksum, ssid, password]);

  const allValid = !errors.checksum && !errors.ssid && !errors.password;

  const json = useMemo(() => {
    if (!allValid) return "";
    const obj: Record<string, string> = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": component,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
        apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_SIGNATURE_CHECKSUM": checksum,
      "android.app.extra.PROVISIONING_WIFI_SSID": ssid,
      "android.app.extra.PROVISIONING_WIFI_PASSWORD": password,
      "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE": "WPA",
    };
    return JSON.stringify(obj);
  }, [component, apkUrl, checksum, ssid, password, allValid]);

  return (
    <main className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <header>
          <h1 className="text-2xl font-bold">
            Provisionamento Android Enterprise
          </h1>
          <p className="text-sm text-muted-foreground">
            Device Owner via QR Code
          </p>
        </header>

        <section className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h2 className="font-semibold">Download do APK</h2>
          <div className="space-y-2">
            <Label htmlFor="apkUrl">URL pública do APK</Label>
            <Input
              id="apkUrl"
              value={apkUrl}
              onChange={(e) => setApkUrl(e.target.value)}
              placeholder="https://seu-dominio/app-admin.apk"
            />
            <p className="text-xs text-muted-foreground">
              O tablet baixa o APK desta URL durante o provisionamento. Deve ser HTTPS e estar acessível publicamente.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <a href={apkUrl} download>
                Baixar app-admin.apk
              </a>
            </Button>
            <Button onClick={restoreDefaultChecksum} variant="secondary">
              <RefreshCw className="w-4 h-4 mr-2" />
              Restaurar checksum oficial
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Este QR usa o checksum da assinatura do APK, não o SHA-256 do arquivo inteiro.
          </p>
        </section>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="space-y-4 rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold">Configuração</h2>

            <div className="space-y-2">
              <Label htmlFor="component">Package/Receiver</Label>
              <Input
                id="component"
                value={component}
                onChange={(e) => setComponent(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="checksum">
                Checksum Base64
              </Label>
              <Input
                id="checksum"
                value={checksum}
                onChange={(e) => {
                  setChecksum(e.target.value.trim());
                  setTouched((prev) => ({ ...prev, checksum: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, checksum: true }))}
                placeholder="Checksum da assinatura em Base64 URL-safe"
                className={touched.checksum && errors.checksum ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.checksum && errors.checksum && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  O checksum deve ser Base64 URL-safe com 43 caracteres.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="ssid">SSID do Wi-Fi</Label>
              <Input
                id="ssid"
                value={ssid}
                onChange={(e) => {
                  setSsid(e.target.value);
                  setTouched((prev) => ({ ...prev, ssid: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, ssid: true }))}
                className={touched.ssid && errors.ssid ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.ssid && errors.ssid && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  O SSID deve ter entre 1 e 32 caracteres.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha do Wi-Fi</Label>
              <Input
                id="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setTouched((prev) => ({ ...prev, password: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
                className={touched.password && errors.password ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.password && errors.password && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  A senha deve ter entre 8 e 63 caracteres.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-border bg-card p-4 flex flex-col items-center">
            <h2 className="font-semibold self-start">QR Code</h2>
            {allValid && json ? (
              <>
                <div className="bg-white p-4 rounded-lg">
                  <QRCodeCanvas value={json} size={280} level="M" />
                </div>
                <pre className="w-full text-xs bg-muted rounded-lg p-3 overflow-auto max-h-64 whitespace-pre-wrap break-all">
                  {JSON.stringify(JSON.parse(json), null, 2)}
                </pre>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 min-h-[280px] text-muted-foreground">
                <AlertCircle className="w-8 h-8" />
                <p className="text-sm text-center">
                  Preencha todos os campos corretamente para gerar o QR Code.
                </p>
                <div className="space-y-1 text-xs text-center">
                  {errors.checksum && (
                    <p className="text-destructive">Checksum inválido (64 hex chars)</p>
                  )}
                  {errors.ssid && (
                    <p className="text-destructive">SSID inválido (1-32 chars)</p>
                  )}
                  {errors.password && (
                    <p className="text-destructive">Senha inválida (8-63 chars)</p>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
