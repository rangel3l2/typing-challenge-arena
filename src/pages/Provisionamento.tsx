import { useMemo, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, RefreshCw, Upload } from "lucide-react";
import { toast } from "@/hooks/use-toast";

const getDefaultApkUrl = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return `${window.location.origin}/app-admin.apk`;
  }
  return "https://www.euvoujogar.com.br/app-admin.apk";
};
const DEFAULT_CHECKSUM_HEX =
  "ebe9f1d0b6e3238af63c768c1d8c8e708ab911502434454cd47e0766836c5b28";

const hexToBase64UrlSafe = (hexString: string): string => {
  try {
    const match = hexString.match(/\w{2}/g);
    if (!match) return "";
    const base64 = btoa(
      match.map((a) => String.fromCharCode(parseInt(a, 16))).join("")
    );
    return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  } catch (e) {
    return "";
  }
};

// Validation helpers
const isValidHex = (hex: string): boolean => /^[0-9a-fA-F]+$/.test(hex) && hex.length === 64;
const isValidSsid = (ssid: string): boolean => ssid.length >= 1 && ssid.length <= 32;
const isValidWifiPassword = (pw: string): boolean => pw.length >= 8 && pw.length <= 63;

export default function Provisionamento() {
  const [component, setComponent] = useState(
    "deltazero.amarok.foss/.receivers.AdminReceiver"
  );
  const [apkUrl, setApkUrl] = useState(getDefaultApkUrl);
  const [checksumHex, setChecksumHex] = useState(DEFAULT_CHECKSUM_HEX);
  const [ssid, setSsid] = useState("Rangel");
  const [password, setPassword] = useState("211292abc");
  const [touched, setTouched] = useState({
    checksum: false,
    ssid: false,
    password: false,
  });
  const [recomputing, setRecomputing] = useState(false);

  const computeSha256Hex = async (buffer: ArrayBuffer): Promise<string> => {
    const hash = await crypto.subtle.digest("SHA-256", buffer);
    return Array.from(new Uint8Array(hash))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  const recomputeFromUrl = async () => {
    setRecomputing(true);
    try {
      const res = await fetch(apkUrl, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      const hex = await computeSha256Hex(buf);
      setChecksumHex(hex);
      setTouched((p) => ({ ...p, checksum: true }));
      toast({ title: "Checksum atualizado", description: hex.slice(0, 16) + "…" });
    } catch (e: any) {
      toast({
        title: "Falha ao baixar APK",
        description: e?.message ?? "Verifique a URL pública.",
        variant: "destructive",
      });
    } finally {
      setRecomputing(false);
    }
  };

  const recomputeFromFile = async (file: File) => {
    setRecomputing(true);
    try {
      const buf = await file.arrayBuffer();
      const hex = await computeSha256Hex(buf);
      setChecksumHex(hex);
      setTouched((p) => ({ ...p, checksum: true }));
      toast({ title: "Checksum calculado", description: hex.slice(0, 16) + "…" });
    } catch (e: any) {
      toast({ title: "Erro ao ler arquivo", variant: "destructive" });
    } finally {
      setRecomputing(false);
    }
  };

  const checksumBase64Url = useMemo(
    () => hexToBase64UrlSafe(checksumHex),
    [checksumHex]
  );

  // Validate fields
  const errors = useMemo(() => {
    return {
      checksum: !isValidHex(checksumHex),
      ssid: !isValidSsid(ssid),
      password: !isValidWifiPassword(password),
    };
  }, [checksumHex, ssid, password]);

  const allValid = !errors.checksum && !errors.ssid && !errors.password;

  const json = useMemo(() => {
    if (!allValid) return "";
    const obj: Record<string, string> = {
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_COMPONENT_NAME": component,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_DOWNLOAD_LOCATION":
        apkUrl,
      "android.app.extra.PROVISIONING_DEVICE_ADMIN_PACKAGE_CHECKSUM":
        checksumBase64Url,
      "android.app.extra.PROVISIONING_WIFI_SSID": ssid,
      "android.app.extra.PROVISIONING_WIFI_PASSWORD": password,
      "android.app.extra.PROVISIONING_WIFI_SECURITY_TYPE": "WPA",
    };
    return JSON.stringify(obj);
  }, [component, apkUrl, checksumBase64Url, ssid, password, allValid]);

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
              <a href="/app-admin.apk" download>
                Baixar app-admin.apk
              </a>
            </Button>
            <Button onClick={recomputeFromUrl} disabled={recomputing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${recomputing ? "animate-spin" : ""}`} />
              Recalcular checksum da URL
            </Button>
            <Button asChild variant="secondary" disabled={recomputing}>
              <label className="cursor-pointer">
                <Upload className="w-4 h-4 mr-2" />
                Calcular de um .apk local
                <input
                  type="file"
                  accept=".apk,application/vnd.android.package-archive"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) recomputeFromFile(f);
                    e.target.value = "";
                  }}
                />
              </label>
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Após substituir o APK no servidor, clique em <strong>Recalcular</strong> para atualizar o SHA-256 e regenerar o QR Code automaticamente.
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
                Checksum (Hexadecimal)
              </Label>
              <Input
                id="checksum"
                value={checksumHex}
                onChange={(e) => {
                  setChecksumHex(e.target.value);
                  setTouched((prev) => ({ ...prev, checksum: true }));
                }}
                onBlur={() => setTouched((prev) => ({ ...prev, checksum: true }))}
                placeholder="SHA-256 do APK em hexadecimal"
                className={touched.checksum && errors.checksum ? "border-destructive focus-visible:ring-destructive" : ""}
              />
              {touched.checksum && errors.checksum && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  O checksum deve ser uma string hexadecimal de exatamente 64 caracteres.
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
